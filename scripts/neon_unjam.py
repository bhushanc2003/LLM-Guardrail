#!/usr/bin/env python3
"""
Emergency: un-freeze the shared database when queries pile up behind a schema change.

Symptom: the dashboard hangs; in pg_stat_activity many sessions have wait_event_type = 'Lock', and a few sit
'idle in transaction'. Cause: an ALTER TABLE (needs an exclusive lock) waits behind an open transaction and every
later query queues behind the ALTER.

This closes (a) waiting ALTER TABLE sessions and (b) read transactions left open for more than a few seconds.
Clients reconnect on their own. Uses DATABASE_URL, or Neon when it is not set.

    python scripts/neon_unjam.py            # one pass
    python scripts/neon_unjam.py --watch    # repeat every 5 s until Ctrl+C
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pii_proxy.db import engine
import sqlalchemy as sa

def snapshot(c):
    return c.execute(sa.text("""select state, coalesce(wait_event_type,'-'), count(*) from pg_stat_activity
        where datname=current_database() and pid<>pg_backend_pid() group by 1,2 order by 3 desc""")).fetchall()

def once():
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as c:
        n = c.execute(sa.text("""select count(pg_terminate_backend(pid)) from pg_stat_activity
            where datname=current_database() and pid<>pg_backend_pid() and (
              (state='idle in transaction' and now()-xact_start > interval '5 seconds')
              or (state='active' and query ilike 'ALTER TABLE%'))""")).scalar()
        time.sleep(2)
        print(f"closed {n} session(s); now:", snapshot(c))

if __name__ == "__main__":
    print("database host:", engine.url.host)
    once()
    while "--watch" in sys.argv:
        time.sleep(5); once()
