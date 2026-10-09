"""
LangChain / LangGraph callback handler for the governance runtime.

Attach it once and every LLM call and tool call in a LangChain agent or a LangGraph graph is checked through the
same five governance hooks the GuardRailBench uses (POST /api/v1/on_*), with no change to the agent code:

    handler = GuardrailCallbackHandler(base_url="http://localhost:8000", user_id="alice",
                                       agent_for_node={"data_agent": ("data_agent", "orchestrator")},
                                       allowed_tools={"data_agent": ["search_patients"]},
                                       tool_risk={"search_patients": "low"})
    graph.invoke(state, config={"callbacks": [handler]})        # LangGraph
    agent_or_model.invoke(x, config={"callbacks": [handler]})   # LangChain

What it does (native callback events):
  on_chat_model_start / on_llm_start -> on_prompt_received   (PII redacted in place in the outgoing messages)
  on_llm_end                         -> on_completion_received (PII redacted in place in the reply; the score verdict
                                         can replace a top-level reply with "output blocked ...")
  on_tool_start                      -> on_tool_call          (denied -> raises GovernanceDenied, the tool never runs)
  on_tool_end                        -> on_tool_result        (redacted in place when the output is a ToolMessage)
  finish()                           -> on_session_end

Agent identity: in LangGraph the node name (metadata["langgraph_node"]) is the agent; `agent_for_node` maps a node to
(agent_id, parent_agent_id). In plain LangChain every call is `default_agent`.

Limits of callbacks (LangChain's design): they cannot replace an immutable value. A plain-string tool result cannot be
rewritten by a callback (a ToolMessage can), so for string-returning tools wrap the tool function as well. Redaction
relies on in-place edits of the message objects LangChain passes to the callback.
"""
from typing import Any, Dict, List, Optional, Tuple
import uuid

import httpx
from langchain_core.callbacks import BaseCallbackHandler


class GovernanceDenied(Exception):
    """Raised from on_tool_start when governance denies a tool call; the tool is not executed."""


class GuardrailCallbackHandler(BaseCallbackHandler):
    raise_error = True   # let GovernanceDenied propagate out of the tool call

    def __init__(self, base_url: str = "http://localhost:8000", user_id: str = "demo-user",
                 session_id: Optional[str] = None, default_agent: str = "agent",
                 agent_for_node: Optional[Dict[str, Tuple[str, Optional[str]]]] = None,
                 allowed_tools: Optional[Dict[str, List[str]]] = None,
                 tool_risk: Optional[Dict[str, str]] = None, timeout: float = 2.0):
        self.base = base_url.rstrip("/") + "/api/v1/"
        self.user_id = user_id
        self.session_id = session_id or str(uuid.uuid4())
        self.default_agent = default_agent
        self.agent_for_node = agent_for_node or {}
        self.allowed_tools = allowed_tools or {}
        self.tool_risk = tool_risk or {}
        self.client = httpx.Client(timeout=timeout)
        self.log: List[Dict[str, Any]] = []          # what governance decided, for demos and tests
        self.tool_calls = self.tool_blocked = self.llm_calls = 0
        self.agents_seen: List[str] = []
        self._runs: Dict[Any, Dict[str, Any]] = {}   # run_id -> identity, because *_end callbacks carry no node metadata

    # ---- helpers -------------------------------------------------------------------------------------------
    def _identity(self, metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        node = (metadata or {}).get("langgraph_node")
        agent, parent = self.agent_for_node.get(node, (node or self.default_agent, None))
        if agent not in self.agents_seen:
            self.agents_seen.append(agent)
        return {"user_id": self.user_id, "agent_id": agent, "session_id": self.session_id, "parent_agent_id": parent}

    def _post(self, hook: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            return self.client.post(self.base + hook, json=payload).json()
        except Exception:
            return {}   # same fail-open behaviour as the GuardRailBench when governance is unreachable

    @staticmethod
    def _text(content: Any) -> str:
        return content if isinstance(content, str) else str(content)

    # ---- prompts -------------------------------------------------------------------------------------------
    def on_chat_model_start(self, serialized, messages, *, run_id=None, metadata=None, **kwargs):
        self.llm_calls += 1
        ident = self._identity(metadata)
        self._runs[run_id] = ident
        last = messages[0][-1] if messages and messages[0] else None
        if last is None or not isinstance(last.content, str):
            return
        out = self._post("on_prompt_received", {**ident, "prompt": last.content}).get("prompt")
        self.log.append({"hook": "prompt", "agent": ident["agent_id"], "in": last.content, "out": out})
        if out is not None:
            last.content = out   # redact in place

    def on_llm_start(self, serialized, prompts, *, run_id=None, metadata=None, **kwargs):
        self.llm_calls += 1
        ident = self._identity(metadata)
        self._runs[run_id] = ident
        for i, p in enumerate(prompts):
            out = self._post("on_prompt_received", {**ident, "prompt": p}).get("prompt")
            self.log.append({"hook": "prompt", "agent": ident["agent_id"], "in": p, "out": out})
            if out is not None:
                prompts[i] = out

    # ---- completions ---------------------------------------------------------------------------------------
    def on_llm_end(self, response, *, run_id=None, metadata=None, **kwargs):
        ident = self._runs.pop(run_id, None) or self._identity(kwargs.get("metadata") or metadata)
        for gens in response.generations:
            for g in gens:
                text = self._text(getattr(g, "text", "") or "")
                usage = (getattr(response, "llm_output", None) or {}).get("token_usage", {}) or {}
                out = self._post("on_completion_received", {
                    **ident, "completion": text,
                    "prompt_tokens": usage.get("prompt_tokens", 0), "completion_tokens": usage.get("completion_tokens", 0),
                    "latency_ms": 0}).get("completion")
                self.log.append({"hook": "completion", "agent": ident["agent_id"], "in": text, "out": out})
                if out is not None and out != text:
                    g.text = out
                    if getattr(g, "message", None) is not None and isinstance(g.message.content, str):
                        g.message.content = out

    # ---- tools ---------------------------------------------------------------------------------------------
    def on_tool_start(self, serialized, input_str, *, run_id=None, inputs=None, metadata=None, **kwargs):
        ident = self._identity(metadata)
        self._runs[run_id] = ident
        name = (serialized or {}).get("name") or kwargs.get("name") or "tool"
        self.tool_calls += 1
        allow = self._post("on_tool_call", {
            **ident, "tool_name": name, "tool_args": inputs if isinstance(inputs, dict) else {"input": input_str},
            "tool_risk": self.tool_risk.get(name, "medium"),
            "agent_allowed_tools": self.allowed_tools.get(ident["agent_id"], [name] if ident["agent_id"] == self.default_agent else []),
        }).get("allow", True)
        self.log.append({"hook": "tool_call", "agent": ident["agent_id"], "tool": name, "allow": allow})
        if not allow:
            self._runs.pop(run_id, None)
            self.tool_blocked += 1
            raise GovernanceDenied(f"BLOCKED: tool '{name}' was denied by governance policy")

    def on_tool_end(self, output, *, run_id=None, metadata=None, **kwargs):
        ident = self._runs.pop(run_id, None) or self._identity(metadata)
        content = getattr(output, "content", output)
        text = self._text(content)
        out = self._post("on_tool_result", {**ident, "tool_name": getattr(output, "name", None) or "tool",
                                            "result": text, "tool_succeeded": not text.startswith("ERROR"),
                                            "latency_ms": 0}).get("result")
        self.log.append({"hook": "tool_result", "agent": ident["agent_id"], "in": text, "out": out})
        if out is not None and hasattr(output, "content") and out != text:
            output.content = out   # ToolMessage: redact in place

    # ---- end of a request ----------------------------------------------------------------------------------
    def finish(self, agent: Optional[str] = None) -> None:
        self._post("on_session_end", {"user_id": self.user_id, "agent_id": agent or self.default_agent,
                                      "session_id": self.session_id, "parent_agent_id": None,
                                      "summary": {"llm_calls": self.llm_calls, "tools_attempted": self.tool_calls,
                                                  "tools_blocked": self.tool_blocked, "agents_involved": self.agents_seen}})
