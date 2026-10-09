import os
import json

if os.getenv("VERCEL"):
    CONFIG_FILE = "/tmp/config.json"
else:
    CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "config.json")

class Config:
    def __init__(self):
        self.UPSTREAM_BASE_URL: str = os.getenv("UPSTREAM_BASE_URL", "https://ai-gpu-node.tailfa114b.ts.net/api/v1")
        self.DEFAULT_MODEL_ID: str = os.getenv("DEFAULT_MODEL_ID", "nvidia/Qwen3.6-35B-A3B-NVFP4")
        self.EMBEDDING_MODEL_ID: str = os.getenv("EMBEDDING_MODEL_ID", "BAAI/bge-small-en-v1.5")
        
        self.HOST: str = os.getenv("HOST", "0.0.0.0")
        self.PORT: int = int(os.getenv("PORT", "8000"))
        
        self._pii_action_mode: str = os.getenv("PII_ACTION_MODE", "HASH")
        self.DEANONYMIZE_OUTPUT: bool = os.getenv("DEANONYMIZE_OUTPUT", "true").lower() == "true"
        self.ENABLE_AUDIT_LOG: bool = os.getenv("ENABLE_AUDIT_LOG", "true").lower() == "true"

    @property
    def PII_ACTION_MODE(self) -> str:
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    data = json.load(f)
                    return data.get("pii_action_mode", self._pii_action_mode)
            except Exception:
                pass
        return self._pii_action_mode

    @PII_ACTION_MODE.setter
    def PII_ACTION_MODE(self, mode: str):
        self._pii_action_mode = mode.upper()
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            data = {}
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, "r") as f:
                    data = json.load(f)
            data["pii_action_mode"] = self._pii_action_mode
            with open(CONFIG_FILE, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Warning persisting config: {e}")

config = Config()
