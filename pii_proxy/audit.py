import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func

from pii_proxy.context import Identity
from pii_proxy.db import SessionLocal, DBUser, DBSession, DBAgent, DBEvent, DBPIIFinding, DBReceipt, DBCategory, DBScoreLedger

GENESIS_HASH = "0" * 64
DEFAULT_SESSION = "default"


def _sha(text: Optional[str]) -> str:
    return hashlib.sha256((text or "").encode()).hexdigest()


def receipt_payload(version: int, event_id: str, session_id: str, seq: int, kind: str, decision: Optional[str],
                    action_mode: str, pii_count: int, prev_hash: str,
                    agent_id: Optional[str] = None, original_text: Optional[str] = None,
                    anonymized_text: Optional[str] = None) -> str:
    """
    The exact string a receipt hash covers. v1 (older rows) covered the decision metadata only.
    v2 also covers the agent and a hash of the stored original / processed text, so editing the
    recorded prompt or re-attributing the event to another agent breaks the chain too.
    """
    body = {
        "event_id": event_id, "session_id": session_id, "seq": seq, "kind": kind, "decision": decision,
        "action_mode": action_mode, "pii_count": pii_count, "prev_hash": prev_hash,
    }
    if version >= 2:
        body.update({"v": 2, "agent_id": agent_id, "original_sha": _sha(original_text), "processed_sha": _sha(anonymized_text)})
    return json.dumps(body, sort_keys=True, separators=(",", ":"))


def authority_payload(event_id: str, session_id: str, seq: int, agent_id: str, rows, prev_hash: str) -> str:
    """
    Payload of an *authority receipt*: the score change(s) one decision caused for one agent.
    `rows` are the score_ledger entries (delta, reason) tied to that event; editing, adding or removing
    a ledger row breaks the receipt.
    """
    rows = sorted((int(d), str(r)) for d, r in rows)
    return json.dumps({
        "kind": "authority", "event_id": event_id, "session_id": session_id, "seq": seq, "agent_id": agent_id,
        "delta": sum(d for d, _ in rows), "ledger_sha": _sha("|".join(f"{d}:{r}" for d, r in rows)), "prev_hash": prev_hash,
    }, sort_keys=True, separators=(",", ":"))


def receipt_hash(prev_hash: str, payload: str) -> str:
    return hashlib.sha256((prev_hash + payload).encode()).hexdigest()


def _decision_for(action_mode: str, pii_count: int) -> str:
    if pii_count == 0 or action_mode == "LOG_ONLY":
        return "allow"
    if action_mode == "BLOCK":
        return "block"
    return "redact"


def _get_or_create_agent(db, session: DBSession, name: str, parent_name: Optional[str]) -> DBAgent:
    agent = db.query(DBAgent).filter(DBAgent.session_id == session.id, DBAgent.agent_name == name).first()
    if agent is not None:
        return agent
    parent_id = None
    if parent_name and parent_name != name:
        parent_id = _get_or_create_agent(db, session, parent_name, None).id
    agent = DBAgent(session_id=session.id, agent_name=name, parent_agent_id=parent_id)
    db.add(agent)
    db.flush()
    return agent


class AuditLogger:
    """Writes one event per request, its PII findings (hashes only, never raw text), and a per-session receipt."""

    def log_event(
        self,
        user_id: str,
        user_uuid: str,
        request_id: str,
        action_mode: str,
        matches: List[Any],
        latency_ms: float,
        endpoint: str = "/v1/chat/completions",
        model: str = "",
        original_prompt: str = "",
        anonymized_prompt: str = "",
        vault: Any = None,
        identity: Optional[Identity] = None,
        kind: str = "prompt",
        tool_name: Optional[str] = None,
        decision: Optional[str] = None,
    ) -> Optional[str]:
        event_id = None
        session_ext = identity.session_external_id if identity else DEFAULT_SESSION
        agent_name = identity.agent_name if identity else "default"
        parent_name = identity.parent_agent_name if identity else None
        db = SessionLocal()
        try:
            user = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
            if user is None:
                user = DBUser(email=f"{user_uuid}@anonymous.local", name=user_id, user_uuid=user_uuid)
                db.add(user)
                db.flush()

            session = (
                db.query(DBSession)
                .filter(DBSession.user_id == user.id, DBSession.external_id == session_ext)
                .first()
            )
            if session is None:
                session = DBSession(user_id=user.id, external_id=session_ext)
                db.add(session)
                db.flush()
            session.last_seen_at = datetime.utcnow()

            agent = _get_or_create_agent(db, session, agent_name, parent_name)

            pii_count = len(matches)
            final_decision = decision if decision is not None else _decision_for(action_mode, pii_count)
            event = DBEvent(
                session_id=session.id,
                agent_id=agent.id,
                kind=kind,
                model=model,
                action_mode=action_mode,
                decision=final_decision,
                pii_count=pii_count,
                latency_ms=round(latency_ms, 2),
                tool_name=tool_name,
                anonymized_text=anonymized_prompt if final_decision == "redact" else None,
                original_text=original_prompt or None,
            )
            db.add(event)
            db.flush()

            for m in matches:
                placeholder = vault.get_or_create_placeholder(m.text, m.entity_type) if vault else f"[{m.entity_type}]"
                db.add(DBPIIFinding(
                    event_id=event.id,
                    category_id=m.category_id,
                    entity_type=m.entity_type,
                    placeholder=placeholder,
                    confidence=round(m.confidence, 3),
                    text_sha256=hashlib.sha256(m.text.encode()).hexdigest(),
                    direction="ingress",
                ))

            last = (
                db.query(DBReceipt)
                .filter(DBReceipt.session_id == session.id)
                .order_by(DBReceipt.seq.desc())
                .first()
            )
            prev_hash = last.hash if last else GENESIS_HASH
            seq = last.seq + 1 if last else 1
            payload = receipt_payload(
                2, event.id, session.id, seq, event.kind, event.decision, event.action_mode, pii_count, prev_hash,
                agent_id=event.agent_id, original_text=event.original_text, anonymized_text=event.anonymized_text,
            )
            db.add(DBReceipt(
                session_id=session.id,
                seq=seq,
                event_id=event.id,
                prev_hash=prev_hash,
                hash=receipt_hash(prev_hash, payload),
            ))
            db.commit()
            event_id = event.id
        except Exception as e:
            db.rollback()
            print(f"Audit write failed: {e}")
        finally:
            db.close()
        return event_id

    def log_egress_inspection(
        self,
        event_id: str,
        original_response: str,
        anonymized_response: str,
        egress_matches: List[Any],
        action_mode: str,
        vault: Any = None,
    ) -> None:
        """Record model output inspection results, sanitization, and any egress compliance violations."""
        if not event_id:
            return
        db = SessionLocal()
        try:
            event = db.query(DBEvent).filter(DBEvent.id == event_id).first()
            if not event:
                return

            egress_count = len(egress_matches) if egress_matches else 0
            event.original_response = original_response or None
            event.anonymized_response = anonymized_response or original_response or None
            event.egress_pii_count = egress_count

            if egress_count > 0:
                # Note: Model output (egress) violations are NOT added to event.pii_count
                # and do NOT overwrite event.decision. User scores evaluate user input (ingress),
                # while output tokens (completion_tokens) continue to be counted in usage.

                for m in egress_matches:
                    placeholder = vault.get_or_create_placeholder(m.text, m.entity_type) if vault else f"[{m.entity_type}]"
                    db.add(DBPIIFinding(
                        event_id=event.id,
                        category_id=m.category_id,
                        entity_type=m.entity_type,
                        placeholder=placeholder,
                        confidence=round(m.confidence, 3),
                        text_sha256=hashlib.sha256(m.text.encode()).hexdigest(),
                        direction="egress",
                    ))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Egress audit write failed: {e}")
        finally:
            db.close()

    def set_usage(self, event_id: str, prompt_tokens: Optional[int], completion_tokens: Optional[int], estimated: bool) -> None:
        db = SessionLocal()
        try:
            db.query(DBEvent).filter(DBEvent.id == event_id).update({
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "tokens_estimated": estimated,
            })
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Usage write failed: {e}")
        finally:
            db.close()

    def get_stats(self, user_uuid: Optional[str] = None) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            events = (
                db.query(DBEvent)
                .join(DBSession, DBSession.id == DBEvent.session_id)
                .join(DBUser, DBUser.id == DBSession.user_id)
            )
            findings = (
                db.query(DBCategory.name, func.count(DBPIIFinding.id))
                .join(DBPIIFinding, DBPIIFinding.category_id == DBCategory.id)
                .join(DBEvent, DBEvent.id == DBPIIFinding.event_id)
                .join(DBSession, DBSession.id == DBEvent.session_id)
                .join(DBUser, DBUser.id == DBSession.user_id)
            )
            if user_uuid:
                events = events.filter(DBUser.user_uuid == user_uuid)
                findings = findings.filter(DBUser.user_uuid == user_uuid)

            rows = (
                events.with_entities(
                    DBEvent.decision,
                    DBEvent.action_mode,
                    func.count(DBEvent.id),
                    func.coalesce(func.sum(DBEvent.pii_count), 0),
                    func.coalesce(func.sum(DBEvent.prompt_tokens), 0),
                    func.coalesce(func.sum(DBEvent.completion_tokens), 0),
                    func.coalesce(func.sum(DBEvent.latency_ms), 0),
                )
                .group_by(DBEvent.decision, DBEvent.action_mode)
                .all()
            )
            tokens_in = tokens_out = 0
            latency_sum = 0.0
            categories = dict(findings.group_by(DBCategory.name).all())

            decision_counts = {"allow": 0, "redact": 0, "block": 0, "deny": 0}
            action_counts: Dict[str, int] = {}
            total = 0
            pii_total = 0
            for decision, action_name, n, pii, t_in, t_out, lat in rows:
                latency_sum += float(lat or 0)
                decision_counts[decision] = decision_counts.get(decision, 0) + n
                key = action_name or "UNKNOWN"
                action_counts[key] = action_counts.get(key, 0) + n
                total += n
                pii_total += int(pii)
                tokens_in += int(t_in)
                tokens_out += int(t_out)
            return {
                "total_requests": total,
                "total_pii_detected": pii_total,
                "total_tokens": tokens_in + tokens_out,
                "avg_latency_ms": round(latency_sum / total, 1) if total else 0,
                "category_counts": categories,
                "action_counts": action_counts,
                "decision_counts": decision_counts,
            }
        finally:
            db.close()

    def log_authority_receipt(self, session_id: str, event_id: str, agent_id: str) -> bool:
        """Append a receipt for the score change(s) an event caused. No score change -> no receipt."""
        db = SessionLocal()
        try:
            rows = (
                db.query(DBScoreLedger.delta, DBScoreLedger.reason)
                .filter(DBScoreLedger.event_id == event_id, DBScoreLedger.agent_id == agent_id)
                .all()
            )
            if not rows:
                return False
            last = db.query(DBReceipt).filter(DBReceipt.session_id == session_id).order_by(DBReceipt.seq.desc()).first()
            prev_hash = last.hash if last else GENESIS_HASH
            seq = last.seq + 1 if last else 1
            payload = authority_payload(event_id, session_id, seq, agent_id, rows, prev_hash)
            db.add(DBReceipt(session_id=session_id, seq=seq, event_id=event_id, prev_hash=prev_hash,
                             hash=receipt_hash(prev_hash, payload)))
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"Authority receipt write failed: {e}")
            return False
        finally:
            db.close()

    def verify_session(self, session_id: str) -> Dict[str, Any]:
        """
        Walk a session's receipt chain and recompute every hash from the stored event.
        Returns {ok, receipts, broken_at_seq, reason}. Detects edited decisions / text / agent,
        deleted events, removed or reordered receipts.
        """
        db = SessionLocal()
        try:
            rows = (
                db.query(DBReceipt, DBEvent)
                .outerjoin(DBEvent, DBEvent.id == DBReceipt.event_id)
                .filter(DBReceipt.session_id == session_id)
                .order_by(DBReceipt.seq.asc())
                .all()
            )
            prev = GENESIS_HASH
            seen_events = set()
            for i, (r, e) in enumerate(rows, start=1):
                def broken(reason):
                    return {"ok": False, "receipts": len(rows), "broken_at_seq": r.seq, "reason": reason}
                if r.seq != i:
                    return broken(f"receipt sequence gap: expected #{i}, found #{r.seq} (a receipt was removed)")
                if r.prev_hash != prev:
                    return broken("previous-hash link does not match the receipt before it")
                if e is None:
                    return broken("the event this receipt covers no longer exists")
                if e.id in seen_events:
                    # second receipt for the same event = its authority receipt (score change); recompute from the ledger
                    ledger = (
                        db.query(DBScoreLedger.delta, DBScoreLedger.reason)
                        .filter(DBScoreLedger.event_id == e.id, DBScoreLedger.agent_id == e.agent_id).all()
                    )
                    cand = [authority_payload(e.id, session_id, r.seq, e.agent_id, ledger, r.prev_hash)]
                    if not any(receipt_hash(r.prev_hash, c) == r.hash for c in cand):
                        return broken("score ledger no longer matches the authority receipt (a score change was edited, added or removed)")
                    prev = r.hash
                    continue
                seen_events.add(e.id)
                # Egress inspection (model output) later rewrites the event's decision and adds to pii_count.
                # The receipt was hashed before that, so undo it: remove the egress count and accept any
                # decision egress could have turned it into. Text, agent, order and deletions stay tamper-evident.
                egress = getattr(e, "egress_pii_count", 0) or 0
                pii = (e.pii_count or 0) - egress
                decisions = [e.decision] if not egress else [e.decision, "allow", "redact", "block"]
                candidates = []
                for dec in decisions:
                    candidates += [
                        receipt_payload(2, e.id, session_id, r.seq, e.kind, dec, e.action_mode, pii, r.prev_hash,
                                        agent_id=e.agent_id, original_text=e.original_text, anonymized_text=e.anonymized_text),
                        # older receipts: metadata only, and for proxy events the decision argument was left empty
                        receipt_payload(1, e.id, session_id, r.seq, e.kind, dec, e.action_mode, pii, r.prev_hash),
                    ]
                candidates.append(receipt_payload(1, e.id, session_id, r.seq, e.kind, None, e.action_mode, pii, r.prev_hash))
                if not any(receipt_hash(r.prev_hash, c) == r.hash for c in candidates):
                    return broken("stored event no longer matches what was hashed (decision, text or agent was changed)")
                prev = r.hash
            return {"ok": True, "receipts": len(rows), "broken_at_seq": None, "reason": "chain intact"}
        finally:
            db.close()

    def export_session_receipts(self, session_id: str) -> List[Dict[str, Any]]:
        """Receipts for one session with the full attribution chain: user -> session -> agent -> parent agent."""
        from sqlalchemy.orm import aliased
        Parent = aliased(DBAgent)
        db = SessionLocal()
        try:
            rows = (
                db.query(DBReceipt, DBEvent, DBSession, DBUser, DBAgent, Parent)
                .outerjoin(DBEvent, DBEvent.id == DBReceipt.event_id)
                .join(DBSession, DBSession.id == DBReceipt.session_id)
                .join(DBUser, DBUser.id == DBSession.user_id)
                .outerjoin(DBAgent, DBAgent.id == DBEvent.agent_id)
                .outerjoin(Parent, Parent.id == DBAgent.parent_agent_id)
                .filter(DBReceipt.session_id == session_id)
                .order_by(DBReceipt.seq.asc())
                .all()
            )
            out, seen = [], set()
            for r, e, sess, u, a, p in rows:
                is_auth = r.event_id in seen
                seen.add(r.event_id)
                item = {
                    "seq": r.seq,
                    "type": "authority" if is_auth else "decision",
                    "timestamp": r.created_at.isoformat() if r.created_at else None,
                    "user_id": u.user_uuid,
                    "session_id": sess.external_id or sess.id,
                    "agent_id": a.agent_name if a else None,
                    "parent_agent_id": p.agent_name if p else None,
                    "kind": e.kind if e else None,
                    "tool_name": e.tool_name if e else None,
                    "decision": e.decision if e else None,
                    "action_mode": e.action_mode if e else None,
                    "pii_count": e.pii_count if e else None,
                    "event_id": r.event_id,
                    "previous_hash": r.prev_hash,
                    "hash": r.hash,
                }
                if is_auth and e is not None:
                    led = (
                        db.query(DBScoreLedger.delta, DBScoreLedger.reason)
                        .filter(DBScoreLedger.event_id == e.id, DBScoreLedger.agent_id == e.agent_id).all()
                    )
                    item["score_delta"] = sum(d for d, _ in led)
                    item["score_reasons"] = [r_ for _, r_ in led]
                out.append(item)
            return out
        finally:
            db.close()

    def get_recent_receipts(self, limit: int = 50, user_uuid: Optional[str] = None) -> List[Dict[str, Any]]:
        db = SessionLocal()
        try:
            q = (
                db.query(DBReceipt, DBEvent, DBUser)
                .join(DBEvent, DBEvent.id == DBReceipt.event_id)
                .join(DBSession, DBSession.id == DBReceipt.session_id)
                .join(DBUser, DBUser.id == DBSession.user_id)
            )
            if user_uuid:
                q = q.filter(DBUser.user_uuid == user_uuid)
            rows = q.order_by(DBReceipt.created_at.desc(), DBReceipt.seq.desc()).limit(limit).all()
            return [
                {
                    "receipt_id": r.id,
                    "session_id": r.session_id,
                    "seq": r.seq,
                    "timestamp": r.created_at.isoformat() if r.created_at else None,
                    "user_uuid": u.user_uuid,
                    "event_id": e.id,
                    "action_mode": e.action_mode,
                    "decision": e.decision,
                    "pii_count": e.pii_count,
                    "previous_hash": r.prev_hash,
                    "current_hash": r.hash,
                }
                for r, e, u in rows
            ]
        finally:
            db.close()


audit_logger = AuditLogger()
