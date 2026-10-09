#!/usr/bin/env python3
"""
Tamper-evidence demo for the hash-chained audit receipts.

  1. writes a small session of events (each gets a receipt chained to the one before it)
  2. verifies the chain                       -> intact
  3. edits a stored decision directly in the database (what an attacker or a careless admin could do)
  4. verifies again                           -> broken at that receipt, with the reason
  5. restores the value and verifies          -> intact again

Run from the repo root with the venv active and DATABASE_URL pointing at the database to use:
    python scripts/receipt_tamper_demo.py
"""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pii_proxy.audit import audit_logger
from pii_proxy.context import Identity
from pii_proxy.db import DBEvent, DBReceipt, DBSession, DBUser, SessionLocal, init_db

init_db()
user_uuid = f"tamper-demo-{uuid.uuid4().hex[:6]}"
ident = lambda agent, parent=None: Identity(session_external_id=f"demo-{user_uuid}", agent_name=agent, parent_agent_name=parent)

steps = [
    ("orchestrator", None, "prompt", "allow", "Find Margaret and email her"),
    ("data_agent", "orchestrator", "tool_call", "allow", '{"query": "Margaret"}'),
    ("rogue_agent", "orchestrator", "tool_call", "deny", '{"filename": "audit_log.txt"}'),
    ("orchestrator", None, "completion", "block", "output blocked: not HIPAA/DPDP-compliant"),
]
for agent, parent, kind, decision, text in steps:
    audit_logger.log_event(user_id=user_uuid, user_uuid=user_uuid, request_id=uuid.uuid4().hex[:8], action_mode="REDACT",
                           matches=[], latency_ms=1.0, endpoint="demo", model="demo", original_prompt=text,
                           identity=ident(agent, parent), kind=kind, decision=decision)

db = SessionLocal()
sess = db.query(DBSession).join(DBUser, DBUser.id == DBSession.user_id).filter(DBUser.user_uuid == user_uuid).first()
sid = sess.id
print(f"session {sess.external_id}: {len(audit_logger.export_session_receipts(sid))} receipts written")
print("1. verify untouched      ->", audit_logger.verify_session(sid))

victim = (db.query(DBEvent).filter(DBEvent.session_id == sid, DBEvent.decision == "deny").first())
victim_id, original = victim.id, victim.decision
db.query(DBEvent).filter(DBEvent.id == victim_id).update({"decision": "allow"})   # the tampering
db.commit()
print("2. after editing a 'deny' to 'allow' in the database ->", audit_logger.verify_session(sid))

db.query(DBEvent).filter(DBEvent.id == victim_id).update({"decision": original})
db.commit()
print("3. after restoring it    ->", audit_logger.verify_session(sid))
db.close()
