import hashlib
from typing import Dict, List, Tuple, Any, Optional
from pii_proxy.pii_detector import PIIDetector, PIIMatch

class PIISessionVault:
    """
    Bi-directional mapping vault between sensitive PII text and anonymous placeholders.
    Maintained per request/session to allow accurate re-hydration of completions.
    """
    def __init__(self):
        self.placeholder_to_original: Dict[str, str] = {}
        self.original_to_placeholder: Dict[str, str] = {}
        self.category_counters: Dict[str, int] = {}

    def get_or_create_placeholder(self, original_text: str, entity_type: str) -> str:
        if original_text in self.original_to_placeholder:
            return self.original_to_placeholder[original_text]

        count = self.category_counters.get(entity_type, 0) + 1
        self.category_counters[entity_type] = count
        placeholder = f"[{entity_type}_{count}]"

        self.placeholder_to_original[placeholder] = original_text
        self.original_to_placeholder[original_text] = placeholder
        return placeholder

    def de_anonymize(self, text: str) -> str:
        """Replace placeholders in text back with original PII values."""
        result = text
        for placeholder, original in self.placeholder_to_original.items():
            result = result.replace(placeholder, original)
        return result


class PIIAnonymizer:
    """
    Applies 4 configurable compliance actions to detected PII:
    - REDACT: Replace with static [REDACTED_TYPE]
    - BLOCK: Raise error / reject request if PII found
    - HASH: Replace with [HASH:sha256...]
    - LOG_ONLY: Keep original text, but log detection
    """

    def __init__(self, detector: Optional[PIIDetector] = None):
        self.detector = detector or PIIDetector()

    def process_text(
        self,
        text: str,
        vault: PIISessionVault,
        mode: str = "REDACT",
        check_hipaa: bool = True,
        check_dpdp: bool = True,
        aggressive_names: bool = False
    ) -> Tuple[str, List[PIIMatch]]:
        """
        Process text, replace detected PII based on mode, and return anonymized text + list of matches.
        """
        matches = self.detector.detect(text, check_hipaa=check_hipaa, check_dpdp=check_dpdp, aggressive_names=aggressive_names)
        if not matches:
            return text, []

        if mode == "BLOCK" and len(matches) > 0:
            raise ValueError(f"Compliance Policy Violation: Prompt contains {len(matches)} PII items.")

        if mode == "LOG_ONLY":
            return text, matches

        # Replace from back to front to preserve line/char offsets
        result_chars = list(text)
        sorted_matches = sorted(matches, key=lambda x: x.start, reverse=True)

        for match in sorted_matches:
            if mode == "HASH":
                h = hashlib.sha256(match.text.encode()).hexdigest()[:8]
                replacement = f"[HASH:{h}]"
            else: # REDACT or fallback
                replacement = f"[REDACTED_{match.entity_type}]"

            result_chars[match.start:match.end] = list(replacement)

        anonymized_text = "".join(result_chars)
        return anonymized_text, matches

    def process_messages(
        self,
        messages: List[Dict[str, Any]],
        vault: PIISessionVault,
        mode: str = "ANONYMIZE",
        check_hipaa: bool = True,
        check_dpdp: bool = True
    ) -> Tuple[List[Dict[str, Any]], List[PIIMatch]]:
        """
        Process a list of OpenAI format messages (system, user, assistant).
        """
        all_matches: List[PIIMatch] = []
        processed_messages: List[Dict[str, Any]] = []

        for msg in messages:
            new_msg = dict(msg)
            content = new_msg.get("content")

            if isinstance(content, str) and content:
                anon_text, matches = self.process_text(content, vault, mode=mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                new_msg["content"] = anon_text
                all_matches.extend(matches)
            elif isinstance(content, list):
                # Handle multi-modal or list content blocks
                new_content_list = []
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        sub_text = item.get("text", "")
                        anon_text, matches = self.process_text(sub_text, vault, mode=mode, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
                        item_copy = dict(item)
                        item_copy["text"] = anon_text
                        new_content_list.append(item_copy)
                        all_matches.extend(matches)
                    else:
                        new_content_list.append(item)
                new_msg["content"] = new_content_list

            processed_messages.append(new_msg)

        return processed_messages, all_matches

    def process_output(
        self,
        text: str,
        vault: Optional[PIISessionVault] = None,
        mode: str = "REDACT",
        check_hipaa: bool = True,
        check_dpdp: bool = True,
    ) -> Tuple[str, List[PIIMatch]]:
        """
        Scan LLM output for HIPAA/DPDP compliance violations and apply mode (REDACT, HASH, BLOCK, LOG_ONLY).
        Raises ValueError if mode == 'BLOCK' and compliance violations are found.
        """
        matches = self.detector.detect(text, check_hipaa=check_hipaa, check_dpdp=check_dpdp)
        if not matches:
            return text, []

        if mode == "BLOCK" and len(matches) > 0:
            raise ValueError(f"Compliance Policy Violation (Egress): LLM output contained {len(matches)} prohibited personal identifier(s).")

        if mode == "LOG_ONLY":
            return text, matches

        result_chars = list(text)
        sorted_matches = sorted(matches, key=lambda x: x.start, reverse=True)

        for match in sorted_matches:
            if mode == "HASH":
                h = hashlib.sha256(match.text.encode()).hexdigest()[:8]
                replacement = f"[HASH:{h}]"
            else:
                replacement = f"[REDACTED_{match.entity_type}]"

            result_chars[match.start:match.end] = list(replacement)

        anonymized_text = "".join(result_chars)
        return anonymized_text, matches
