"""
Real-model settings for the demo and the tests (any OpenAI-compatible endpoint). First found wins:
  1. explicit values (flags)
  2. env or LLM-Guardrail/.env:  DEMO_LLM_BASE_URL, DEMO_LLM_MODEL, DEMO_LLM_API_KEY
  3. the GuardRailBench .env (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY), if it sits next to this repo
Keys are used in memory and never printed.
"""
import glob
import os
from typing import Dict, Optional


def _read_env_file(path: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    try:
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def llm_settings(base_url: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, str]:
    """Returns {base_url, model, api_key, source}, or {} when no real model is configured."""
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mine = {**_read_env_file(os.path.join(repo, ".env")), **os.environ}
    got = {"base_url": base_url or mine.get("DEMO_LLM_BASE_URL"), "model": model or mine.get("DEMO_LLM_MODEL"),
           "api_key": api_key or mine.get("DEMO_LLM_API_KEY"), "source": "flags / DEMO_LLM_* settings"}
    if not (got["base_url"] and got["model"] and got["api_key"]):
        for path in glob.glob(os.path.join(os.path.dirname(repo), "GuardRailBench-Sample*", "GuardRailBench-Sample", ".env")):
            bench = _read_env_file(path)
            got = {"base_url": got["base_url"] or bench.get("LLM_BASE_URL"), "model": got["model"] or bench.get("LLM_MODEL"),
                   "api_key": got["api_key"] or bench.get("LLM_API_KEY"), "source": "the GuardRailBench .env (LLM_*)"}
            break
    return got if (got["base_url"] and got["model"] and got["api_key"]) else {}


def make_chat_model(cfg: Dict[str, str], tools=None):
    """A real chat model (tools bound if given)."""
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(base_url=cfg["base_url"], api_key=cfg["api_key"], model=cfg["model"], temperature=0, timeout=90, max_retries=1)
    return llm.bind_tools(tools) if tools else llm


NO_MODEL_HELP = ("No real model configured. Set DEMO_LLM_BASE_URL, DEMO_LLM_MODEL and DEMO_LLM_API_KEY (environment or "
                 "LLM-Guardrail/.env), or keep the GuardRailBench .env next to this repo.")
