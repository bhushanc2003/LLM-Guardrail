#!/usr/bin/env python3
"""
Latency / overhead benchmark for the governance runtime (problem statement objective 15).

Three measurements, all printed and saved to reports/latency_<timestamp>.md:

  A. Detector alone, in-process: regex only vs regex + Presidio NER, for 0.2 / 1 / 4 KB of text.
  B. The five hooks over HTTP against the running server (what the GuardRailBench actually waits for),
     reported as p50 / p95 / p99 in ms, next to a no-op round trip (GET /api/v1/hooks_status) so you can
     see how much is HTTP and how much is governance. The hooks must answer inside the bench's 2 s limit.
  C. (optional, --upstream) the same chat request sent straight to the model and through our proxy, to show
     the proxy's added latency per LLM call. Model time varies, so the overhead is the median difference.

Usage (server on :8000 running; venv active):
    python scripts/latency_benchmark.py
    python scripts/latency_benchmark.py --n 200 --upstream
    python scripts/latency_benchmark.py --base https://<your-vercel-app>   # or set BENCH_BASE in .env
The hook run writes events for the user 'latency-bench' (visible in the dashboard); delete that user afterwards if you like.
"""
import argparse
import os
import statistics
import sys
import time
import uuid

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:  # pick up BENCH_BASE, UPSTREAM_BASE_URL etc. from the repo's .env without having to `source` it
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
except Exception:
    pass

PII_TEXT = ("Name: Margaret Ellen Whitfield | MRN: MRN-000481923 | Diagnosis: Stage II invasive ductal carcinoma | "
            "Phone: (614) 555-0192 | Email: margaret.whitfield@example.com. Patients can book appointments through "
            "the portal and should arrive fifteen minutes early with insurance details. ")


def pct(values, p):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(p / 100 * (len(values) - 1))))]


def stats_row(ms):
    return {"n": len(ms), "p50": statistics.median(ms), "p95": pct(ms, 95), "p99": pct(ms, 99), "max": max(ms)}


def detector_bench(runs=30):
    """A. in-process detector timing, regex vs NER."""
    from pii_proxy.pii_detector import PIIDetector
    out = []
    for label, flag in (("regex only", "false"), ("regex + Presidio NER", "true")):
        os.environ["ENABLE_PRESIDIO"] = flag
        d = PIIDetector()
        if flag == "true" and d.presidio_analyzer is None:
            out.append((label, None))
            continue
        row = {}
        for size in (200, 1000, 4000):
            text = (PII_TEXT * 40)[:size]
            d.detect(text, aggressive_names=True)  # warm up
            ms = []
            for _ in range(runs):
                t = time.perf_counter()
                d.detect(text, aggressive_names=True)
                ms.append((time.perf_counter() - t) * 1000)
            row[size] = stats_row(ms)
        out.append((label, row))
    return out


def hook_bench(base, n, pause_ms=0):
    """B. hooks over HTTP."""
    ident = lambda sid, agent="orchestrator", parent=None: {"user_id": "latency-bench", "agent_id": agent, "session_id": sid, "parent_agent_id": parent}
    calls = {
        "on_prompt_received (1 KB, PII)": ("POST", "on_prompt_received", lambda s: {**ident(s), "prompt": PII_TEXT * 3}),
        "on_completion_received (300 chars, PII)": ("POST", "on_completion_received", lambda s: {**ident(s), "completion": PII_TEXT[:300], "prompt_tokens": 400, "completion_tokens": 80, "latency_ms": 700}),
        "on_tool_call (allowed)": ("POST", "on_tool_call", lambda s: {**ident(s, "data_agent", "orchestrator"), "tool_name": "search_patients", "tool_args": {"query": "Margaret"}, "tool_risk": "low", "agent_allowed_tools": ["search_patients"]}),
        "on_tool_call (denied, out of scope)": ("POST", "on_tool_call", lambda s: {**ident(s, "rogue_agent", "orchestrator"), "tool_name": "delete_file", "tool_args": {"filename": "x"}, "tool_risk": "high", "agent_allowed_tools": []}),
        "on_tool_result (500 chars, PII)": ("POST", "on_tool_result", lambda s: {**ident(s, "data_agent", "orchestrator"), "tool_name": "read_database", "result": PII_TEXT[:500], "tool_succeeded": True, "latency_ms": 5}),
        "on_session_end": ("POST", "on_session_end", lambda s: {**ident(s), "summary": {"total_tokens": 480, "llm_calls": 1}}),
    }
    rows = {}
    with httpx.Client(timeout=10) as c:
        for _ in range(10):  # warm up
            c.get(f"{base}/api/v1/hooks_status")
            c.post(f"{base}/api/v1/on_prompt_received", json={**ident("warm"), "prompt": PII_TEXT})
        ms = []
        for _ in range(n):
            t = time.perf_counter()
            c.get(f"{base}/api/v1/hooks_status")
            ms.append((time.perf_counter() - t) * 1000)
        rows["no-op round trip (baseline: HTTP only)"] = stats_row(ms)
        for name, (_, hook, make) in calls.items():
            ms = []
            for _ in range(n):
                sid = str(uuid.uuid4())
                t = time.perf_counter()
                r = c.post(f"{base}/api/v1/{hook}", json=make(sid))
                ms.append((time.perf_counter() - t) * 1000)
                r.raise_for_status()
                if pause_ms:
                    time.sleep(pause_ms / 1000)
            rows[name] = stats_row(ms)
    return rows


def upstream_bench(base, upstream, model, runs):
    """C. direct model call vs through the proxy."""
    body = {"model": model, "max_tokens": 8, "temperature": 0, "messages": [{"role": "user", "content": "Reply with the single word: ok"}]}
    direct, proxied = [], []
    with httpx.Client(timeout=120) as c:
        for i in range(runs + 1):
            t = time.perf_counter()
            r1 = c.post(f"{upstream}/chat/completions", json=body)
            d = (time.perf_counter() - t) * 1000
            t = time.perf_counter()
            r2 = c.post(f"{base}/proxy/latency-bench/v1/chat/completions", json=body)
            p = (time.perf_counter() - t) * 1000
            if i == 0:
                continue  # warm up
            if r1.status_code == 200 and r2.status_code == 200:
                direct.append(d)
                proxied.append(p)
    if not direct:
        return None
    return {"direct": stats_row(direct), "proxy": stats_row(proxied),
            "overhead_median_ms": statistics.median(p - d for p, d in zip(proxied, direct))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.getenv("BENCH_BASE", "http://localhost:8000"))
    ap.add_argument("--n", type=int, default=100, help="requests per hook")
    ap.add_argument("--upstream", action="store_true", help="also compare direct model call vs proxy")
    ap.add_argument("--upstream-url", default=os.getenv("UPSTREAM_BASE_URL", "https://ai-gpu-node.tailfa114b.ts.net/api/v1"))
    ap.add_argument("--model", default=os.getenv("DEFAULT_MODEL_ID", "nvidia/Qwen3.6-35B-A3B-NVFP4"))
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--pause-ms", type=int, default=0, help="sleep between hook calls; 0 = back-to-back stress, ~150 = realistic agent pace")
    args = ap.parse_args()

    lines = [f"# Latency benchmark ({time.strftime('%Y-%m-%d %H:%M:%S')})", ""]
    f = lambda v: f"{v:.1f}"

    print("A. detector alone (in-process) ...")
    lines += ["## A. Detector alone (in-process, ms per call)", "", "| Detector | 0.2 KB p50 / p95 | 1 KB p50 / p95 | 4 KB p50 / p95 |", "|---|---|---|---|"]
    for label, row in detector_bench():
        if row is None:
            lines.append(f"| {label} | not installed | | |")
        else:
            lines.append(f"| {label} | " + " | ".join(f"{f(row[s]['p50'])} / {f(row[s]['p95'])}" for s in (200, 1000, 4000)) + " |")

    print(f"B. hooks over HTTP against {args.base} (n={args.n} each) ...")
    try:
        rows = hook_bench(args.base, args.n, args.pause_ms)
    except Exception as e:
        sys.exit(f"Cannot benchmark hooks: {e}\nIs the server running on {args.base}?")
    lines += ["", f"## B. Hooks over HTTP (ms, n={args.n} each, pause {args.pause_ms} ms between calls; the bench times out at 2000 ms)", "",
              "| Hook | p50 | p95 | p99 | max |", "|---|---|---|---|---|"]
    base_p50 = rows["no-op round trip (baseline: HTTP only)"]["p50"]
    for name, r in rows.items():
        lines.append(f"| {name} | {f(r['p50'])} | {f(r['p95'])} | {f(r['p99'])} | {f(r['max'])} |")
    lines.append("")
    lines.append(f"Governance cost above a bare HTTP round trip (p50): " + ", ".join(
        f"{n.split(' (')[0]} +{f(r['p50'] - base_p50)} ms" for n, r in rows.items() if not n.startswith("no-op")))
    worst = max(r["max"] for r in rows.values())
    lines.append(f"\nSlowest single call: {f(worst)} ms ({'inside' if worst < 2000 else 'OVER'} the 2000 ms hook limit).")

    if args.upstream:
        print("C. direct model vs proxy ...")
        res = upstream_bench(args.base, args.upstream_url, args.model, args.runs)
        lines += ["", "## C. Proxy overhead per LLM call (ms)", ""]
        if res is None:
            lines.append("Upstream model unreachable; skipped.")
        else:
            lines += ["| Path | p50 | p95 |", "|---|---|---|",
                      f"| direct to model | {f(res['direct']['p50'])} | {f(res['direct']['p95'])} |",
                      f"| through proxy | {f(res['proxy']['p50'])} | {f(res['proxy']['p95'])} |", "",
                      f"Median added by the proxy: **{f(res['overhead_median_ms'])} ms** (model time varies between calls, so treat this as approximate)."]

    text = "\n".join(lines) + "\n"
    print("\n" + text)
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"latency_{time.strftime('%Y%m%d_%H%M%S')}.md")
    open(path, "w").write(text)
    print(f"saved {path}")


if __name__ == "__main__":
    main()
