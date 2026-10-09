#!/usr/bin/env python3
"""Create a LOCAL Postgres database for the governance runtime (safe to re-run).

Why: the shared cloud database costs ~0.4 s per query, which makes every governance hook slow.
A local database answers in about a millisecond, so use it for the demo and latency numbers.

What it does, in order (each step is skipped if already done):
  1. connect to the local Postgres server as an admin
  2. create the app role and the database if they do not exist
  3. create all tables (same models the app uses: pii_proxy/db.py) and make sure every column added after
     the first release exists: users.hipaa_enabled / dpdp_enabled (per-user compliance toggles),
     users.rating_reset_at, events.original_response / anonymized_response / egress_pii_count (model-output
     checks), pii_findings.direction
  4. seed the 15 compliance categories and the HIPAA / DPDP packs
  5. print the DATABASE_URL to use, and optionally write it into .env

Usage (repo root, venv active):
    python scripts/setup_local_db.py                # admin = your OS user over the unix socket
    python scripts/setup_local_db.py --write-env    # also write DATABASE_URL into .env
    python scripts/setup_local_db.py --admin-url postgresql://postgres:SECRET@localhost:5432/postgres

MAKE SOMEONE A DASHBOARD ADMIN (local DB):
    1. Log in to the dashboard once with that account (this creates their row in `users`).
    2. psql postgresql://guardrail:guardrail@localhost:5432/guardrail
    3. SELECT email, role FROM users;                                  -- find the account
       UPDATE users SET role = 'admin' WHERE email = 'you@gmail.com';  -- promote
       \q     (refresh the dashboard; Admin menu appears)
    To demote: UPDATE users SET role = 'user' WHERE email = 'you@gmail.com';

SWITCH BETWEEN LOCAL AND NEON:
    Local: .env contains  DATABASE_URL=postgresql://guardrail:guardrail@localhost:5432/guardrail
    Neon : delete (or comment out with #) that DATABASE_URL line in .env. pii_proxy/db.py then falls back to
           its built-in Neon URL. Or set DATABASE_URL=<your neon url> explicitly.
    Then restart ./start_proxy.sh. Admins are stored per database, so repeat the promote step on Neon with:
           psql "<neon url>"   then the same UPDATE statement.

HOW TO GET A POSTGRES SUPERUSER LOGIN FOR THIS SCRIPT (one-time, pick one). The script tries these in order:
  A) The 'postgres' superuser with a password, passed via env (keeps it out of git; this repo is public):
         # 1. open a psql shell as the postgres OS user:
         sudo -u postgres psql postgres
         # 2. inside psql, set (or reset) the superuser password, then quit:
         ALTER USER postgres WITH PASSWORD 'your-password';
         \q
         # 3. run the script with that password:
         PG_ADMIN_PASSWORD='your-password' python scripts/setup_local_db.py --write-env
  B) Give your own OS user a superuser role, then no password is needed:
         sudo -u postgres createuser -s "$USER"
         python scripts/setup_local_db.py --write-env
  C) Pass any admin connection explicitly (special characters in the password must be URL-encoded):
         python scripts/setup_local_db.py --admin-url postgresql://postgres:PASS@localhost:5432/postgres
"""
import argparse
import os
import sys

import psycopg2
from psycopg2 import sql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

CATEGORIES = [
    (1, "Names"), (2, "Geographical Data"), (3, "Dates (Individual)"), (4, "Telephone Numbers"),
    (5, "Fax Numbers"), (6, "Email Addresses"), (7, "Social Security Numbers (SSN)"),
    (8, "Medical Record Numbers (MRN)"), (9, "Health Plan Beneficiary Numbers"), (10, "Account Numbers"),
    (11, "Certificate/License Numbers"), (12, "Vehicle Identifiers"), (13, "Device Identifiers"),
    (14, "Web URLs"), (15, "IP Addresses"),
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--admin-url", default=os.getenv("PG_ADMIN_URL", "dbname=postgres"),
                    help="admin connection (URL or libpq string). Default: unix socket as your OS user")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=5432)
    ap.add_argument("--db", default="guardrail")
    ap.add_argument("--user", default="guardrail")
    ap.add_argument("--password", default="guardrail")
    ap.add_argument("--write-env", action="store_true", help="write DATABASE_URL into .env")
    args = ap.parse_args()

    # 1-2. role + database
    attempts = [("--admin-url / PG_ADMIN_URL", lambda: psycopg2.connect(args.admin_url))]
    if os.getenv("PG_ADMIN_PASSWORD"):
        attempts.append(("postgres + PG_ADMIN_PASSWORD", lambda: psycopg2.connect(
            host=args.host, port=args.port, dbname="postgres", user="postgres",
            password=os.environ["PG_ADMIN_PASSWORD"])))
    admin, errors = None, []
    for label, connect in attempts[::-1] if os.getenv("PG_ADMIN_PASSWORD") and args.admin_url == "dbname=postgres" else attempts:
        try:
            admin = connect()
            print(f"admin login ok via {label}")
            break
        except psycopg2.OperationalError as e:
            errors.append(f"  {label}: {str(e).strip().splitlines()[-1]}")
    if admin is None:
        sys.exit("Cannot connect as admin:\n" + "\n".join(errors) + "\n\nSee the 'HOW TO GET AN ADMIN LOGIN' steps at the top of this file.")
    admin.autocommit = True
    cur = admin.cursor()
    cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (args.user,))
    if cur.fetchone():
        print(f"role '{args.user}' exists")
    else:
        cur.execute(sql.SQL("CREATE ROLE {} LOGIN PASSWORD %s").format(sql.Identifier(args.user)), (args.password,))
        print(f"created role '{args.user}'")
    cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (args.db,))
    if cur.fetchone():
        print(f"database '{args.db}' exists")
    else:
        cur.execute(sql.SQL("CREATE DATABASE {} OWNER {}").format(sql.Identifier(args.db), sql.Identifier(args.user)))
        print(f"created database '{args.db}'")
    admin.close()

    url = f"postgresql://{args.user}:{args.password}@{args.host}:{args.port}/{args.db}"

    # 3. tables: import the app's own models against the new URL
    os.environ["DATABASE_URL"] = url
    from pii_proxy import db as appdb
    if appdb.engine.dialect.name != "postgresql":
        sys.exit(f"App fell back to {appdb.engine.dialect.name}; could not reach {url}")
    appdb.init_db()
    print("tables ready: " + ", ".join(sorted(appdb.Base.metadata.tables)))

    # confirm the later-added columns are really there (fresh databases get them from the models,
    # older ones from init_db's ALTER TABLE ... IF NOT EXISTS step)
    import sqlalchemy as sa
    expected = {
        "users": ["hipaa_enabled", "dpdp_enabled", "rating_reset_at", "action_mode"],
        "events": ["original_response", "anonymized_response", "egress_pii_count"],
        "pii_findings": ["direction"],
    }
    with appdb.engine.connect() as conn:
        for table, cols in expected.items():
            have = {r[0] for r in conn.execute(sa.text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = :t"), {"t": table})}
            missing = [c for c in cols if c not in have]
            print(f"  {table}: " + (f"MISSING {missing}" if missing else "all expected columns present"))
            if missing:
                sys.exit(f"{table} is missing columns {missing}; check pii_proxy/db.py init_db()")

    # 4. seed categories and packs (idempotent)
    conn = psycopg2.connect(url)
    with conn, conn.cursor() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS packs (name text PRIMARY KEY)""")
        c.execute("""CREATE TABLE IF NOT EXISTS category_packs (
                        category_id int REFERENCES categories(id), pack_name text REFERENCES packs(name),
                        PRIMARY KEY (category_id, pack_name))""")
        for cid, name in CATEGORIES:
            c.execute("INSERT INTO categories (id, name) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING", (cid, name))
        for pack in ("HIPAA", "DPDP"):
            c.execute("INSERT INTO packs (name) VALUES (%s) ON CONFLICT DO NOTHING", (pack,))
            for cid, _ in CATEGORIES:
                c.execute("INSERT INTO category_packs VALUES (%s, %s) ON CONFLICT DO NOTHING", (cid, pack))
    conn.close()
    print("seeded 15 categories and packs HIPAA, DPDP")

    # 5. tell the user what to point at
    print(f"\nDATABASE_URL={url}")
    if args.write_env:
        env_path = os.path.join(ROOT, ".env")
        lines = [l for l in open(env_path).read().splitlines() if not l.startswith("DATABASE_URL")] if os.path.exists(env_path) else []
        open(env_path, "w").write("\n".join(lines + [f"DATABASE_URL={url}"]) + "\n")
        print(f"wrote DATABASE_URL to {env_path} (start_proxy.sh loads it)")
    else:
        print("Add it to .env (or re-run with --write-env), then restart ./start_proxy.sh")


if __name__ == "__main__":
    main()
