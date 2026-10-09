#!/bin/bash
echo "=========================================================================="
echo " Starting PII Data Governance & Anonymization Proxy Server"
echo " Upstream Target: https://ai-gpu-node.tailfa114b.ts.net/api/v1"
echo " Model ID: nvidia/Qwen3.6-35B-A3B-NVFP4"
echo "=========================================================================="

cd "$(dirname "$0")"
source venv/bin/activate

# Load environment variables from .env file
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
fi

# Dev mode reloads on code changes but ONLY watches pii_proxy/ (watching the whole repo, including venv/ and
# node_modules/, burned ~60% CPU and slowed every request from ~2 ms to ~45 ms).
# For demos and latency numbers run without reload:  NO_RELOAD=1 ./start_proxy.sh
if [ -n "$NO_RELOAD" ]; then
    python3 -m uvicorn pii_proxy.main:app --host 0.0.0.0 --port 8000
else
    python3 -m uvicorn pii_proxy.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir pii_proxy
fi
