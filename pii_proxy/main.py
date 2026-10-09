import time
import json
import math
import os
import uuid
import httpx
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from typing import List, Dict, Any, Optional

from pii_proxy.config import config
from pii_proxy.pii_detector import PIIDetector
from pii_proxy.anonymizer import PIIAnonymizer, PIISessionVault
from pii_proxy.audit import audit_logger
from pii_proxy.auth import get_claims, get_current_user, require_admin, assert_owner_or_admin
from pii_proxy.context import identity_from_request, Identity
from pii_proxy.db import init_db, SessionLocal, DBUser, DBSession, DBAgent, DBEvent, DBPIIFinding, DBCategory, DBScoreLedger
from pii_proxy.authority import (
    user_session_scores,
    evaluate_verdict,
    get_agent_score,
    penalize_agent,
    authorize_tool_call,
    verify_and_reward_tool_result,
    check_session_verdict
)

app = FastAPI(title="PII Data Anonymization Governance Proxy Platform", version="2.0.0")

# GuardRailBench calls these five endpoints directly (its own protocol, separate
# from our /v1/chat/completions proxy). Served on the same port as everything else.
from pii_proxy.hooks_server import router as guardrailbench_hooks_router
app.include_router(guardrailbench_hooks_router)

# Enable CORS for React Frontend (Vite) & all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Ensure database tables exist in Neon PostgreSQL on startup."""
    try:
        init_db()
    except Exception as e:
        print(f"Warning initializing DB: {e}")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path not in ["/api/stats", "/api/audit-receipts", "/health"] and not request.url.path.startswith("/api/users"):
        print(f"📥 [PROXY INGRESS] {request.method} {request.url.path}")
    response = await call_next(request)
    return response

# Setup templates directory
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

# Global singleton detector & anonymizer
detector = PIIDetector()
anonymizer = PIIAnonymizer(detector=detector)

class TestInspectRequest(BaseModel):
    prompt: str
    mode: Optional[str] = "HASH"
    user_id: Optional[str] = "user_demo"
    check_hipaa: Optional[bool] = None
    check_dpdp: Optional[bool] = None
    direction: Optional[str] = "ingress"

class UserSyncRequest(BaseModel):
    clerk_user_id: str
    email: Optional[str] = None
    name: Optional[str] = None

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"❌ Unhandled exception on {request.url.path}: {exc}")
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)}
    )

# The built React dashboard (run `npm run build` in frontend/ to produce this).
def _resolve_frontend_dist():
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"),
        os.path.join(os.getcwd(), "frontend", "dist"),
        os.path.join(os.path.dirname(__file__), "frontend", "dist"),
        os.path.join("/var/task", "frontend", "dist"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return candidates[0]

FRONTEND_DIST = _resolve_frontend_dist()
FRONTEND_INDEX = os.path.join(FRONTEND_DIST, "index.html")
FRONTEND_ASSETS = os.path.join(FRONTEND_DIST, "assets")

if os.path.isdir(FRONTEND_ASSETS):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="frontend-assets")

@app.get("/assets/{file_path:path}")
async def serve_static_asset(file_path: str):
    dist_dir = _resolve_frontend_dist()
    asset_file = os.path.join(dist_dir, "assets", file_path)
    if os.path.isfile(asset_file):
        from fastapi.responses import FileResponse
        return FileResponse(asset_file)
    raise HTTPException(status_code=404, detail="Asset not found")

@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
@app.api_route("/overview", methods=["GET", "HEAD"], response_class=HTMLResponse)
@app.api_route("/activity", methods=["GET", "HEAD"], response_class=HTMLResponse)
@app.api_route("/users", methods=["GET", "HEAD"], response_class=HTMLResponse)
@app.api_route("/user", methods=["GET", "HEAD"], response_class=HTMLResponse)
@app.api_route("/trust", methods=["GET", "HEAD"], response_class=HTMLResponse)
@app.api_route("/test", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def render_dashboard(request: Request):
    """Serve the complete dashboard with 3-method AI benchmark sandbox and initial loader state."""
    clerk_pub_key = os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_ZHJpdmVuLWNsYW0tOTMwNi5jbGVyay5hY2NvdW50cy5kZXYk")
    clerk_js = os.getenv("CLERK_FRONTEND_API_URL", "https://driven-clam-9306.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js")
    
    current_dist = _resolve_frontend_dist()
    index_file = os.path.join(current_dist, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "clerk_publishable_key": clerk_pub_key,
            "clerk_js_url": clerk_js
        }
    )

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "upstream_base_url": config.UPSTREAM_BASE_URL,
        "default_model_id": config.DEFAULT_MODEL_ID,
        "pii_action_mode": config.PII_ACTION_MODE
    }

@app.get("/api/me")
async def get_me(user: DBUser = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "user_uuid": user.user_uuid,
        "role": user.role,
        "action_mode": user.action_mode,
        "hipaa_enabled": user.hipaa_enabled if user.hipaa_enabled is not None else True,
        "dpdp_enabled": user.dpdp_enabled if user.dpdp_enabled is not None else True,
    }

def _sessions_summary(db, user_uuid: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    q = (
        db.query(
            DBSession.id,
            DBSession.external_id,
            DBSession.started_at,
            DBSession.last_seen_at,
            DBUser.user_uuid,
            DBUser.email,
            func.count(DBEvent.id).label("requests"),
            func.count(DBEvent.id).filter((DBEvent.pii_count > 0) | (DBEvent.decision == "deny")).label("violations"),
            func.coalesce(func.sum(DBEvent.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(DBEvent.completion_tokens), 0).label("completion_tokens"),
        )
        .join(DBUser, DBUser.id == DBSession.user_id)
        .outerjoin(DBEvent, DBEvent.session_id == DBSession.id)
    )
    if user_uuid:
        q = q.filter(DBUser.user_uuid == user_uuid)
    rows = q.group_by(DBSession.id, DBUser.id).order_by(DBSession.last_seen_at.desc()).limit(limit).all()
    session_ids = [r.id for r in rows]
    agent_counts = {}
    if session_ids:
        agent_counts = dict(
            db.query(DBAgent.session_id, func.count(DBAgent.id))
            .filter(DBAgent.session_id.in_(session_ids))
            .group_by(DBAgent.session_id)
            .all()
        )
    return [
        {
            "session_id": r.id,
            "external_id": r.external_id,
            "user_uuid": r.user_uuid,
            "user_email": r.email,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
            "requests": r.requests,
            "violations": r.violations,
            "agents": agent_counts.get(r.id, 0),
            "prompt_tokens": int(r.prompt_tokens),
            "completion_tokens": int(r.completion_tokens),
            "total_tokens": int(r.prompt_tokens + r.completion_tokens),
        }
        for r in rows
    ]

@app.get("/api/users/{user_uuid}/sessions")
async def user_sessions(user_uuid: str, user: DBUser = Depends(get_current_user)):
    assert_owner_or_admin(user, user_uuid)
    db = SessionLocal()
    try:
        return _sessions_summary(db, user_uuid)
    finally:
        db.close()

@app.get("/api/admin/sessions")
async def admin_sessions(admin: DBUser = Depends(require_admin)):
    db = SessionLocal()
    try:
        return _sessions_summary(db)
    finally:
        db.close()

@app.get("/api/sessions/{session_id}/agents")
async def session_agents(session_id: str, user: DBUser = Depends(get_current_user)):
    db = SessionLocal()
    try:
        row = (
            db.query(DBSession, DBUser)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .filter(DBSession.id == session_id)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="session not found")
        _, owner = row
        assert_owner_or_admin(user, owner.user_uuid)

        agents = db.query(DBAgent).filter(DBAgent.session_id == session_id).order_by(DBAgent.created_at).all()
        names = {a.id: a.agent_name for a in agents}
        requests = dict(
            db.query(DBEvent.agent_id, func.count(DBEvent.id))
            .filter(DBEvent.session_id == session_id)
            .group_by(DBEvent.agent_id)
            .all()
        )
        violations = dict(
            db.query(DBEvent.agent_id, func.count(DBEvent.id))
            .filter(DBEvent.session_id == session_id, DBEvent.pii_count > 0)
            .group_by(DBEvent.agent_id)
            .all()
        )
        return [
            {
                "agent_name": a.agent_name,
                "parent_agent_name": names.get(a.parent_agent_id),
                "initial_score": a.initial_score,
                "requests": requests.get(a.id, 0),
                "violations": violations.get(a.id, 0),
            }
            for a in agents
        ]
    finally:
        db.close()

@app.get("/api/admin/users")
async def admin_list_users(admin: DBUser = Depends(require_admin)):
    """All users with request counts. A violation is an event where PII was redacted or blocked."""
    db = SessionLocal()
    try:
        rows = (
            db.query(
                DBUser.id,
                DBUser.user_uuid,
                DBUser.email,
                DBUser.name,
                DBUser.role,
                DBUser.action_mode,
                DBUser.hipaa_enabled,
                DBUser.dpdp_enabled,
                DBUser.created_at,
                func.count(DBEvent.id).label("requests"),
                func.coalesce(func.sum(DBEvent.pii_count), 0).label("pii_detected"),
                func.count(DBEvent.id).filter(DBEvent.pii_count > 0).label("violations"),
                func.max(DBEvent.created_at).label("last_active"),
            )
            .outerjoin(DBSession, DBSession.user_id == DBUser.id)
            .outerjoin(DBEvent, DBEvent.session_id == DBSession.id)
            .group_by(DBUser.id)
            .order_by(DBUser.created_at.desc())
            .all()
        )
        top_rows = (
            db.query(DBSession.user_id, DBCategory.name, func.count(DBPIIFinding.id))
            .join(DBEvent, DBEvent.session_id == DBSession.id)
            .join(DBPIIFinding, DBPIIFinding.event_id == DBEvent.id)
            .join(DBCategory, DBCategory.id == DBPIIFinding.category_id)
            .group_by(DBSession.user_id, DBCategory.name)
            .all()
        )
        top_by_user: Dict[str, tuple] = {}
        for user_id, cat_name, n in top_rows:
            if user_id not in top_by_user or n > top_by_user[user_id][1]:
                top_by_user[user_id] = (cat_name, n)
        return [
            {
                "user_uuid": r.user_uuid,
                "email": r.email,
                "name": r.name,
                "role": r.role,
                "action_mode": r.action_mode or config.PII_ACTION_MODE,
                "hipaa_enabled": r.hipaa_enabled if r.hipaa_enabled is not None else True,
                "dpdp_enabled": r.dpdp_enabled if r.dpdp_enabled is not None else True,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "last_active": r.last_active.isoformat() if r.last_active else None,
                "requests": r.requests,
                "pii_detected": int(r.pii_detected),
                "violations": r.violations,
                "top_category": top_by_user.get(r.id, (None, 0))[0],
            }
            for r in rows
        ]
    finally:
        db.close()

@app.get("/api/admin/activity")
async def admin_activity(limit: int = 50, violations_only: bool = False, admin: DBUser = Depends(require_admin)):
    """Most recent events across all users, newest first. violations_only keeps redact and block."""
    db = SessionLocal()
    try:
        q = (
            db.query(DBEvent, DBUser, DBSession.external_id, DBAgent.agent_name)
            .join(DBSession, DBSession.id == DBEvent.session_id)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .outerjoin(DBAgent, DBAgent.id == DBEvent.agent_id)
        )
        if violations_only:
            q = q.filter(DBEvent.decision.in_(["redact", "block", "deny"]))
        rows = q.order_by(DBEvent.created_at.desc()).limit(limit).all()
        event_ids = [e.id for e, _, _, _ in rows]
        cats: Dict[str, set] = {}
        if event_ids:
            for event_id, cat_name in (
                db.query(DBPIIFinding.event_id, DBCategory.name)
                .join(DBCategory, DBCategory.id == DBPIIFinding.category_id)
                .filter(DBPIIFinding.event_id.in_(event_ids))
                .all()
            ):
                cats.setdefault(event_id, set()).add(cat_name)
        return [
            {
                "event_id": e.id,
                "session_id": e.session_id,
                "session_external_id": ext,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "user_email": u.email,
                "user_uuid": u.user_uuid,
                "decision": "hash" if (e.action_mode == "HASH" and e.decision != "allow") else e.decision,
                "kind": e.kind,
                "tool_name": e.tool_name,
                "agent_name": agent_name,
                "original_text": e.original_text,
                "prompt_tokens": e.prompt_tokens,
                "completion_tokens": e.completion_tokens,
                "action_mode": e.action_mode,
                "pii_count": e.pii_count,
                "categories_found": sorted(cats.get(e.id, set())),
                "anonymized_prompt": e.anonymized_text,
                "latency_ms": e.latency_ms,
            }
            for e, u, ext, agent_name in rows
        ]
    finally:
        db.close()

class UserActionModeRequest(BaseModel):
    mode: Optional[str] = None

VALID_MODES = {"REDACT", "BLOCK", "HASH", "LOG_ONLY"}

@app.put("/api/users/{user_uuid}/action-mode")
async def set_user_action_mode(user_uuid: str, req: UserActionModeRequest, user: DBUser = Depends(get_current_user)):
    """Set how this user's PII is handled. Admin only can set the Governance method."""
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin only: Only administrators have authority to configure user governance / PII action mode."
        )
    mode = req.mode.upper() if req.mode else None
    if mode is not None and mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"mode must be one of {sorted(VALID_MODES)} or null")
    db = SessionLocal()
    try:
        target = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
        if target is None:
            raise HTTPException(status_code=404, detail="user not found")
        target.action_mode = mode or "HASH"
        db.commit()
        return {"user_uuid": user_uuid, "action_mode": target.action_mode, "is_default": mode is None}
    finally:
        db.close()

class UserComplianceRequest(BaseModel):
    hipaa_enabled: Optional[bool] = None
    dpdp_enabled: Optional[bool] = None

@app.get("/api/users/{user_uuid}/compliance")
async def get_user_compliance(user_uuid: str, user: DBUser = Depends(get_current_user)):
    """Fetch active compliance frameworks (HIPAA / DPDP) for user."""
    assert_owner_or_admin(user, user_uuid)
    db = SessionLocal()
    try:
        target = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
        if target is None:
            raise HTTPException(status_code=404, detail="user not found")
        return {
            "user_uuid": user_uuid,
            "hipaa_enabled": target.hipaa_enabled if target.hipaa_enabled is not None else True,
            "dpdp_enabled": target.dpdp_enabled if target.dpdp_enabled is not None else True,
        }
    finally:
        db.close()

@app.put("/api/users/{user_uuid}/compliance")
async def set_user_compliance(user_uuid: str, req: UserComplianceRequest, user: DBUser = Depends(get_current_user)):
    """Update active compliance frameworks (HIPAA / DPDP) for user. Admin only."""
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin only: Only administrators have authority to configure compliance policies."
        )
    db = SessionLocal()
    try:
        target = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
        if target is None:
            raise HTTPException(status_code=404, detail="user not found")
        if req.hipaa_enabled is not None:
            target.hipaa_enabled = req.hipaa_enabled
        if req.dpdp_enabled is not None:
            target.dpdp_enabled = req.dpdp_enabled
        db.commit()
        return {
            "user_uuid": user_uuid,
            "hipaa_enabled": target.hipaa_enabled if target.hipaa_enabled is not None else True,
            "dpdp_enabled": target.dpdp_enabled if target.dpdp_enabled is not None else True,
        }
    finally:
        db.close()

def _event_label(e, agent, names, seen_prompt) -> str:
    """Human label for what this event is: user request, agent response, tool call, tool result ..."""
    tool = f" · {e.tool_name}" if e.tool_name else ""
    if e.kind == "prompt":
        key = e.agent_id
        first = key not in seen_prompt
        seen_prompt.add(key)
        if first:
            parent = names.get(agent.parent_agent_id) if agent and agent.parent_agent_id else None
            return f"Task from {parent}" if parent else "User request"
        return "Input (tool / agent result)"
    return {
        "completion": "Agent response",
        "tool_call": f"Tool call{tool}",
        "tool_result": f"Tool result{tool}",
        "final_output": "Session summary",
    }.get(e.kind, e.kind or "")


def _event_row(e, findings, session_ext, agent_name, owner_uuid):
    decision = "hash" if (e.action_mode == "HASH" and e.decision != "allow") else e.decision
    cats = sorted({cat for _, cat, _ in findings})
    reason = None
    egress_count = getattr(e, "egress_pii_count", 0) or 0
    if decision == "allow":
        if egress_count > 0:
            reason = f"Prompt clean ({e.prompt_tokens or 0} in-tokens). Model output intercepted with {egress_count} compliance finding(s) ({e.completion_tokens or 0} out-tokens counted, no user score penalty)."
        elif not findings:
            reason = "No PII found, sent as-is."
        else:
            reason = "Sent as-is under log-only policy."
    elif decision == "block":
        reason = f"Blocked by policy: {e.pii_count} PII item(s) found in prompt ({', '.join(cats)})."
    elif decision == "hash":
        reason = f"Hashed {e.pii_count} PII item(s) in prompt with SHA-256: {', '.join(cats)}."
    elif decision == "redact":
        reason = f"Redacted {e.pii_count} PII item(s) in prompt: {', '.join(cats)}."
    return {
        "event_id": e.id,
        "session_id": e.session_id,
        "session_external_id": session_ext,
        "user_uuid": owner_uuid,
        "agent_name": agent_name,
        "kind": e.kind,
        "tool_name": e.tool_name,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "model": e.model,
        "action_mode": e.action_mode,
        "decision": decision,
        "reason": reason,
        "pii_count": e.pii_count,
        "categories_found": cats,
        "latency_ms": e.latency_ms,
        "prompt_tokens": e.prompt_tokens,
        "completion_tokens": e.completion_tokens,
        "tokens_estimated": e.tokens_estimated,
        "original_text": e.original_text,
        "anonymized_text": e.anonymized_text,
        "original_response": getattr(e, "original_response", None),
        "anonymized_response": getattr(e, "anonymized_response", None),
        "egress_pii_count": getattr(e, "egress_pii_count", 0),
        "findings": [
            {
                "entity_type": f.entity_type,
                "category": cat,
                "placeholder": f.placeholder,
                "confidence": f.confidence,
                "direction": getattr(f, "direction", "ingress") or "ingress"
            }
            for f, cat, _ in findings
        ],
    }

def _findings_for(db, event_ids):
    out = {}
    if not event_ids:
        return out
    for f, cat in (
        db.query(DBPIIFinding, DBCategory)
        .join(DBCategory, DBCategory.id == DBPIIFinding.category_id)
        .filter(DBPIIFinding.event_id.in_(event_ids))
        .all()
    ):
        out.setdefault(f.event_id, []).append((f, cat.name, cat.id))
    return out

@app.get("/api/events/{event_id}")
async def get_event(event_id: str, user: DBUser = Depends(get_current_user)):
    """One request: before and after text, the decision and its reason, and tokens."""
    db = SessionLocal()
    try:
        row = (
            db.query(DBEvent, DBSession, DBUser, DBAgent)
            .join(DBSession, DBSession.id == DBEvent.session_id)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .outerjoin(DBAgent, DBAgent.id == DBEvent.agent_id)
            .filter(DBEvent.id == event_id)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="event not found")
        e, session_row, owner, agent = row
        assert_owner_or_admin(user, owner.user_uuid)
        findings = _findings_for(db, [e.id]).get(e.id, [])
        out = _event_row(e, findings, session_row.external_id, agent.agent_name if agent else None, owner.user_uuid)
        names = {a.id: a.agent_name for a in db.query(DBAgent).filter(DBAgent.session_id == e.session_id).all()}
        earlier_prompt = (
            db.query(DBEvent.id)
            .filter(DBEvent.session_id == e.session_id, DBEvent.agent_id == e.agent_id,
                    DBEvent.kind == "prompt", DBEvent.created_at < e.created_at)
            .first()
        )
        out["label"] = _event_label(e, agent, names, {e.agent_id} if earlier_prompt else set())
        return out
    finally:
        db.close()

@app.get("/api/sessions/{session_id}/agent-scores")
async def session_agents(session_id: str, user: DBUser = Depends(get_current_user)):
    """Per-agent view of one session: score trend, effective score (delegation cap), denied calls, violations, verdict."""
    db = SessionLocal()
    try:
        row = (
            db.query(DBSession, DBUser)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .filter(DBSession.id == session_id)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="session not found")
        assert_owner_or_admin(user, row[1].user_uuid)

        agents = db.query(DBAgent).filter(DBAgent.session_id == session_id).order_by(DBAgent.created_at.asc()).all()
        ids = [a.id for a in agents]
        ledger = (
            db.query(DBScoreLedger).filter(DBScoreLedger.agent_id.in_(ids)).order_by(DBScoreLedger.created_at.asc()).all()
            if ids else []
        )
        counts: Dict[str, Dict[str, int]] = {a.id: {"tool_calls": 0, "denied_calls": 0, "violations": 0, "events": 0} for a in agents}
        for agent_id, kind, decision, n in (
            db.query(DBEvent.agent_id, DBEvent.kind, DBEvent.decision, func.count(DBEvent.id))
            .filter(DBEvent.session_id == session_id)
            .group_by(DBEvent.agent_id, DBEvent.kind, DBEvent.decision)
            .all()
        ):
            c = counts.get(agent_id)
            if c is None:
                continue
            c["events"] += n
            if kind != "final_output":
                c["real"] = c.get("real", 0) + n
            if kind == "tool_call":
                c["tool_calls"] += n
                if decision == "deny":
                    c["denied_calls"] += n
            if decision in ("redact", "block"):
                c["violations"] += n

        by_agent: Dict[str, List[Any]] = {a.id: [] for a in agents}
        for l in ledger:
            by_agent[l.agent_id].append(l)

        # the bench reports session-end under a pseudo agent (e.g. multi_agent_graph); it is not an agent
        agents = [a for a in agents if counts[a.id].get("real") or by_agent[a.id]]
        out, own = [], {}
        for a in agents:
            score, trend = a.initial_score, [{"t": a.created_at.isoformat() if a.created_at else None, "score": a.initial_score, "delta": 0, "reason": "start"}]
            for l in by_agent[a.id]:
                score = max(0, min(a.ceiling, score + l.delta))
                trend.append({"t": l.created_at.isoformat() if l.created_at else None, "score": score, "delta": l.delta, "reason": l.reason})
            own[a.id] = score
            out.append({"agent_id": a.id, "agent_name": a.agent_name, "parent_agent_id": a.parent_agent_id,
                        "score": score, "trend": trend,
                        **{k: v for k, v in counts[a.id].items() if k != "real"}})
        by_id = {a.id: a for a in agents}
        for item in out:  # delegation cap: effective = min(own, parent's effective)
            eff, cur, seen = item["score"], by_id[item["agent_id"]], set()
            while cur.parent_agent_id and cur.parent_agent_id in own and cur.parent_agent_id not in seen:
                seen.add(cur.parent_agent_id)
                eff = min(eff, own[cur.parent_agent_id])
                cur = by_id[cur.parent_agent_id]
            item["effective_score"] = eff
            item["parent_agent_name"] = by_id[item["parent_agent_id"]].agent_name if item["parent_agent_id"] in by_id else None
        ok, reason = evaluate_verdict({a.agent_name: own[a.id] for a in agents})
        return {"verdict": {"allowed": ok, "reason": reason}, "agents": out}
    finally:
        db.close()


@app.get("/api/sessions/{session_id}/events")
async def session_events(session_id: str, user: DBUser = Depends(get_current_user)):
    """All requests in one session, oldest first."""
    db = SessionLocal()
    try:
        row = (
            db.query(DBSession, DBUser)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .filter(DBSession.id == session_id)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="session not found")
        session_row, owner = row
        assert_owner_or_admin(user, owner.user_uuid)
        events = (
            db.query(DBEvent, DBAgent)
            .outerjoin(DBAgent, DBAgent.id == DBEvent.agent_id)
            .filter(DBEvent.session_id == session_id)
            .order_by(DBEvent.created_at.asc())
            .all()
        )
        findings = _findings_for(db, [e.id for e, _ in events])
        names = {a.id: a.agent_name for a in db.query(DBAgent).filter(DBAgent.session_id == session_id).all()}
        seen_prompt = set()
        out = []
        for e, a in events:
            row = _event_row(e, findings.get(e.id, []), session_row.external_id, a.agent_name if a else None, owner.user_uuid)
            row["label"] = _event_label(e, a, names, seen_prompt)
            out.append(row)
        return out
    finally:
        db.close()

@app.get("/api/users/{user_uuid}/tokens")
async def user_tokens(user_uuid: str, user: DBUser = Depends(get_current_user)):
    """Token totals: the latest session, and averages across all sessions."""
    assert_owner_or_admin(user, user_uuid)
    db = SessionLocal()
    try:
        per_session = (
            db.query(
                DBSession.id,
                DBSession.external_id,
                DBSession.last_seen_at,
                func.coalesce(func.sum(DBEvent.prompt_tokens), 0),
                func.coalesce(func.sum(DBEvent.completion_tokens), 0),
                func.count(DBEvent.id),
            )
            .join(DBUser, DBUser.id == DBSession.user_id)
            .outerjoin(DBEvent, DBEvent.session_id == DBSession.id)
            .filter(DBUser.user_uuid == user_uuid)
            .group_by(DBSession.id)
            .order_by(DBSession.last_seen_at.desc())
            .all()
        )
        sessions = [
            {
                "session_id": sid,
                "external_id": ext,
                "prompt_tokens": int(p),
                "completion_tokens": int(c),
                "total_tokens": int(p) + int(c),
                "requests": int(n),
            }
            for sid, ext, _, p, c, n in per_session
        ]
        total_tokens = sum(s["total_tokens"] for s in sessions)
        total_requests = sum(s["requests"] for s in sessions)
        n_sessions = len(sessions)
        return {
            "latest_session": sessions[0] if sessions else None,
            "average_tokens_per_session": round(total_tokens / n_sessions, 1) if n_sessions else 0,
            "average_tokens_per_request": round(total_tokens / total_requests, 1) if total_requests else 0,
            "total_tokens": total_tokens,
            "total_requests": total_requests,
        }
    finally:
        db.close()

@app.get("/api/users/{user_uuid}/daily")
async def user_daily(user_uuid: str, days: int = 14, user: DBUser = Depends(get_current_user)):
    """Requests and violations per day for one user (owner or admin)."""
    assert_owner_or_admin(user, user_uuid)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    db = SessionLocal()
    try:
        day = func.date(DBEvent.created_at)
        rows = (
            db.query(
                day.label("day"),
                func.count(DBEvent.id),
                func.count(DBEvent.id).filter(DBEvent.pii_count > 0),
            )
            .join(DBSession, DBSession.id == DBEvent.session_id)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .filter(DBUser.user_uuid == user_uuid, DBEvent.created_at >= since)
            .group_by(day)
            .order_by(day)
            .all()
        )
        return [{"day": str(d), "requests": r, "violations": v} for d, r, v in rows]
    finally:
        db.close()

RATING_PRIOR_REQUESTS = 5  # virtual clean requests that smooth small samples


@app.post("/api/admin/users/{user_uuid}/reset-rating")
async def admin_reset_rating(user_uuid: str, admin: DBUser = Depends(require_admin)):
    """Admin only. History is kept; the user's rating (violations, trust, effective use) counts from now."""
    db = SessionLocal()
    try:
        target = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        target.rating_reset_at = datetime.now(timezone.utc)
        db.commit()
        return {"user_uuid": user_uuid, "rating_reset_at": target.rating_reset_at.isoformat(), "reset_by": admin.email}
    finally:
        db.close()


def get_finding_severity(entity_type: str) -> str:
    """Returns 'critical', 'high', 'medium', or 'low' based on entity type."""
    ent = (entity_type or "").upper()
    if any(k in ent for k in [
        "MRN", "HEALTH", "MEDICAL", "BIOMETRIC", "BANK", "ACCOUNT_NUMBER", "UPI", "FINANCIAL"
    ]):
        return "critical"
    if any(k in ent for k in [
        "SSN", "CREDIT_CARD", "PASSPORT", "AADHAAR", "PAN", "VOTER", "LICENSE", "DRIVING", "TAX_ID", "NATIONAL_ID"
    ]):
        return "high"
    if any(k in ent for k in [
        "EMAIL", "PHONE", "TELEPHONE", "FAX", "ADDRESS"
    ]):
        return "medium"
    return "low"


SEVERITY_PENALTIES = {
    "low": 3.0,
    "medium": 8.0,
    "high": 15.0,
    "critical": 25.0,
}


@app.get("/api/users/{user_uuid}/trust-analytics")
async def get_user_trust_analytics(user_uuid: str, user: DBUser = Depends(get_current_user)):
    """
    Per-user token tracking across all requests, authority-trust score (exponential streak + severity penalties),
    violation frequency time-series chart, and effective-use score (clean request ratio).
    """
    assert_owner_or_admin(user, user_uuid)
    db = SessionLocal()
    try:
        target_user = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Tokens are all-time. The rating (violations, trust, effective use) counts only data after
        # the last admin reset, so history is kept but the rating can start over.
        since = target_user.rating_reset_at
        base = (
            db.query(
                DBEvent.id,
                DBEvent.decision,
                DBEvent.kind,
                DBEvent.action_mode,
                DBEvent.prompt_tokens,
                DBEvent.completion_tokens,
                DBEvent.pii_count,
                DBEvent.model,
                DBEvent.created_at,
            )
            .join(DBSession, DBSession.id == DBEvent.session_id)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .filter(DBUser.user_uuid == user_uuid)
        )
        all_events = base.all()
        events = [e for e in all_events if since is None or (e.created_at and e.created_at >= since)]

        prompt_tokens = sum(e.prompt_tokens or 0 for e in all_events)
        completion_tokens = sum(e.completion_tokens or 0 for e in all_events)
        total_tokens = prompt_tokens + completion_tokens

        # Ingress-only rule: a user is judged on what the USER sent.
        # PII in model output (egress), in agent replies, and in tool results is not a user violation.
        # Denied tool calls count.
        event_ids = [e.id for e in events if e.id]
        findings_map: Dict[str, List[str]] = {}
        if event_ids:
            findings_rows = (
                db.query(DBPIIFinding.event_id, DBPIIFinding.entity_type)
                .filter(DBPIIFinding.event_id.in_(event_ids))
                .all()
            )
            for eid, etype in findings_rows:
                findings_map.setdefault(eid, []).append(etype)

        def user_input(e):
            return (e.kind or "prompt") == "prompt"

        def classify_event(e):
            is_prompt = user_input(e)
            if is_prompt and (e.pii_count or 0) > 0:
                ents = findings_map.get(e.id, [])
                if e.decision == "block" or e.action_mode == "BLOCK":
                    return "blocked", ents
                elif e.action_mode == "HASH":
                    return "hashed", ents
                elif e.action_mode == "LOG_ONLY":
                    return "logged", ents
                else:
                    return "redacted", ents
            elif e.decision == "deny":
                return "denied", []
            else:
                return "clean", []

        total_requests = len(events)
        classifications = [classify_event(e) for e in events]
        clean_requests = sum(1 for c, _ in classifications if c == "clean")
        blocked_requests = sum(1 for c, _ in classifications if c == "blocked")
        hashed_requests = sum(1 for c, _ in classifications if c == "hashed")
        logged_requests = sum(1 for c, _ in classifications if c == "logged")
        redacted_requests = sum(1 for c, _ in classifications if c == "redacted")
        denied_requests = sum(1 for c, _ in classifications if c == "denied")
        total_violations = blocked_requests + hashed_requests + logged_requests + redacted_requests + denied_requests

        # Output tokens of every request count; a clean request keeps its completion (output) tokens
        window_tokens = sum((e.prompt_tokens or 0) + (e.completion_tokens or 0) for e in events)
        clean_tokens = sum((e.prompt_tokens or 0) + (e.completion_tokens or 0) for e, (c, _) in zip(events, classifications) if c == "clean")
        violation_tokens = window_tokens - clean_tokens

        violation_frequency_pct = round((total_violations / total_requests) * 100, 2) if total_requests else 0.0
        compliance_rate = ((clean_requests / total_requests) * 100) if total_requests else 100.0

        # 3. Effective-Use Score: Clean Requests / Total Requests * 100
        # Clean = zero guardrail intervention (Total - Blocked - Redacted - Hashed - Logged - Denied)
        effective_use_score = round((clean_requests / total_requests) * 100, 1) if total_requests > 0 else 100.0

        # 1. Authority-Trust Score: Streak-based exponential growth + severity-based penalties
        # Base default score: 80.0
        base_score = 80.0
        chrono_events = sorted(events, key=lambda ev: ev.created_at or datetime.min)
        current_streak = 0
        cumulative_penalties = 0.0

        for ev in chrono_events:
            cat, ents = classify_event(ev)
            if cat == "clean":
                current_streak += 1
            else:
                current_streak = 0
                if ents:
                    penalty = max(SEVERITY_PENALTIES[get_finding_severity(ent)] for ent in ents)
                elif cat in ("denied", "blocked"):
                    penalty = 15.0  # High severity
                else:
                    penalty = 8.0   # Medium severity default
                cumulative_penalties += penalty

        max_bonus = 100.0 - base_score  # 20.0 bonus points up to 100.0
        streak_bonus = max_bonus * (1.0 - math.exp(-current_streak / 25.0))
        raw_authority_trust = base_score + streak_bonus - cumulative_penalties
        authority_trust_score = round(max(0.0, min(100.0, raw_authority_trust)), 1)

        # Trust Tier Classification
        if authority_trust_score >= 85.0:
            trust_tier = "Tier 1: High Authority"
            trust_color = "#10b981"
        elif authority_trust_score >= 65.0:
            trust_tier = "Tier 2: Trusted Operator"
            trust_color = "#00f2fe"
        elif authority_trust_score >= 40.0:
            trust_tier = "Tier 3: Moderate Trust"
            trust_color = "#f59e0b"
        else:
            trust_tier = "Tier 4: Restricted"
            trust_color = "#fb7185"

        # 2. Violation Frequency: Time-Series Daily Breakdown (last 30 days)
        now = datetime.utcnow()
        daily_map = {}
        for i in range(29, -1, -1):
            d_dt = now - timedelta(days=i)
            d_str = d_dt.strftime("%Y-%m-%d")
            daily_map[d_str] = {
                "date": d_str,
                "day": d_dt.strftime("%b %d"),
                "redacted": 0,
                "blocked": 0,
                "hashed": 0,
                "logged": 0,
                "clean": 0,
                "total": 0,
            }

        for ev in events:
            if ev.created_at:
                d_str = ev.created_at.strftime("%Y-%m-%d")
                if d_str in daily_map:
                    cat, _ = classify_event(ev)
                    daily_map[d_str]["total"] += 1
                    if cat in ("redacted", "blocked", "hashed", "logged"):
                        daily_map[d_str][cat] += 1
                    elif cat == "clean":
                        daily_map[d_str]["clean"] += 1

        violation_chart = list(daily_map.values())

        session_scores = user_session_scores(db, target_user.id, since=since, limit=20)
        composite_rating = authority_trust_score

        model_usage = {}
        for e in all_events:
            m = e.model or "default"
            t = (e.prompt_tokens or 0) + (e.completion_tokens or 0)
            model_usage[m] = model_usage.get(m, 0) + t

        return {
            "user_uuid": user_uuid,
            "email": target_user.email,
            "role": target_user.role,
            "action_mode": target_user.action_mode or config.PII_ACTION_MODE,
            "tokens": {
                "total_tokens": total_tokens,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "clean_tokens": clean_tokens,
                "violation_tokens": violation_tokens,
                "avg_tokens_per_request": round(total_tokens / total_requests, 1) if total_requests else 0,
                "model_usage": model_usage,
            },
            "metrics": {
                "total_requests": total_requests,
                "clean_requests": clean_requests,
                "redacted_requests": redacted_requests,
                "blocked_requests": blocked_requests,
                "hashed_requests": hashed_requests,
                "logged_requests": logged_requests,
                "total_violations": total_violations,
                "denied_requests": denied_requests,
                "violation_frequency_pct": violation_frequency_pct,
                "violation_chart": violation_chart,
                "compliance_rate_pct": round(compliance_rate, 2),
                "effective_use_score": effective_use_score,
                "authority_trust_score": authority_trust_score,
                "current_streak": current_streak,
                "streak_bonus": round(streak_bonus, 1),
                "cumulative_penalties": round(cumulative_penalties, 1),
                "base_score": base_score,
                "composite_rating": composite_rating,
                "rating_since": since.isoformat() if since else None,
                "recent_sessions": session_scores[:10],
                "trust_tier": trust_tier,
                "trust_color": trust_color,
            }
        }
    finally:
        db.close()

@app.get("/api/stats")
async def get_stats(user_uuid: Optional[str] = None, user: DBUser = Depends(get_current_user)):
    assert_owner_or_admin(user, user_uuid)
    return audit_logger.get_stats(user_uuid=user_uuid)

def _authorize_session(db, session_id: str, user: DBUser):
    row = (
        db.query(DBSession, DBUser).join(DBUser, DBUser.id == DBSession.user_id).filter(DBSession.id == session_id).first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="session not found")
    assert_owner_or_admin(user, row[1].user_uuid)


@app.get("/api/sessions/{session_id}/receipts")
async def session_receipts(session_id: str, user: DBUser = Depends(get_current_user)):
    """Hash-chained audit receipts for one session, each with user -> session -> agent -> parent attribution."""
    db = SessionLocal()
    try:
        _authorize_session(db, session_id, user)
    finally:
        db.close()
    return audit_logger.export_session_receipts(session_id)


@app.get("/api/sessions/{session_id}/receipts/verify")
async def verify_session_receipts(session_id: str, user: DBUser = Depends(get_current_user)):
    """Recompute the receipt chain from the stored events and report whether anything was altered."""
    db = SessionLocal()
    try:
        _authorize_session(db, session_id, user)
    finally:
        db.close()
    return audit_logger.verify_session(session_id)


@app.get("/api/audit-receipts")
async def get_audit_receipts(limit: int = 50, user_uuid: Optional[str] = None, user: DBUser = Depends(get_current_user)):
    assert_owner_or_admin(user, user_uuid)
    return audit_logger.get_recent_receipts(limit=limit, user_uuid=user_uuid)

@app.post("/api/users/sync")
async def sync_user(req: UserSyncRequest, request: Request, claims: dict = Depends(get_claims)):
    """
    Create or fetch the DB user for the Clerk user in the verified token.
    The Clerk id comes from the token, not the request body.
    """
    db = SessionLocal()
    try:
        ADMIN_EMAILS = {"admin@jashds.com", "bhushanc2003@gmail.com", "saurabhshisode20@gmail.com", "shraddha.londhe@jashds.com"}
        user = db.query(DBUser).filter(DBUser.clerk_user_id == claims["sub"]).first()
        if user and user.email and user.email.lower() in ADMIN_EMAILS and user.role != "admin":
            user.role = "admin"
            db.commit()
            db.refresh(user)

        if not user:
            user_email = (req.email or "").strip().lower()
            if user_email:
                user = db.query(DBUser).filter(func.lower(DBUser.email) == user_email).first()
                if user:
                    user.clerk_user_id = claims["sub"]
                    if req.name and not user.name:
                        user.name = req.name
                    if user_email in ADMIN_EMAILS:
                        user.role = "admin"
                    db.commit()
                    db.refresh(user)

        if not user:
            u_uuid = f"usr_{uuid.uuid4().hex[:8]}"
            assigned_role = "admin" if (req.email and req.email.strip().lower() in ADMIN_EMAILS) else "user"
            user = DBUser(
                clerk_user_id=claims["sub"],
                email=req.email or f"{req.clerk_user_id}@noemail.local",
                name=req.name,
                user_uuid=u_uuid,
                role=assigned_role,
                action_mode="HASH",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        base_url = str(request.base_url).rstrip("/")
        proxy_url = f"{base_url}/proxy/{user.user_uuid}/v1"
        direct_url = f"{base_url}/{user.user_uuid}/v1"

        return {
            "id": user.id,
            "clerk_user_id": user.clerk_user_id,
            "email": user.email,
            "name": user.name,
            "user_uuid": user.user_uuid,
            "role": user.role,
            "proxy_url": proxy_url,
            "direct_url": direct_url
        }
    finally:
        db.close()

@app.get("/api/users/{user_uuid}/queries")
async def get_user_queries(user_uuid: str, limit: int = 50, user: DBUser = Depends(get_current_user)):
    """Get queries and detected PII items from Neon DB for specific user_uuid."""
    assert_owner_or_admin(user, user_uuid)
    db = SessionLocal()
    try:
        event_rows = (
            db.query(DBEvent, DBSession.external_id)
            .join(DBSession, DBSession.id == DBEvent.session_id)
            .join(DBUser, DBUser.id == DBSession.user_id)
            .filter(DBUser.user_uuid == user_uuid)
            .order_by(DBEvent.created_at.desc())
            .limit(limit)
            .all()
        )
        events = [e for e, _ in event_rows]
        session_names = {e.id: ext for e, ext in event_rows}
        event_ids = [e.id for e in events]
        findings_by_event: Dict[str, list] = {}
        if event_ids:
            for f, cat in (
                db.query(DBPIIFinding, DBCategory)
                .join(DBCategory, DBCategory.id == DBPIIFinding.category_id)
                .filter(DBPIIFinding.event_id.in_(event_ids))
                .all()
            ):
                findings_by_event.setdefault(f.event_id, []).append((f, cat))
        results = []
        for event in events:
            findings = findings_by_event.get(event.id, [])
            results.append({
                "id": event.id,
                "session_id": event.session_id,
                "session_external_id": session_names.get(event.id),
                "prompt_tokens": event.prompt_tokens,
                "completion_tokens": event.completion_tokens,
                "request_id": event.id[:8],
                "model": event.model,
                "original_prompt": event.original_text,
                "anonymized_prompt": event.anonymized_text,
                "pii_count": event.pii_count,
                "categories_found": sorted({cat.name for _, cat in findings}),
                "action_mode": event.action_mode,
                "decision": "hash" if (event.action_mode == "HASH" and event.decision != "allow") else event.decision,
                "latency_ms": event.latency_ms,
                "created_at": event.created_at.isoformat() if event.created_at else None,
                "pii_items": [
                    {
                        "category_id": cat.id,
                        "category_name": cat.name,
                        "entity_type": f.entity_type,
                        "original_text": None,
                        "placeholder_token": f.placeholder,
                        "confidence": f.confidence
                    }
                    for f, cat in findings
                ]
            })
        return results
    finally:
        db.close()

@app.post("/api/test-inspect")
async def test_inspect(req: TestInspectRequest, request: Request, user: DBUser = Depends(get_current_user)):
    """Inspect and anonymize a prompt. The event is recorded against the signed-in user."""
    vault = PIISessionVault()
    start_time = time.time()
    mode = req.mode if (req.mode and req.mode != "DEFAULT") else _action_mode_for(request, user.user_uuid)
    check_hipaa = req.check_hipaa if req.check_hipaa is not None else (user.hipaa_enabled if user.hipaa_enabled is not None else True)
    check_dpdp = req.check_dpdp if req.check_dpdp is not None else (user.dpdp_enabled if user.dpdp_enabled is not None else True)

    is_egress = (req.direction or "").lower() == "egress"
    try:
        if is_egress:
            anon_text, matches = anonymizer.process_output(req.prompt, vault, mode=mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
        else:
            anon_text, matches = anonymizer.process_text(req.prompt, vault, mode=mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
    except ValueError as e:
        latency_ms = (time.time() - start_time) * 1000.0
        matches = detector.detect(req.prompt, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
        block_event_id = audit_logger.log_event(
            identity=identity_from_request(request, user.user_uuid),
            user_id=req.user_id,
            user_uuid=user.user_uuid,
            request_id=f"block_{uuid.uuid4().hex[:8]}",
            action_mode="BLOCK",
            matches=matches if not is_egress else [],
            latency_ms=latency_ms,
            endpoint="/api/test-inspect",
            original_prompt=req.prompt if not is_egress else "[TEST_EGRESS_INPUT]",
            anonymized_prompt="[BLOCKED_POLICY_VIOLATION]",
            vault=vault
        )
        if is_egress and block_event_id:
            audit_logger.log_egress_inspection(
                event_id=block_event_id,
                original_response=req.prompt,
                anonymized_response="[BLOCKED_POLICY_VIOLATION]",
                egress_matches=matches,
                action_mode="BLOCK",
                vault=vault
            )
        return JSONResponse(
            status_code=400,
            content={
                "error": str(e),
                "blocked": True,
                "direction": req.direction or "ingress",
                "action_mode": "BLOCK",
                "original_prompt": req.prompt,
                "anonymized_prompt": "🚫 MODEL OUTPUT BLOCKED BY COMPLIANCE POLICY" if is_egress else "🚫 REQUEST BLOCKED BY COMPLIANCE POLICY",
                "matches": [
                    {
                        "category_id": m.category_id,
                        "category_name": m.category_name,
                        "entity_type": m.entity_type,
                        "confidence": round(m.confidence, 3),
                        "text": m.text,
                        "direction": "egress" if is_egress else "ingress"
                    }
                    for m in matches
                ],
                "latency_ms": round(latency_ms, 2)
            }
        )

    latency_ms = (time.time() - start_time) * 1000.0
    event_id = audit_logger.log_event(
        identity=identity_from_request(request, user.user_uuid),
        user_id=req.user_id,
        user_uuid=user.user_uuid,
        request_id=f"test_{uuid.uuid4().hex[:8]}",
        action_mode=mode,
        matches=matches if not is_egress else [],
        latency_ms=latency_ms,
        endpoint="/api/test-inspect",
        original_prompt=req.prompt if not is_egress else "[TEST_EGRESS_PROMPT]",
        anonymized_prompt=anon_text if not is_egress else "[TEST_EGRESS_PROMPT]",
        vault=vault
    )
    if is_egress and event_id:
        audit_logger.log_egress_inspection(
            event_id=event_id,
            original_response=req.prompt,
            anonymized_response=anon_text,
            egress_matches=matches,
            action_mode=mode,
            vault=vault
        )

    return {
        "original_prompt": req.prompt,
        "anonymized_prompt": anon_text,
        "direction": req.direction or "ingress",
        "action_mode": mode,
        "matches": [
            {
                "category_id": m.category_id,
                "category_name": m.category_name,
                "entity_type": m.entity_type,
                "confidence": round(m.confidence, 3),
                "text": m.text,
                "direction": "egress" if is_egress else "ingress"
            }
            for m in matches
        ],
        "latency_ms": round(latency_ms, 2)
    }

@app.get("/v1/models")
@app.get("/models")
@app.get("/api/v1/models")
@app.get("/api/models")
@app.get("/proxy/{user_uuid}/v1/models")
@app.get("/proxy/{user_uuid}/models")
@app.get("/{user_uuid}/v1/models")
@app.get("/{user_uuid}/models")
async def list_models(request: Request, user_uuid: Optional[str] = None):
    """Proxy models endpoint."""
    auth_header = request.headers.get("Authorization", "")
    headers = {"Authorization": auth_header} if auth_header else {}
    
    try:
        url = f"{config.UPSTREAM_BASE_URL.rstrip('/')}/models"
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                return res.json()
    except Exception:
        pass

    return {
        "object": "list",
        "data": [
            {
                "id": config.DEFAULT_MODEL_ID,
                "object": "model",
                "created": 1700000000,
                "owned_by": "nvidia"
            },
            {
                "id": "llama-3.3-70b-versatile",
                "object": "model",
                "created": 1700000000,
                "owned_by": "groq"
            },
            {
                "id": "llama-3.1-8b-instant",
                "object": "model",
                "created": 1700000000,
                "owned_by": "groq"
            },
            {
                "id": "meta-llama/llama-3.2-1b-instruct:free",
                "object": "model",
                "created": 1700000000,
                "owned_by": "openrouter"
            },
            {
                "id": config.EMBEDDING_MODEL_ID,
                "object": "model",
                "created": 1700000000,
                "owned_by": "BAAI"
            }
        ]
    }

class ConfigUpdateModeRequest(BaseModel):
    mode: str

@app.get("/api/config/action-mode")
async def get_action_mode():
    return {"pii_action_mode": config.PII_ACTION_MODE}

@app.post("/api/config/action-mode")
async def update_action_mode(req: ConfigUpdateModeRequest):
    valid_modes = ["REDACT", "BLOCK", "HASH", "LOG_ONLY"]
    mode = req.mode.upper()
    if mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid action mode. Must be one of {valid_modes}")
    config.PII_ACTION_MODE = mode
    print(f"⚙️ [CONFIG UPDATE] PII_ACTION_MODE set to: {config.PII_ACTION_MODE}")
    return {"status": "success", "pii_action_mode": config.PII_ACTION_MODE}

def _action_mode_for(request: Request, user_uuid: str) -> str:
    header = request.headers.get("X-Action-Mode")
    if header:
        return header.upper()
    db = SessionLocal()
    try:
        row = db.query(DBUser.action_mode).filter(DBUser.user_uuid == user_uuid).first()
    finally:
        db.close()
    return row[0] if row and row[0] else config.PII_ACTION_MODE

def _tokens_from_sse(raw: str):
    usage = None
    parts = []
    for line in raw.splitlines():
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            obj = json.loads(payload)
        except Exception:
            continue
        if obj.get("usage"):
            usage = obj["usage"]
        for choice in obj.get("choices", []):
            text = (choice.get("delta") or {}).get("content") or choice.get("text") or (choice.get("message") or {}).get("content")
            if isinstance(text, str):
                parts.append(text)
    return usage, "".join(parts)

def _record_usage(event_id: Optional[str], messages, usage: Optional[dict], completion_text: str) -> None:
    if not event_id:
        return
    if usage and usage.get("prompt_tokens") is not None:
        audit_logger.set_usage(event_id, usage.get("prompt_tokens"), usage.get("completion_tokens"), False)
        return
    prompt_chars = sum(len(str(m.get("content", ""))) for m in messages or [] if isinstance(m, dict))
    audit_logger.set_usage(event_id, prompt_chars // 4, len(completion_text) // 4, True)

@app.post("/v1/chat/completions")
@app.post("/chat/completions")
@app.post("/api/v1/chat/completions")
@app.post("/api/chat/completions")
@app.post("/proxy/{user_uuid}/v1/chat/completions")
@app.post("/proxy/{user_uuid}/chat/completions")
@app.post("/{user_uuid}/v1/chat/completions")
@app.post("/{user_uuid}/chat/completions")
async def chat_completions(request: Request, user_uuid: Optional[str] = "default_user"):
    """
    OpenAI-compatible /chat/completions endpoint supporting per-user proxy routing.
    Redacts PII from messages before sending to real OpenWebUI endpoint.
    """
    start_time = time.time()
    req_body = await request.json()
    auth_header = request.headers.get("Authorization", "")
    action_mode = _action_mode_for(request, user_uuid)

    user_id = req_body.get("user") or request.headers.get("X-User-ID") or user_uuid
    request_id = f"req_{uuid.uuid4().hex[:10]}"

    messages = req_body.get("messages", [])
    vault = PIISessionVault()

    # Determine active compliance frameworks (HIPAA / DPDP)
    db = SessionLocal()
    check_hipaa = True
    check_dpdp = True
    try:
        user_record = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
        if user_record:
            if user_record.hipaa_enabled is not None:
                check_hipaa = user_record.hipaa_enabled
            if user_record.dpdp_enabled is not None:
                check_dpdp = user_record.dpdp_enabled
    finally:
        db.close()

    if "X-Check-HIPAA" in request.headers:
        check_hipaa = request.headers.get("X-Check-HIPAA", "").lower() in ("true", "1", "yes")
    if "X-Check-DPDP" in request.headers:
        check_dpdp = request.headers.get("X-Check-DPDP", "").lower() in ("true", "1", "yes")

    # Apply PII Anonymization / Compliance Policy on prompt messages
    try:
        processed_messages, matches = anonymizer.process_messages(
            messages=messages,
            vault=vault,
            mode=action_mode,
            check_hipaa=check_hipaa,
            check_dpdp=check_dpdp
        )
    except ValueError as e:
        latency_ms = (time.time() - start_time) * 1000.0
        latest_user_msg = ""
        for idx in range(len(messages) - 1, -1, -1):
            if isinstance(messages[idx], dict) and messages[idx].get("role") == "user":
                latest_user_msg = str(messages[idx].get("content", ""))
                break
        blocked_matches = detector.detect(latest_user_msg, check_hipaa=check_hipaa, check_dpdp=check_dpdp) if latest_user_msg else []
        blocked_event_id = audit_logger.log_event(
            identity=identity_from_request(request, user_uuid, req_body.get("messages")),
            user_id=user_id,
            user_uuid=user_uuid,
            request_id=f"block_{uuid.uuid4().hex[:10]}",
            action_mode="BLOCK",
            matches=blocked_matches,
            latency_ms=latency_ms,
            endpoint="/v1/chat/completions",
            model=req_body.get("model", config.DEFAULT_MODEL_ID),
            original_prompt=latest_user_msg.strip(),
            anonymized_prompt="[BLOCKED_POLICY_VIOLATION]",
            vault=vault
        )
        if blocked_event_id:
            prompt_chars = sum(len(str(m.get("content", ""))) for m in messages or [] if isinstance(m, dict))
            audit_logger.set_usage(blocked_event_id, max(1, prompt_chars // 4), 0, True)
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "message": str(e),
                    "type": "compliance_policy_violation",
                    "code": "pii_blocked",
                    "matches_count": len(blocked_matches)
                }
            }
        )

    req_body["messages"] = processed_messages

    if "model" not in req_body or not req_body["model"]:
        req_body["model"] = config.DEFAULT_MODEL_ID

    is_stream = req_body.get("stream", False)
    headers = {"Content-Type": "application/json"}
    if auth_header:
        headers["Authorization"] = auth_header

    # Extract latest user message for audit log prompt & match accounting
    latest_user_msg = ""
    latest_anon_msg = ""
    latest_matches = []

    # Find latest user message index
    latest_idx = -1
    for idx in range(len(messages) - 1, -1, -1):
        msg = messages[idx]
        if isinstance(msg, dict) and msg.get("role") == "user":
            latest_idx = idx
            content = msg.get("content")
            if isinstance(content, str):
                latest_user_msg = content
            elif isinstance(content, list):
                latest_user_msg = " ".join([c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"])
            break

    if latest_idx >= 0 and latest_idx < len(processed_messages):
        p_msg = processed_messages[latest_idx]
        content = p_msg.get("content")
        if isinstance(content, str):
            latest_anon_msg = content
        elif isinstance(content, list):
            latest_anon_msg = " ".join([c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"])

    # If latest user message was found, detect matches specifically for latest message for accurate audit receipt
    if latest_user_msg:
        temp_vault = PIISessionVault()
        _, latest_matches = anonymizer.process_text(latest_user_msg, temp_vault, mode=action_mode)
    else:
        latest_user_msg = "No user prompt string"
        latest_anon_msg = "No user prompt string"
        latest_matches = matches

    latency_ms = (time.time() - start_time) * 1000.0
    event_id = audit_logger.log_event(
        identity=identity_from_request(request, user_uuid, req_body.get("messages")),
        user_id=user_id,
        user_uuid=user_uuid,
        request_id=request_id,
        action_mode=action_mode,
        matches=latest_matches,
        latency_ms=latency_ms,
        endpoint="/v1/chat/completions",
        model=req_body.get("model", config.DEFAULT_MODEL_ID),
        original_prompt=latest_user_msg.strip(),
        anonymized_prompt=latest_anon_msg.strip(),
        vault=vault
    )

    upstream_url = f"{config.UPSTREAM_BASE_URL.rstrip('/')}/chat/completions"

    if is_stream:
        async def stream_generator():
            client = httpx.AsyncClient(timeout=180.0)
            raw_parts = []
            try:
                async with client.stream("POST", upstream_url, json=req_body, headers=headers) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        err_msg = f"HTTP {response.status_code}"
                        try:
                            err_json = json.loads(err_body.decode('utf-8', errors='ignore'))
                            if "error" in err_json and isinstance(err_json["error"], dict):
                                err_msg = err_json["error"].get("message", err_msg)
                            elif "message" in err_json:
                                err_msg = err_json["message"]
                        except Exception:
                            pass

                        error_chunk = {
                            "id": f"chatcmpl-err-{uuid.uuid4().hex[:8]}",
                            "object": "chat.completion.chunk",
                            "created": int(time.time()),
                            "model": req_body.get("model", config.DEFAULT_MODEL_ID),
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {"content": f"⚠️ Upstream Provider Error ({response.status_code}): {err_msg}"},
                                    "finish_reason": "stop"
                                }
                            ]
                        }
                        yield f"data: {json.dumps(error_chunk)}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    async for chunk in response.aiter_text():
                        raw_parts.append(chunk)
                        if config.DEANONYMIZE_OUTPUT and chunk:
                            chunk = vault.de_anonymize(chunk)
                        yield chunk
            except Exception as stream_err:
                error_chunk = {
                    "id": f"chatcmpl-err-{uuid.uuid4().hex[:8]}",
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": req_body.get("model", config.DEFAULT_MODEL_ID),
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": f"⚠️ Upstream Proxy Stream Error: {str(stream_err)}"},
                            "finish_reason": "stop"
                        }
                    ]
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"
                yield "data: [DONE]\n\n"
            finally:
                usage, completion_text = _tokens_from_sse("".join(raw_parts))
                _record_usage(event_id, req_body.get("messages"), usage, completion_text)
                if event_id:
                    out_matches = []
                    if completion_text and (check_hipaa or check_dpdp):
                        out_matches = detector.detect(completion_text, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                    sanitized_stream_text = completion_text
                    if out_matches:
                        if action_mode in ("REDACT", "HASH"):
                            sanitized_stream_text, _ = anonymizer.process_text(completion_text, vault, mode=action_mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                        elif action_mode == "BLOCK":
                            sanitized_stream_text = "🚫 MODEL OUTPUT BLOCKED BY COMPLIANCE POLICY"
                    audit_logger.log_egress_inspection(
                        event_id=event_id,
                        original_response=completion_text or "",
                        anonymized_response=sanitized_stream_text or "",
                        egress_matches=out_matches,
                        action_mode=action_mode,
                        vault=vault
                    )
                await client.aclose()

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                res = await client.post(upstream_url, json=req_body, headers=headers)
            except Exception as conn_err:
                return JSONResponse(
                    status_code=502,
                    content={
                        "error": {
                            "message": f"Cannot connect to upstream LLM node ({config.UPSTREAM_BASE_URL}): {str(conn_err)}",
                            "type": "upstream_connect_error"
                        }
                    }
                )

            if res.status_code != 200:
                try:
                    res_json = res.json()
                except Exception:
                    res_json = {"error": {"message": f"Upstream returned HTTP {res.status_code}", "type": "upstream_error"}}
                return JSONResponse(status_code=res.status_code, content=res_json)

            res_data = res.json()
            completion_text = "".join(
                (c.get("message") or {}).get("content") or "" for c in res_data.get("choices", []) if isinstance(c.get("message"), dict)
            )
            _record_usage(event_id, req_body.get("messages"), res_data.get("usage"), completion_text)

            # Egress Compliance & Model Output Guardrail
            egress_violations = []
            blocked_egress = False
            if check_hipaa or check_dpdp:
                for choice in res_data.get("choices", []):
                    msg = choice.get("message")
                    if isinstance(msg, dict) and "content" in msg and isinstance(msg["content"], str) and msg["content"]:
                        out_text = msg["content"]
                        out_matches = detector.detect(out_text, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                        if out_matches:
                            egress_violations.extend(out_matches)
                            if action_mode == "BLOCK":
                                blocked_egress = True
                                break
                            elif action_mode in ("REDACT", "HASH"):
                                sanitized_text, _ = anonymizer.process_output(
                                    out_text,
                                    vault,
                                    mode=action_mode,
                                    check_hipaa=check_hipaa,
                                    check_dpdp=check_dpdp
                                )
                                msg["content"] = sanitized_text

            sanitized_completion = "🚫 MODEL OUTPUT BLOCKED BY COMPLIANCE POLICY" if blocked_egress else "".join(
                (c.get("message") or {}).get("content") or "" for c in res_data.get("choices", []) if isinstance(c.get("message"), dict)
            )

            if event_id:
                audit_logger.log_egress_inspection(
                    event_id=event_id,
                    original_response=completion_text,
                    anonymized_response=sanitized_completion,
                    egress_matches=egress_violations,
                    action_mode=action_mode,
                    vault=vault
                )

            if blocked_egress:
                categories_found = sorted(list(set(m.category_name for m in egress_violations)))
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "message": f"Compliance Policy Violation (Egress): Model output blocked because it contained {len(egress_violations)} prohibited personal identifier(s) ({', '.join(categories_found)}).",
                            "type": "egress_compliance_violation",
                            "code": "output_pii_blocked",
                            "matches_count": len(egress_violations),
                            "categories": categories_found
                        }
                    }
                )

            if config.DEANONYMIZE_OUTPUT and "choices" in res_data:
                for choice in res_data.get("choices", []):
                    if "message" in choice and "content" in choice["message"]:
                        c_text = choice["message"]["content"]
                        if isinstance(c_text, str):
                            choice["message"]["content"] = vault.de_anonymize(c_text)

            return JSONResponse(content=res_data)

@app.post("/v1/completions")
@app.post("/completions")
@app.post("/api/v1/completions")
@app.post("/api/completions")
@app.post("/proxy/{user_uuid}/v1/completions")
@app.post("/proxy/{user_uuid}/completions")
@app.post("/{user_uuid}/v1/completions")
@app.post("/{user_uuid}/completions")
async def text_completions(request: Request, user_uuid: Optional[str] = "default_user"):
    """OpenAI-compatible text completions endpoint."""
    start_time = time.time()
    action_mode = _action_mode_for(request, user_uuid)
    req_body = await request.json()
    auth_header = request.headers.get("Authorization", "")

    user_id = req_body.get("user") or request.headers.get("X-User-ID") or user_uuid
    request_id = f"req_{uuid.uuid4().hex[:10]}"

    db = SessionLocal()
    check_hipaa = True
    check_dpdp = True
    try:
        user_record = db.query(DBUser).filter(DBUser.user_uuid == user_uuid).first()
        if user_record:
            if user_record.hipaa_enabled is not None:
                check_hipaa = user_record.hipaa_enabled
            if user_record.dpdp_enabled is not None:
                check_dpdp = user_record.dpdp_enabled
    finally:
        db.close()

    if "X-Check-HIPAA" in request.headers:
        check_hipaa = request.headers.get("X-Check-HIPAA", "").lower() in ("true", "1", "yes")
    if "X-Check-DPDP" in request.headers:
        check_dpdp = request.headers.get("X-Check-DPDP", "").lower() in ("true", "1", "yes")

    prompt = req_body.get("prompt", "")
    vault = PIISessionVault()
    all_matches = []

    if isinstance(prompt, str) and prompt:
        anon_prompt, matches = anonymizer.process_text(prompt, vault, mode=action_mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
        req_body["prompt"] = anon_prompt
        all_matches = matches
    elif isinstance(prompt, list):
        anon_prompts = []
        for p in prompt:
            if isinstance(p, str):
                ap, m = anonymizer.process_text(p, vault, mode=action_mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                anon_prompts.append(ap)
                all_matches.extend(m)
            else:
                anon_prompts.append(p)
        req_body["prompt"] = anon_prompts

    if "model" not in req_body or not req_body["model"]:
        req_body["model"] = config.DEFAULT_MODEL_ID

    is_stream = req_body.get("stream", False)
    headers = {"Content-Type": "application/json"}
    if auth_header:
        headers["Authorization"] = auth_header

    latency_ms = (time.time() - start_time) * 1000.0
    event_id = audit_logger.log_event(
        identity=identity_from_request(request, user_uuid, [{"role": "user", "content": req_body.get("prompt")}]),
        user_id=user_id,
        user_uuid=user_uuid,
        request_id=request_id,
        action_mode=action_mode,
        matches=all_matches,
        latency_ms=latency_ms,
        endpoint="/v1/completions",
        model=req_body.get("model", config.DEFAULT_MODEL_ID),
        original_prompt=str(prompt),
        anonymized_prompt=str(req_body.get("prompt")),
        vault=vault
    )

    upstream_url = f"{config.UPSTREAM_BASE_URL.rstrip('/')}/completions"

    if is_stream:
        async def stream_generator():
            client = httpx.AsyncClient(timeout=180.0)
            try:
                async with client.stream("POST", upstream_url, json=req_body, headers=headers) as response:
                    async for chunk in response.aiter_text():
                        if config.DEANONYMIZE_OUTPUT and chunk:
                            chunk = vault.de_anonymize(chunk)
                        yield chunk
            finally:
                await client.aclose()

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(upstream_url, json=req_body, headers=headers)
            if res.status_code != 200:
                return JSONResponse(status_code=res.status_code, content=res.json())

            res_data = res.json()
            egress_violations = []
            blocked_egress = False
            if check_hipaa or check_dpdp:
                for choice in res_data.get("choices", []):
                    if "text" in choice and isinstance(choice["text"], str) and choice["text"]:
                        out_text = choice["text"]
                        out_matches = detector.detect(out_text, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                        if out_matches:
                            egress_violations.extend(out_matches)
                            if action_mode == "BLOCK":
                                blocked_egress = True
                                break
                            elif action_mode in ("REDACT", "HASH"):
                                sanitized_text, _ = anonymizer.process_output(out_text, vault, mode=action_mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                                choice["text"] = sanitized_text

            raw_text = "".join(c.get("text") or "" for c in res_data.get("choices", []) if isinstance(c, dict))
            sanitized_text = "🚫 MODEL OUTPUT BLOCKED BY COMPLIANCE POLICY" if blocked_egress else "".join(
                c.get("text") or "" for c in res_data.get("choices", []) if isinstance(c, dict)
            )
            if event_id:
                audit_logger.log_egress_inspection(
                    event_id=event_id,
                    original_response=raw_text,
                    anonymized_response=sanitized_text,
                    egress_matches=egress_violations,
                    action_mode=action_mode,
                    vault=vault
                )

            if blocked_egress:
                categories_found = sorted(list(set(m.category_name for m in egress_violations)))
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "message": f"Compliance Policy Violation (Egress): Model output blocked because it contained {len(egress_violations)} prohibited personal identifier(s) ({', '.join(categories_found)}).",
                            "type": "egress_compliance_violation",
                            "code": "output_pii_blocked",
                            "categories": categories_found
                        }
                    }
                )

            if config.DEANONYMIZE_OUTPUT and "choices" in res_data:
                for choice in res_data.get("choices", []):
                    if "text" in choice and isinstance(choice["text"], str):
                        choice["text"] = vault.de_anonymize(choice["text"])

            return JSONResponse(content=res_data)

@app.post("/v1/embeddings")
@app.post("/embeddings")
@app.post("/api/v1/embeddings")
@app.post("/api/embeddings")
@app.post("/proxy/{user_uuid}/v1/embeddings")
@app.post("/proxy/{user_uuid}/embeddings")
@app.post("/{user_uuid}/v1/embeddings")
@app.post("/{user_uuid}/embeddings")
async def embeddings(request: Request, user_uuid: Optional[str] = "default_user"):
    """Proxy /v1/embeddings endpoint to upstream BAAI/bge-small-en-v1.5."""
    req_body = await request.json()
    auth_header = request.headers.get("Authorization", "")
    headers = {"Content-Type": "application/json"}
    if auth_header:
        headers["Authorization"] = auth_header

    if "model" not in req_body or not req_body["model"]:
        req_body["model"] = config.EMBEDDING_MODEL_ID

    upstream_url = f"{config.UPSTREAM_BASE_URL.rstrip('/')}/embeddings"
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(upstream_url, json=req_body, headers=headers)
        return JSONResponse(status_code=res.status_code, content=res.json())


# -------------------------------------------------------------
# Governance Control Plane Endpoint (for LangGraph / Callbacks)
# -------------------------------------------------------------

class GovernanceEvaluateRequest(BaseModel):
    user_id: Optional[str] = "default_user"
    user_uuid: Optional[str] = None
    session_id: str
    agent_id: str = "default_agent"
    parent_agent_id: Optional[str] = None
    kind: str  # "prompt", "tool_call", "tool_result", "completion", "final_output"
    tool_name: Optional[str] = None
    payload: Optional[str] = ""
    action_mode: Optional[str] = None
    min_score: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None


@app.post("/api/governance/evaluate")
@app.post("/core/evaluate")
@app.post("/v1/evaluate")
@app.post("/proxy/{user_uuid}/api/governance/evaluate")
@app.post("/proxy/{user_uuid}/core/evaluate")
@app.post("/proxy/{user_uuid}/v1/evaluate")
@app.post("/proxy/{user_uuid}/evaluate")
async def governance_evaluate(
    eval_req: GovernanceEvaluateRequest,
    request: Request,
    user_uuid: Optional[str] = None
):
    """
    Unified Governance Evaluation Endpoint for LangGraph / Agents:
    Intercepts User-to-Agent prompts, Agent-to-Tool calls, Tool-to-Agent results, and Agent-to-User completions.
    """
    start_time = time.time()
    effective_user_uuid = user_uuid or eval_req.user_uuid or eval_req.user_id or "default_user"
    effective_action_mode = eval_req.action_mode or _action_mode_for(request, effective_user_uuid)

    session_id = eval_req.session_id
    agent_id = eval_req.agent_id
    parent_agent_id = eval_req.parent_agent_id
    kind = eval_req.kind.lower()
    tool_name = eval_req.tool_name or ""
    payload = eval_req.payload or ""
    meta = eval_req.meta or {}

    db = SessionLocal()
    try:
        # 1. Resolve User
        user = db.query(DBUser).filter(DBUser.user_uuid == effective_user_uuid).first()
        if user is None:
            user = DBUser(
                email=f"{effective_user_uuid}@anonymous.local",
                name=eval_req.user_id or effective_user_uuid,
                user_uuid=effective_user_uuid
            )
            db.add(user)
            db.flush()

        # 2. Resolve Session
        session = (
            db.query(DBSession)
            .filter(DBSession.user_id == user.id, DBSession.external_id == session_id)
            .first()
        )
        if session is None:
            session = DBSession(user_id=user.id, external_id=session_id)
            db.add(session)
            db.flush()
        session.last_seen_at = datetime.utcnow()

        # 3. Resolve Agent
        agent = db.query(DBAgent).filter(DBAgent.session_id == session.id, DBAgent.agent_name == agent_id).first()
        if agent is None:
            parent_id = None
            if parent_agent_id and parent_agent_id != agent_id:
                parent_agent = db.query(DBAgent).filter(DBAgent.session_id == session.id, DBAgent.agent_name == parent_agent_id).first()
                if parent_agent:
                    parent_id = parent_agent.id
            agent = DBAgent(session_id=session.id, agent_name=agent_id, parent_agent_id=parent_id)
            db.add(agent)
            db.flush()

        vault = PIISessionVault()
        current_score, ceiling = get_agent_score(db, agent.id)

        # -------------------------------------------------------------
        # Boundary 2: Agent -> Tool Call (Policy Gate Check)
        # -------------------------------------------------------------
        if kind == "tool_call":
            auth_res = authorize_tool_call(
                db=db,
                session_id=session.id,
                agent_id=agent.id,
                tool_name=tool_name,
                custom_threshold=eval_req.min_score
            )

            if not auth_res["allowed"]:
                db.commit()
                event_id = audit_logger.log_event(
                    user_id=user.email,
                    user_uuid=user.user_uuid,
                    request_id=f"gate_deny_{uuid.uuid4().hex[:8]}",
                    action_mode=effective_action_mode,
                    matches=[],
                    latency_ms=(time.time() - start_time) * 1000.0,
                    endpoint="/api/governance/evaluate",
                    kind="tool_call",
                    tool_name=tool_name,
                    decision="deny",
                    original_prompt=payload,
                    anonymized_prompt=auth_res["reason"],
                    identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
                )
                return {
                    "allowed": False,
                    "decision": "deny",
                    "reason": auth_res["reason"],
                    "payload": auth_res["reason"],
                    "current_score": auth_res["current_score"],
                    "required_score": auth_res["required_score"],
                    "ceiling": auth_res["ceiling"],
                    "receipt_id": event_id
                }

            # Authorized -> Check arguments for PII/compliance
            anon_args, matches = anonymizer.process_text(payload, vault, mode=effective_action_mode)
            if effective_action_mode == "BLOCK" and len(matches) > 0:
                penalize_agent(db, agent.id, "compliance_block", f"PII in tool arguments for {tool_name}")
                db.commit()
                event_id = audit_logger.log_event(
                    user_id=user.email,
                    user_uuid=user.user_uuid,
                    request_id=f"args_block_{uuid.uuid4().hex[:8]}",
                    action_mode="BLOCK",
                    matches=matches,
                    latency_ms=(time.time() - start_time) * 1000.0,
                    endpoint="/api/governance/evaluate",
                    kind="tool_call",
                    tool_name=tool_name,
                    decision="block",
                    original_prompt=payload,
                    identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
                )
                new_score, _ = get_agent_score(db, agent.id)
                return {
                    "allowed": False,
                    "decision": "block",
                    "reason": f"Compliance policy violation: tool arguments contain {len(matches)} PII items",
                    "payload": f"BLOCKED by Governance: Compliance violation in tool arguments",
                    "current_score": new_score,
                    "receipt_id": event_id
                }

            db.commit()
            event_id = audit_logger.log_event(
                user_id=user.email,
                user_uuid=user.user_uuid,
                request_id=f"tool_call_{uuid.uuid4().hex[:8]}",
                action_mode=effective_action_mode,
                matches=matches,
                latency_ms=(time.time() - start_time) * 1000.0,
                endpoint="/api/governance/evaluate",
                kind="tool_call",
                tool_name=tool_name,
                decision="allow",
                original_prompt=payload,
                anonymized_prompt=anon_args,
                identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
            )
            return {
                "allowed": True,
                "decision": "allow",
                "reason": "Authorized and compliant",
                "payload": anon_args,
                "current_score": auth_res["current_score"],
                "required_score": auth_res["required_score"],
                "ceiling": auth_res["ceiling"],
                "receipt_id": event_id
            }

        # -------------------------------------------------------------
        # Boundary 3: Tool -> Agent Call (Verified Proof & Evidence Reward)
        # -------------------------------------------------------------
        elif kind == "tool_result":
            anon_result, matches = anonymizer.process_text(payload, vault, mode=effective_action_mode)
            clean_exec = not bool(meta.get("error"))
            output_clean = (len(matches) == 0)

            # 4-Point Verified Proof Check:
            if clean_exec and output_clean:
                reward_res = verify_and_reward_tool_result(
                    db=db,
                    agent_id=agent.id,
                    pre_authorized=True,
                    input_compliant=True,
                    execution_clean=True,
                    output_compliant=True
                )
                db.commit()
                event_id = audit_logger.log_event(
                    user_id=user.email,
                    user_uuid=user.user_uuid,
                    request_id=f"tool_res_{uuid.uuid4().hex[:8]}",
                    action_mode=effective_action_mode,
                    matches=[],
                    latency_ms=(time.time() - start_time) * 1000.0,
                    endpoint="/api/governance/evaluate",
                    kind="tool_result",
                    tool_name=tool_name,
                    decision="allow",
                    original_prompt=payload,
                    anonymized_prompt=anon_result,
                    identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
                )
                return {
                    "allowed": True,
                    "decision": "allow",
                    "verified_proof": True,
                    "delta": reward_res["delta"],
                    "payload": anon_result,
                    "current_score": reward_res["current_score"],
                    "ceiling": reward_res["ceiling"],
                    "receipt_id": event_id
                }
            else:
                if len(matches) > 0:
                    penalize_agent(db, agent.id, "compliance_redaction", f"PII detected in output of tool {tool_name}")
                db.commit()
                new_score, _ = get_agent_score(db, agent.id)
                event_id = audit_logger.log_event(
                    user_id=user.email,
                    user_uuid=user.user_uuid,
                    request_id=f"tool_res_{uuid.uuid4().hex[:8]}",
                    action_mode=effective_action_mode,
                    matches=matches,
                    latency_ms=(time.time() - start_time) * 1000.0,
                    endpoint="/api/governance/evaluate",
                    kind="tool_result",
                    tool_name=tool_name,
                    decision="redact" if len(matches) > 0 else "allow",
                    original_prompt=payload,
                    anonymized_prompt=anon_result,
                    identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
                )
                return {
                    "allowed": True,
                    "decision": "redact" if len(matches) > 0 else "allow",
                    "verified_proof": False,
                    "delta": 0,
                    "payload": anon_result,
                    "current_score": new_score,
                    "ceiling": ceiling,
                    "receipt_id": event_id
                }

        # -------------------------------------------------------------
        # Boundary 1: User -> Agent Call (Inbound Prompt)
        # -------------------------------------------------------------
        elif kind == "prompt":
            anon_prompt, matches = anonymizer.process_text(payload, vault, mode=effective_action_mode)
            if effective_action_mode == "BLOCK" and len(matches) > 0:
                penalize_agent(db, agent.id, "compliance_block", "Inbound prompt compliance violation")
                db.commit()
                new_score, _ = get_agent_score(db, agent.id)
                event_id = audit_logger.log_event(
                    user_id=user.email,
                    user_uuid=user.user_uuid,
                    request_id=f"prompt_block_{uuid.uuid4().hex[:8]}",
                    action_mode="BLOCK",
                    matches=matches,
                    latency_ms=(time.time() - start_time) * 1000.0,
                    endpoint="/api/governance/evaluate",
                    kind="prompt",
                    decision="block",
                    original_prompt=payload,
                    identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
                )
                return {
                    "allowed": False,
                    "decision": "block",
                    "reason": f"Compliance violation: Prompt contains {len(matches)} PII items",
                    "payload": "[BLOCKED_POLICY_VIOLATION]",
                    "current_score": new_score,
                    "receipt_id": event_id
                }

            if len(matches) > 0 and effective_action_mode != "LOG_ONLY":
                penalize_agent(db, agent.id, "compliance_redaction", "Prompt contained sensitive data")
            db.commit()
            new_score, _ = get_agent_score(db, agent.id)
            event_id = audit_logger.log_event(
                user_id=user.email,
                user_uuid=user.user_uuid,
                request_id=f"prompt_{uuid.uuid4().hex[:8]}",
                action_mode=effective_action_mode,
                matches=matches,
                latency_ms=(time.time() - start_time) * 1000.0,
                endpoint="/api/governance/evaluate",
                kind="prompt",
                decision="redact" if len(matches) > 0 else "allow",
                original_prompt=payload,
                anonymized_prompt=anon_prompt,
                identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
            )
            return {
                "allowed": True,
                "decision": "redact" if len(matches) > 0 else "allow",
                "payload": anon_prompt,
                "current_score": new_score,
                "ceiling": ceiling,
                "receipt_id": event_id
            }

        # -------------------------------------------------------------
        # Boundary 4: Agent -> User Call (Outbound Response & Verdict)
        # -------------------------------------------------------------
        elif kind in ["completion", "final_output"]:
            # Check session verdict (block if any agent score < 20)
            is_valid, verdict_reason = check_session_verdict(db, session.id)
            if not is_valid:
                db.commit()
                event_id = audit_logger.log_event(
                    user_id=user.email,
                    user_uuid=user.user_uuid,
                    request_id=f"verdict_block_{uuid.uuid4().hex[:8]}",
                    action_mode=effective_action_mode,
                    matches=[],
                    latency_ms=(time.time() - start_time) * 1000.0,
                    endpoint="/api/governance/evaluate",
                    kind="final_output",
                    decision="block",
                    original_prompt=payload,
                    anonymized_prompt=verdict_reason,
                    identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
                )
                return {
                    "allowed": False,
                    "decision": "block",
                    "reason": verdict_reason,
                    "payload": f"OUTPUT BLOCKED BY GOVERNANCE: {verdict_reason}",
                    "current_score": current_score,
                    "receipt_id": event_id
                }

            anon_out, matches = anonymizer.process_text(payload, vault, mode=effective_action_mode)
            db.commit()
            event_id = audit_logger.log_event(
                user_id=user.email,
                user_uuid=user.user_uuid,
                request_id=f"final_{uuid.uuid4().hex[:8]}",
                action_mode=effective_action_mode,
                matches=matches,
                latency_ms=(time.time() - start_time) * 1000.0,
                endpoint="/api/governance/evaluate",
                kind="final_output",
                decision="redact" if len(matches) > 0 else "allow",
                original_prompt=payload,
                anonymized_prompt=anon_out,
                identity=Identity(session_external_id=session_id, agent_name=agent_id, parent_agent_name=parent_agent_id)
            )
            return {
                "allowed": True,
                "decision": "redact" if len(matches) > 0 else "allow",
                "payload": anon_out,
                "current_score": current_score,
                "ceiling": ceiling,
                "receipt_id": event_id
            }

        else:
            db.commit()
            return {"allowed": True, "decision": "allow", "payload": payload, "current_score": current_score}

    finally:
        db.close()


@app.get("/api/governance/agents/{session_id}/{agent_name}/score")
@app.get("/proxy/{user_uuid}/api/governance/agents/{session_id}/{agent_name}/score")
async def get_governance_agent_score(session_id: str, agent_name: str, user_uuid: Optional[str] = None):
    db = SessionLocal()
    try:
        session = db.query(DBSession).filter(DBSession.external_id == session_id).first()
        if not session:
            return {"session_id": session_id, "agent_name": agent_name, "score": 100, "ceiling": 100}
        agent = db.query(DBAgent).filter(DBAgent.session_id == session.id, DBAgent.agent_name == agent_name).first()
        if not agent:
            return {"session_id": session_id, "agent_name": agent_name, "score": 100, "ceiling": 100}
        score, ceiling = get_agent_score(db, agent.id)
        return {
            "session_id": session_id,
            "agent_id": agent.id,
            "agent_name": agent_name,
            "score": score,
            "ceiling": ceiling
        }
    finally:
        db.close()


@app.get("/api/governance/verdict/{session_id}")
@app.get("/proxy/{user_uuid}/api/governance/verdict/{session_id}")
async def get_governance_session_verdict(session_id: str, user_uuid: Optional[str] = None):
    db = SessionLocal()
    try:
        session = db.query(DBSession).filter(DBSession.external_id == session_id).first()
        if not session:
            return {"session_id": session_id, "compliant": True, "verdict": "Session not found"}
        is_compliant, verdict = check_session_verdict(db, session.id)
        return {
            "session_id": session_id,
            "compliant": is_compliant,
            "verdict": verdict
        }
    finally:
        db.close()

