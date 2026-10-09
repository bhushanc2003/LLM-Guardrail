"""
GuardRailBench governance hooks (docs/HOOK_CONTRACT.md in the bench repo).

Mounted into the main app (pii_proxy.main includes `router`), so these endpoints share port 8000
with the proxy and dashboard.

Design: the bench gives every hook a 2 s timeout and silently fails open, but our database is remote
(~0.4 s per round trip). So the hot path never touches the DB:

  * decisions (redact / allow / deny / block) are made from in-memory per-session agent state
    (score, ceiling, parent link) using the same policy numbers as pii_proxy.authority;
  * everything that must be recorded (events, receipts, score-ledger rows, usage) is queued and
    written by one background worker, in order, into the same sessions/agents/events/
    score_ledger tables the dashboard reads.
"""
import hashlib
import json
import os
import queue
import re
import threading
import time
import uuid
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from pii_proxy.anonymizer import PIIAnonymizer, PIISessionVault
from pii_proxy.audit import audit_logger
from pii_proxy.authority import DEFAULT_POLICY, evaluate_verdict, penalize_agent, verify_and_reward_tool_result
from pii_proxy.config import config
from pii_proxy.context import Identity
from pii_proxy.db import DBAgent, DBSession, DBUser, SessionLocal
from pii_proxy.pii_detector import PIIDetector

router = APIRouter(tags=["guardrailbench-hooks"])
detector = PIIDetector()
anonymizer = PIIAnonymizer(detector=detector)
detector.detect("warm up Jane Smith 912-34-5678 (614) 555-0192 a@b.com", aggressive_names=True)  # first hook must not be slow (bench times out at 2 s)

# REDACT, not ANONYMIZE: ANONYMIZE restores the original value into completions/
# results before returning them, which would defeat the leak checks here.
ACTION_MODE = "HASH"

BLOCK_MESSAGE = "[BLOCKED by governance: contains protected identifiers (HIPAA/DPDP)]"

# --- action mode (REDACT / HASH / BLOCK / LOG_ONLY) --------------------------------------------
# Precedence: the user's saved mode (dashboard) -> global mode -> HASH. User modes are cached in
# memory and refreshed in the background, so a hook never waits on the database for this.
# ANONYMIZE behaves as REDACT here: restoring real values would defeat the leak checks.
_USER_MODES: Dict[str, str] = {}
_USER_FRAMEWORKS: Dict[str, tuple] = {}   # user_uuid -> (hipaa_enabled, dpdp_enabled); dashboard toggles, default both on


SERVERLESS = bool(os.getenv("VERCEL"))   # no background threads there: the instance freezes after each response
_LAST_REFRESH = 0.0


def _refresh_user_modes_once() -> None:
    global _LAST_REFRESH
    _LAST_REFRESH = time.time()
    try:
        db = SessionLocal()
        try:
            rows = db.query(DBUser.user_uuid, DBUser.action_mode, DBUser.hipaa_enabled, DBUser.dpdp_enabled).all()
            _USER_MODES.clear()
            _USER_MODES.update({u: (m or "").upper() for u, m, _, _ in rows if m})
            _USER_FRAMEWORKS.clear()
            _USER_FRAMEWORKS.update({u: (h is not False, d is not False) for u, _, h, d in rows if h is False or d is False})
        finally:
            db.close()
    except Exception as e:
        print(f"[hooks] mode refresh failed: {e}")


def _maybe_refresh() -> None:
    """Serverless only: refresh the per-user settings cache lazily, at most every 20 s."""
    if SERVERLESS and time.time() - _LAST_REFRESH > 20:
        _refresh_user_modes_once()


def _refresh_user_modes() -> None:
    while True:
        try:
            db = SessionLocal()
            try:
                rows = db.query(DBUser.user_uuid, DBUser.action_mode, DBUser.hipaa_enabled, DBUser.dpdp_enabled).all()
                _USER_MODES.clear()
                _USER_MODES.update({u: (m or "").upper() for u, m, _, _ in rows if m})
                _USER_FRAMEWORKS.clear()
                _USER_FRAMEWORKS.update({u: (h is not False, d is not False) for u, _, h, d in rows if h is False or d is False})
            finally:
                db.close()
        except Exception as e:
            print(f"[hooks] mode refresh failed: {e}")
        time.sleep(20)


def _frameworks_for(user_id: str) -> tuple:
    """(check_hipaa, check_dpdp) from the user's dashboard toggles; both on unless switched off."""
    _maybe_refresh()
    return _USER_FRAMEWORKS.get(user_id, (True, True))


def _mode_for(user_id: str) -> str:
    mode = (_USER_MODES.get(user_id) or config.PII_ACTION_MODE or "HASH").upper()
    return mode if mode in ("REDACT", "HASH", "BLOCK", "LOG_ONLY") else "HASH"


# The hook contract sends tool_risk (low/medium/high) on every tool call.
TOOL_RISK_THRESHOLDS = {"low": 20, "medium": 50, "high": 80}

# Prompt-injection phrases (poisoned RAG chunks, tool results, hostile users). Matching lines are removed.
INJECTION_PATTERNS = re.compile(
    r"[^\n]*(?:ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|disregard\s+(?:all\s+)?(?:previous|prior|above)"
    r"|forget\s+(?:all\s+)?(?:previous|prior)\s+instructions|you\s+are\s+now\s+(?:in\s+)?(?:developer|dan|jailbreak)"
    r"|reveal\s+(?:your\s+)?system\s+prompt)[^\n]*",
    re.IGNORECASE,
)
INJECTION_PLACEHOLDER = "[REMOVED: prompt-injection attempt blocked by governance]"


def _scrub_injection(text: str):
    return INJECTION_PATTERNS.subn(INJECTION_PLACEHOLDER, text)


# --------------------------------------------------------------------------- #
# In-memory authority state (hot path)
# --------------------------------------------------------------------------- #

class _AgentState:
    __slots__ = ("name", "parent", "score", "ceiling")

    def __init__(self, name: str, parent: Optional[str]):
        self.name, self.parent = name, parent
        self.score, self.ceiling = 100, 100


class _SessionState:
    def __init__(self):
        self.agents: Dict[str, _AgentState] = {}
        self.lock = threading.Lock()
        self.name_parts: set = set()   # name words already detected in this session (first names, surnames)


_SESSIONS: "OrderedDict[str, _SessionState]" = OrderedDict()
_SESSIONS_LOCK = threading.Lock()
_MAX_SESSIONS = 2000


def _session_state(session_id: str) -> _SessionState:
    with _SESSIONS_LOCK:
        st = _SESSIONS.get(session_id)
        if st is None:
            st = _SESSIONS[session_id] = _SessionState()
            while len(_SESSIONS) > _MAX_SESSIONS:
                _SESSIONS.popitem(last=False)
        return st


def _agent_state(st: _SessionState, agent_id: str, parent_id: Optional[str]) -> _AgentState:
    if parent_id and parent_id not in st.agents:
        st.agents[parent_id] = _AgentState(parent_id, None)
    ag = st.agents.get(agent_id)
    if ag is None:
        ag = st.agents[agent_id] = _AgentState(agent_id, parent_id)
    elif parent_id and not ag.parent:
        ag.parent = parent_id
    return ag


def _effective_score(st: _SessionState, ag: _AgentState) -> int:
    """Delegation cap: effective(agent) = min(own, effective(parent))."""
    score, seen, cur = ag.score, {ag.name}, ag
    while cur.parent and cur.parent not in seen and cur.parent in st.agents:
        seen.add(cur.parent)
        cur = st.agents[cur.parent]
        score = min(score, cur.score)
    return score


def _penalize(ag: _AgentState, penalty_type: str) -> None:
    """Monotonic reduction (same numbers as authority.penalize_agent)."""
    ag.score = max(0, ag.score + DEFAULT_POLICY["scoring"]["penalties"].get(penalty_type, -10))
    ag.score = min(ag.score, ag.ceiling)


# --------------------------------------------------------------------------- #
# Background persistence
# --------------------------------------------------------------------------- #

def _resolve(db, user_id: str, session_id: str, agent_id: str, parent_agent_id: Optional[str]):
    user = db.query(DBUser).filter(DBUser.user_uuid == user_id).first()
    if user is None:
        user = DBUser(email=f"{user_id}@guardrailbench.local", name=user_id, user_uuid=user_id)
        db.add(user)
        db.flush()

    session = (
        db.query(DBSession)
        .filter(DBSession.user_id == user.id, DBSession.external_id == session_id)
        .first()
    )
    if session is None:
        session = DBSession(user_id=user.id, external_id=session_id)
        db.add(session)
        db.flush()

    def get_agent(name: str, parent_row=None):
        row = db.query(DBAgent).filter(DBAgent.session_id == session.id, DBAgent.agent_name == name).first()
        if row is None:
            row = DBAgent(session_id=session.id, agent_name=name, parent_agent_id=parent_row.id if parent_row else None)
            db.add(row)
            db.flush()
        return row

    parent = get_agent(parent_agent_id) if parent_agent_id else None
    agent = get_agent(agent_id, parent)
    if parent is not None and agent.parent_agent_id is None:
        agent.parent_agent_id = parent.id
        db.flush()
    return user, session, agent


def _persist(job: Dict[str, Any]) -> None:
    ident = Identity(session_external_id=job["session_id"], agent_name=job["agent_id"],
                     parent_agent_name=job["parent_agent_id"])
    event_id = audit_logger.log_event(
        user_id=job["user_id"], user_uuid=job["user_id"], request_id=f"grb_{uuid.uuid4().hex[:8]}",
        action_mode=job.get("mode", ACTION_MODE), matches=job["matches"], latency_ms=job.get("latency_ms", 0.0),
        endpoint=job["endpoint"], model="guardrailbench",
        original_prompt=job["original"], anonymized_prompt=job.get("clean"), vault=job.get("vault"),
        identity=ident, kind=job["kind"], tool_name=job.get("tool_name"), decision=job["decision"],
    )
    if event_id and job.get("usage"):
        audit_logger.set_usage(event_id, job["usage"][0], job["usage"][1], False)

    if job.get("penalties") or job.get("reward"):
        db = SessionLocal()
        try:
            _, session_row, agent = _resolve(db, job["user_id"], job["session_id"], job["agent_id"], job["parent_agent_id"])
            for kind, reason in job.get("penalties", []):
                penalize_agent(db, agent.id, kind, reason, event_id=event_id)
            if job.get("reward"):
                verify_and_reward_tool_result(
                    db, agent.id, pre_authorized=True, input_compliant=True, execution_clean=True,
                    output_compliant=True, event_id=event_id,
                )
            db.commit()
            if event_id:   # authority decision -> its own receipt in the same hash chain
                audit_logger.log_authority_receipt(session_row.id, event_id, agent.id)
        finally:
            db.close()


def _worker(q: "queue.Queue[Dict[str, Any]]") -> None:
    while True:
        job = q.get()
        try:
            _persist(job)
        except Exception as e:  # never let one bad write kill the worker
            print(f"[hooks] persist failed ({job.get('endpoint')}): {e}")
        finally:
            q.task_done()


# Sharded by session so each session's writes stay in order (the receipt hash chain is per session)
# while different sessions are written in parallel.
_SHARDS: List["queue.Queue[Dict[str, Any]]"] = [queue.Queue() for _ in range(8)]
if not SERVERLESS:
    for _i, _q in enumerate(_SHARDS):
        threading.Thread(target=_worker, args=(_q,), daemon=True, name=f"hooks-persist-{_i}").start()


if not SERVERLESS:
    threading.Thread(target=_refresh_user_modes, daemon=True, name="hooks-modes").start()


def _pending() -> int:
    return sum(q.qsize() for q in _SHARDS)


def _enqueue(body, endpoint: str, kind: str, decision: str, original: str, **extra) -> None:
    if kind == "completion" and not (original or "").strip():
        original = "(no text: the model replied with a tool call)"
    job = {
        "user_id": body.user_id, "session_id": body.session_id, "agent_id": body.agent_id,
        "parent_agent_id": body.parent_agent_id, "endpoint": endpoint, "kind": kind,
        "decision": decision, "original": original, "matches": extra.pop("matches", []), **extra,
    }
    if SERVERLESS:   # the instance may freeze right after responding, so write before returning
        try:
            _persist(job)
        except Exception as e:
            print(f"[hooks] persist failed ({endpoint}): {e}")
    else:
        _SHARDS[hash(body.session_id) % len(_SHARDS)].put(job)


# --------------------------------------------------------------------------- #
# Hook payloads
# --------------------------------------------------------------------------- #

class HookIdentity(BaseModel):
    user_id: str
    agent_id: str
    session_id: str
    parent_agent_id: Optional[str] = None


class PromptIn(HookIdentity):
    prompt: str


class CompletionIn(HookIdentity):
    completion: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0


class ToolCallIn(HookIdentity):
    tool_name: str
    tool_args: Dict[str, Any] = {}
    tool_risk: str = "medium"
    agent_allowed_tools: List[str] = []


class ToolResultIn(HookIdentity):
    tool_name: str
    result: str
    tool_succeeded: bool = True
    latency_ms: int = 0


class SessionEndIn(HookIdentity):
    summary: Dict[str, Any] = {}


def _scan(text: str, st: _SessionState, mode: str = "REDACT", frameworks: tuple = (True, True)):
    """
    Apply the action mode to text. Returns (clean_text, matches, vault).
      REDACT   -> [REDACTED_X]            HASH     -> [HASH:ab12cd34] (same value, same tag)
      BLOCK    -> whole text replaced     LOG_ONLY -> text unchanged, findings still recorded
    Session name memory: once a person's name is detected, each of its words is also masked
    everywhere else in this session ("Margaret" alone later in a reply), which NER often misses.
    """
    vault = PIISessionVault()
    detect_mode = "HASH" if mode == "HASH" else ("LOG_ONLY" if mode == "LOG_ONLY" else "REDACT")
    clean, matches = anonymizer.process_text(text, vault, mode=detect_mode, aggressive_names=True,
                                             check_hipaa=frameworks[0], check_dpdp=frameworks[1])
    for m in matches:
        if m.entity_type == "NAME":
            for word in re.findall(r"[A-Za-z]{3,}", m.text):
                if word.lower() not in detector.NAME_STOP:
                    st.name_parts.add(word)
    if st.name_parts and mode != "LOG_ONLY":
        pattern = re.compile(r"\b(?:" + "|".join(re.escape(w) for w in sorted(st.name_parts)) + r")\b", re.IGNORECASE)
        def mask(m):
            return f"[HASH:{hashlib.sha256(m.group(0).lower().encode()).hexdigest()[:8]}]" if mode == "HASH" else "[REDACTED_NAME]"
        clean, extra = pattern.subn(mask, clean)
        if extra and not any(m.entity_type == "NAME" for m in matches):
            # something slipped past detection; record it as a finding so it shows on the dashboard
            from pii_proxy.pii_detector import PIIMatch
            matches = list(matches) + [PIIMatch("NAME", 1, "Names", 0, 0, "(remembered name)", 0.8)]
    if mode == "BLOCK" and matches:
        clean = BLOCK_MESSAGE
    return clean, matches, vault


def _decision(mode: str, matches) -> str:
    if not matches or mode == "LOG_ONLY":
        return "allow"
    return "block" if mode == "BLOCK" else "redact"


# --------------------------------------------------------------------------- #
# The five hooks
# --------------------------------------------------------------------------- #

@router.post("/api/v1/on_prompt_received")
def on_prompt_received(body: PromptIn):
    st = _session_state(body.session_id)
    penalties = []
    with st.lock:
        ag = _agent_state(st, body.agent_id, body.parent_agent_id)
        text, injections = _scrub_injection(body.prompt)
        if injections:
            _penalize(ag, "prompt_injection")
            penalties.append(("prompt_injection", f"{injections} injection attempt(s) in prompt"))
    # PII the user typed is the user's violation (recorded on the event), not the agent's.
    mode = _mode_for(body.user_id)
    clean, matches, vault = _scan(text, st, mode, _frameworks_for(body.user_id))
    decision = _decision(mode, matches)
    if injections and decision == "allow":
        decision = "redact"
    _enqueue(body, "/api/v1/on_prompt_received", "prompt", decision,
             body.prompt, matches=matches, clean=clean, vault=vault, penalties=penalties, mode=mode)
    return {"prompt": clean}


@router.post("/api/v1/on_completion_received")
def on_completion_received(body: CompletionIn):
    st = _session_state(body.session_id)
    mode = _mode_for(body.user_id)
    clean, matches, vault = _scan(body.completion, st, mode, _frameworks_for(body.user_id))
    penalties, decision = [], _decision(mode, matches)
    with st.lock:
        ag = _agent_state(st, body.agent_id, body.parent_agent_id)
        if matches:
            kind = "compliance_block" if mode == "BLOCK" else "compliance_redaction"
            _penalize(ag, kind)
            penalties.append((kind, f"PII in completion: {len(matches)} item(s)"))
        # Top-level agent output goes to the user: roll per-agent scores up into a verdict.
        if body.parent_agent_id is None:
            ok, verdict = evaluate_verdict({a.name: a.score for a in st.agents.values()})
            if not ok:
                clean, decision = verdict, "block"
        else:
            # Handoff gate: a sub-agent whose own score has collapsed does not get its reply passed on to the delegating agent
            floor = DEFAULT_POLICY["scoring"]["session_block_threshold"]
            if ag.score < floor:
                clean = (f"output blocked: agent '{ag.name}' trust score degraded to {ag.score} < {floor}; "
                         f"its reply was not passed on")
                decision = "block"
    _enqueue(body, "/api/v1/on_completion_received", "completion", decision, body.completion,
             matches=matches, clean=clean, vault=vault, penalties=penalties, mode=mode,
             latency_ms=float(body.latency_ms), usage=(body.prompt_tokens, body.completion_tokens))
    return {"completion": clean}


@router.post("/api/v1/on_tool_call")
def on_tool_call(body: ToolCallIn):
    st = _session_state(body.session_id)
    args_text = json.dumps(body.tool_args, default=str)
    penalties = []
    with st.lock:
        ag = _agent_state(st, body.agent_id, body.parent_agent_id)
        if body.tool_name not in body.agent_allowed_tools:
            _penalize(ag, "out_of_scope")
            penalties.append(("out_of_scope", f"'{body.tool_name}' not in this agent's allowed tools"))
            allowed = False
        else:
            threshold = TOOL_RISK_THRESHOLDS.get(body.tool_risk, 50)
            current = _effective_score(st, ag)
            allowed = current >= threshold
            if not allowed:
                _penalize(ag, "denied_attempt")
                penalties.append(("denied_attempt", f"{body.tool_name}: score {current} < required {threshold}"))
    mode = _mode_for(body.user_id)
    clean_args, matches, _ = _scan(args_text, st, mode, _frameworks_for(body.user_id))
    if allowed and matches and mode == "BLOCK":
        # BLOCK mode: a tool call carrying protected identifiers does not run
        allowed = False
        with st.lock:
            _penalize(_agent_state(st, body.agent_id, body.parent_agent_id), "compliance_block")
        penalties.append(("compliance_block", f"{body.tool_name}: protected identifiers in arguments"))
    _enqueue(body, "/api/v1/on_tool_call", "tool_call", "allow" if allowed else "deny", args_text,
             matches=matches, clean=clean_args, tool_name=body.tool_name, penalties=penalties, mode=mode)
    return {"allow": allowed}


@router.post("/api/v1/on_tool_result")
def on_tool_result(body: ToolResultIn):
    st = _session_state(body.session_id)
    text, injections = _scrub_injection(body.result)
    mode = _mode_for(body.user_id)
    clean, matches, vault = _scan(text, st, mode, _frameworks_for(body.user_id))
    penalties, reward = [], False
    with st.lock:
        ag = _agent_state(st, body.agent_id, body.parent_agent_id)
        if injections:
            _penalize(ag, "prompt_injection")
            penalties.append(("prompt_injection", f"Injection attempt in result of {body.tool_name}"))
        # PII inside a tool result is data the agent merely received: redacted and the reward is
        # withheld, but the agent is only penalised for what it emits (completions).
        elif body.tool_succeeded and not matches:
            reward = True
            ag.score = min(ag.ceiling, ag.score + DEFAULT_POLICY["scoring"]["clean_tool_reward"])
    decision = _decision(mode, matches)
    if injections and decision == "allow":
        decision = "redact"
    _enqueue(body, "/api/v1/on_tool_result", "tool_result", decision,
             body.result, matches=matches, clean=clean, vault=vault, tool_name=body.tool_name,
             penalties=penalties, reward=reward, latency_ms=float(body.latency_ms), mode=mode)
    return {"result": clean}


@router.post("/api/v1/on_session_end")
def on_session_end(body: SessionEndIn):
    _enqueue(body, "/api/v1/on_session_end", "final_output", "allow",
             json.dumps(body.summary, default=str))
    with _SESSIONS_LOCK:
        _SESSIONS.pop(body.session_id, None)
    return {"status": "recorded"}


@router.get("/api/v1/hooks_status")
def hooks_status():
    """Debug: persistence backlog and live sessions held in memory."""
    return {"pending_writes": _pending(), "live_sessions": len(_SESSIONS)}
