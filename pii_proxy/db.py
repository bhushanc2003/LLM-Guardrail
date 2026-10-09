import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.dialects.postgresql import UUID

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_BIrh05EqdNPs@ep-sweet-grass-b3v25j2p-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
)
if not DB_URL:
    try:
        from dotenv import load_dotenv
        load_dotenv()
        DB_URL = os.getenv("DATABASE_URL")
    except Exception:
        pass

# Normalize connection string
if DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql://", 1)

def create_db_engine(url: str):
    import ssl
    # 1. Try standard psycopg2 if available and not explicitly using pg8000
    if not os.getenv("VERCEL") and "postgresql+pg8000://" not in url:
        try:
            eng = sa.create_engine(
                url,
                pool_size=5,
                max_overflow=10,
                pool_recycle=240,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 5}
            )
            # Test connection
            with eng.connect() as conn:
                conn.execute(sa.text("SELECT 1"))
            return eng
        except Exception as e:
            print(f"Primary psycopg2 DB engine failed: {e}")

    # 2. Try pure-python pg8000 driver (safe for Vercel/Lambda serverless)
    try:
        clean_url = url.replace("postgresql://", "postgresql+pg8000://", 1).replace("postgres://", "postgresql+pg8000://", 1)
        if "?" in clean_url:
            base_url, query = clean_url.split("?", 1)
            query_params = [q for q in query.split("&") if not q.startswith("sslmode=")]
            clean_url = base_url + ("?" + "&".join(query_params) if query_params else "")

        ssl_ctx = ssl.create_default_context()
        eng = sa.create_engine(
            clean_url,
            pool_pre_ping=True,
            connect_args={"ssl_context": ssl_ctx}
        )
        with eng.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        print("Successfully connected to Neon PostgreSQL via pg8000 pure-python driver.")
        return eng
    except Exception as e:
        print(f"pg8000 DB engine failed: {e}")

    # 3. Fallback to SQLite in /tmp for serverless runtime
    sqlite_path = "/tmp/fallback_pii.db"
    print(f"Using SQLite fallback at {sqlite_path}")
    return sa.create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

engine = create_db_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DBCategory(Base):
    __tablename__ = "categories"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.Text, nullable=False)


class DBUser(Base):
    __tablename__ = "users"

    id = sa.Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    clerk_user_id = sa.Column(sa.Text, unique=True, nullable=True, index=True)
    email = sa.Column(sa.Text, unique=True, nullable=False, index=True)
    name = sa.Column(sa.Text, nullable=True)
    user_uuid = sa.Column(sa.Text, unique=True, nullable=False, index=True)
    role = sa.Column(sa.Text, nullable=False, default="user")
    action_mode = sa.Column(sa.Text, nullable=True)
    hipaa_enabled = sa.Column(sa.Boolean, nullable=True, default=True)
    dpdp_enabled = sa.Column(sa.Boolean, nullable=True, default=True)
    rating_reset_at = sa.Column(sa.DateTime(timezone=True), nullable=True)  # admin reset: rating counts only data after this
    created_at = sa.Column(sa.DateTime(timezone=True), default=datetime.utcnow)

    sessions = relationship("DBSession", back_populates="user", cascade="all, delete-orphan")


class DBSession(Base):
    __tablename__ = "sessions"

    id = sa.Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id = sa.Column(sa.Text, nullable=True, index=True)
    started_at = sa.Column(sa.DateTime(timezone=True), default=datetime.utcnow)
    last_seen_at = sa.Column(sa.DateTime(timezone=True), default=datetime.utcnow, index=True)

    user = relationship("DBUser", back_populates="sessions")
    events = relationship("DBEvent", back_populates="session", cascade="all, delete-orphan")


class DBAgent(Base):
    __tablename__ = "agents"
    __table_args__ = (sa.UniqueConstraint("session_id", "agent_name"),)

    id = sa.Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_name = sa.Column(sa.Text, nullable=False)
    parent_agent_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    initial_score = sa.Column(sa.Integer, nullable=False, default=100)
    ceiling = sa.Column(sa.Integer, nullable=False, default=100)
    created_at = sa.Column(sa.DateTime(timezone=True), default=datetime.utcnow)


class DBEvent(Base):
    __tablename__ = "events"

    id = sa.Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = sa.Column(UUID(as_uuid=False), nullable=True)
    kind = sa.Column(sa.Text, nullable=False, default="prompt")
    model = sa.Column(sa.Text, nullable=True)
    action_mode = sa.Column(sa.Text, nullable=True)
    decision = sa.Column(sa.Text, nullable=False, index=True)
    pii_count = sa.Column(sa.Integer, nullable=False, default=0)
    prompt_tokens = sa.Column(sa.Integer, nullable=True)
    completion_tokens = sa.Column(sa.Integer, nullable=True)
    tokens_estimated = sa.Column(sa.Boolean, nullable=False, default=False)
    latency_ms = sa.Column(sa.Float, nullable=True)
    tool_name = sa.Column(sa.Text, nullable=True)
    anonymized_text = sa.Column(sa.Text, nullable=True)
    original_text = sa.Column(sa.Text, nullable=True)
    original_response = sa.Column(sa.Text, nullable=True)
    anonymized_response = sa.Column(sa.Text, nullable=True)
    egress_pii_count = sa.Column(sa.Integer, nullable=True, default=0)
    created_at = sa.Column(sa.DateTime(timezone=True), default=datetime.utcnow, index=True)

    session = relationship("DBSession", back_populates="events")
    findings = relationship("DBPIIFinding", back_populates="event", cascade="all, delete-orphan")


class DBPIIFinding(Base):
    __tablename__ = "pii_findings"

    id = sa.Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = sa.Column(sa.Integer, sa.ForeignKey("categories.id"), nullable=False)
    entity_type = sa.Column(sa.Text, nullable=False)
    placeholder = sa.Column(sa.Text, nullable=True)
    confidence = sa.Column(sa.Float, nullable=True)
    text_sha256 = sa.Column(sa.CHAR(64), nullable=False)
    direction = sa.Column(sa.Text, nullable=True, default="ingress")

    event = relationship("DBEvent", back_populates="findings")


class DBReceipt(Base):
    __tablename__ = "receipts"

    id = sa.Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    seq = sa.Column(sa.Integer, nullable=False)
    event_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    prev_hash = sa.Column(sa.CHAR(64), nullable=False)
    hash = sa.Column(sa.CHAR(64), nullable=False)
    created_at = sa.Column(sa.DateTime(timezone=True), default=datetime.utcnow)


class DBScoreLedger(Base):
    __tablename__ = "score_ledger"

    id = sa.Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    delta = sa.Column(sa.Integer, nullable=False)
    reason = sa.Column(sa.Text, nullable=False)
    event_id = sa.Column(UUID(as_uuid=False), sa.ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=datetime.utcnow)


def init_db():
    """Create any missing tables. Existing v1 tables are left as they are."""
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning in create_all: {e}")


def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
