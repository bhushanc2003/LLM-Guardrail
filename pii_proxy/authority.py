import os
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
from sqlalchemy import func

from pii_proxy.db import SessionLocal, DBAgent, DBScoreLedger, DBEvent

DEFAULT_POLICY = {
    "scoring": {
        "ceiling": 100,
        "clean_tool_reward": 3,
        "penalties": {
            "denied_attempt": -3,
            "out_of_scope": -10,  # fallback when the tool's risk is unknown
            "out_of_scope_low": -5,
            "out_of_scope_medium": -10,
            "out_of_scope_high": -15,
            "external_recipient": -10,
            "prompt_injection": -15,
            "compliance_redaction": -10,
            "compliance_block": -20,
        },
        "session_block_threshold": 20,
        "at_risk_threshold": 50,
    },
    "tool_risk_thresholds": {"low": 30, "medium": 40, "high": 60},
    "tools": {
        "lookup_patient": 30,
        "lookup_patient_record": 30,
        "get_medical_history": 30,
        "check_vital_signs": 30,
        "search_records": 30,
        "order_lab_test": 50,
        "update_patient_notes": 50,
        "send_email": 70,
        "send_external_email": 70,
        "prescribe_medication": 75,
        "delete_record": 85,
        "delete_medical_record": 85,
        "export_records": 80,
    },
    "default_tool_threshold": 40,
}


def get_own_score(db, agent_id: str) -> Tuple[int, int]:
    """Agent's own score, ignoring its parent: min(ceiling, initial + sum(ledger deltas))."""
    agent = db.query(DBAgent).filter(DBAgent.id == agent_id).first()
    if not agent:
        return 100, 100

    deltas_sum = (
        db.query(func.coalesce(func.sum(DBScoreLedger.delta), 0))
        .filter(DBScoreLedger.agent_id == agent.id)
        .scalar()
    ) or 0

    computed = agent.initial_score + int(deltas_sum)
    return max(0, min(agent.ceiling, computed)), agent.ceiling


def get_agent_score(db, agent_id: str) -> Tuple[int, int]:
    """
    Effective authority score with delegation capping:
    effective(agent) = min(own score, effective(parent)).
    A delegate can never hold more authority than the agent that delegated to it.
    Returns (effective_score, ceiling).
    """
    score, ceiling = get_own_score(db, agent_id)
    seen = {agent_id}
    agent = db.query(DBAgent).filter(DBAgent.id == agent_id).first()
    while agent is not None and agent.parent_agent_id and agent.parent_agent_id not in seen:
        seen.add(agent.parent_agent_id)
        parent_score, parent_ceiling = get_own_score(db, agent.parent_agent_id)
        score = min(score, parent_score)
        ceiling = min(ceiling, parent_ceiling)
        agent = db.query(DBAgent).filter(DBAgent.id == agent.parent_agent_id).first()
    return score, ceiling


def record_score_delta(
    db,
    agent_id: str,
    delta: int,
    reason: str,
    event_id: Optional[str] = None
) -> Optional[DBScoreLedger]:
    """Records an immutable transaction in the authority score ledger."""
    try:
        entry = DBScoreLedger(
            agent_id=agent_id,
            delta=delta,
            reason=reason,
            event_id=event_id,
            created_at=datetime.utcnow()
        )
        db.add(entry)
        db.flush()
        return entry
    except Exception as e:
        print(f"Failed to record score delta: {e}")
        return None


def penalize_agent(
    db,
    agent_id: str,
    penalty_type: str,
    reason: str,
    event_id: Optional[str] = None
) -> int:
    """Applies a monotonic reduction penalty to the agent's authority score."""
    delta = DEFAULT_POLICY["scoring"]["penalties"].get(penalty_type, -10)
    record_score_delta(db, agent_id=agent_id, delta=delta, reason=reason, event_id=event_id)

    return delta


def authorize_tool_call(
    db,
    session_id: str,
    agent_id: str,
    tool_name: str,
    custom_threshold: Optional[int] = None
) -> Dict[str, Any]:
    """
    Execution Boundary Gate: Evaluates if agent has earned the authority to call tool_name.
    """
    current_score, ceiling = get_agent_score(db, agent_id)
    
    # Required threshold from parameter, policy map, or fallback default
    threshold = (
        custom_threshold
        if custom_threshold is not None
        else DEFAULT_POLICY["tools"].get(tool_name.lower(), DEFAULT_POLICY["default_tool_threshold"])
    )

    if current_score < threshold:
        # Monotonic penalty for unauthorized execution attempt
        penalize_agent(
            db,
            agent_id=agent_id,
            penalty_type="denied_attempt",
            reason=f"Unauthorized tool invocation attempt: {tool_name} (score {current_score} < required {threshold})"
        )
        new_score, _ = get_agent_score(db, agent_id)
        return {
            "allowed": False,
            "decision": "deny",
            "reason": f"DENIED by Governance: Agent authority score ({current_score}) < required threshold ({threshold}) for tool '{tool_name}'.",
            "current_score": new_score,
            "required_score": threshold,
            "ceiling": ceiling
        }

    return {
        "allowed": True,
        "decision": "allow",
        "reason": f"Authorized: Score {current_score} >= required {threshold}",
        "current_score": current_score,
        "required_score": threshold,
        "ceiling": ceiling
    }


def verify_and_reward_tool_result(
    db,
    agent_id: str,
    pre_authorized: bool,
    input_compliant: bool,
    execution_clean: bool,
    output_compliant: bool,
    event_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    4-Point Verified Proof Contract:
    Only when all 4 conditions are met does the runtime grant an evidence reward (+3):
    1. Pre-authorized: Cleared policy gate
    2. Input compliant: Arguments contained no violations
    3. Execution clean: No runtime error / fault
    4. Output compliant: Return data was compliant / clean
    """
    if pre_authorized and input_compliant and execution_clean and output_compliant:
        reward = DEFAULT_POLICY["scoring"]["clean_tool_reward"]
        record_score_delta(
            db,
            agent_id=agent_id,
            delta=reward,
            reason="Verified proof: clean, authorized, and compliant tool execution",
            event_id=event_id
        )
        new_score, ceiling = get_agent_score(db, agent_id)
        return {
            "verified": True,
            "delta": reward,
            "current_score": new_score,
            "ceiling": ceiling,
            "reason": "Verified proof rewarded"
        }
    
    current_score, ceiling = get_agent_score(db, agent_id)
    return {
        "verified": False,
        "delta": 0,
        "current_score": current_score,
        "ceiling": ceiling,
        "reason": "Verification requirements not met"
    }


def evaluate_verdict(scores: Dict[str, int]) -> Tuple[bool, str]:
    """
    Pure roll-up of per-agent (own) scores into a verdict on the session's final output.
    Blocked when (a) any single agent is severely degraded (< session_block_threshold), or
    (b) at least two agents, and at least half of all agents, are at risk (< at_risk_threshold).
    """
    block_below = DEFAULT_POLICY["scoring"]["session_block_threshold"]
    risk_below = DEFAULT_POLICY["scoring"]["at_risk_threshold"]

    for name, score in scores.items():
        if score < block_below:
            return False, f"output blocked: not HIPAA/DPDP-compliant (agent '{name}' trust score degraded to {score} < {block_below})"

    at_risk = [n for n, sc in scores.items() if sc < risk_below]
    if len(at_risk) >= 2 and len(at_risk) * 2 >= len(scores):
        return False, f"output blocked: not HIPAA/DPDP-compliant ({len(at_risk)} of {len(scores)} agents at risk: {', '.join(at_risk)})"

    return True, "Session compliant"


def check_session_verdict(db, session_id: str) -> Tuple[bool, str]:
    """DB-backed verdict for a session (used by /api/governance/*)."""
    agents = db.query(DBAgent).filter(DBAgent.session_id == session_id).all()
    return evaluate_verdict({a.agent_name: get_own_score(db, a.id)[0] for a in agents})


def user_session_scores(db, user_id: str, since=None, limit: int = 20) -> List[Dict[str, Any]]:
    """
    For a user's most recent sessions, each agent's own authority score (initial + ledger deltas, clamped).
    Returns [{"session_id", "min_score", "agents": {agent_name: score}}], newest first.
    """
    from pii_proxy.db import DBSession
    sessions = db.query(DBSession.id).filter(DBSession.user_id == user_id)
    if since is not None:
        sessions = sessions.filter(DBSession.last_seen_at >= since)
    session_ids = [r[0] for r in sessions.order_by(DBSession.last_seen_at.desc()).limit(limit).all()]
    if not session_ids:
        return []
    rows = (
        db.query(DBAgent.session_id, DBAgent.agent_name, DBAgent.initial_score, DBAgent.ceiling,
                 func.coalesce(func.sum(DBScoreLedger.delta), 0))
        .outerjoin(DBScoreLedger, DBScoreLedger.agent_id == DBAgent.id)
        .filter(DBAgent.session_id.in_(session_ids))
        .group_by(DBAgent.id)
        .all()
    )
    by_session: Dict[str, Dict[str, int]] = {sid: {} for sid in session_ids}
    for sid, name, initial, ceiling, delta in rows:
        by_session[sid][name] = max(0, min(ceiling, initial + int(delta)))
    return [
        {"session_id": sid, "min_score": min(a.values()) if a else 100, "agents": a}
        for sid, a in ((sid, by_session[sid]) for sid in session_ids)
    ]
