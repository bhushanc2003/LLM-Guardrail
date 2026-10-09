# PII Guardrail — Scoring Formulas & Token Metrics Reference

This document explains in plain language, ASCII math, and Python reference code how the system calculates:
1. **Total Token Consumption (Input vs. Output)**
2. **Violation Frequency (Violation Score)**
3. **Effective-Use Score**
4. **Authority-Trust Score & Trust Tiers**

---

## 1. Token Tracking (Input & Output Tokens)

Each LLM interaction processed through the proxy consists of two distinct token streams:

```
[User Prompt Ingress]  ──►  prompt_tokens     (Input Tokens)
[LLM Model Response]   ──►  completion_tokens (Output Tokens)
--------------------------------------------------------------
Total Tokens           =    Input Tokens + Output Tokens
```

### Formula
```
Total Tokens = prompt_tokens + completion_tokens
```

### How Tokens are Collected
1. **From Upstream LLM**: When the upstream provider (e.g., OpenAI, Ollama, vLLM) returns a `usage` dictionary in the completion response, the proxy extracts:
   - `prompt_tokens` (exact count)
   - `completion_tokens` (exact count)
2. **Fallback / Streaming Estimation**: If `usage` is omitted by the upstream provider or during streaming:
   - `prompt_tokens` = `length_of_all_messages_in_characters / 4`
   - `completion_tokens` = `length_of_response_text_in_characters / 4`
3. **Blocked Requests**: When a request is intercepted and blocked before reaching the model:
   - `prompt_tokens` = `length_of_user_prompt_in_characters / 4`
   - `completion_tokens` = `0` (never dispatched to LLM)

### Session-Level Aggregation
For each conversation session, tokens are summed across all requests within that session:
```
Session Input Tokens  = Sum of all request prompt_tokens
Session Output Tokens = Sum of all request completion_tokens
Session Total Tokens  = Session Input Tokens + Session Output Tokens
```

---

## 2. Violation Frequency Score

Measures the proportion of requests that violated privacy and compliance policies (i.e., contained sensitive PII that was redacted or blocked).

### Formula
```
                          Redacted Requests + Blocked Requests
Violation Frequency (%) = ──────────────────────────────────── × 100
                                     Total Requests
```

### Example
- Total Requests: `20`
- Clean (Allowed) Requests: `17`
- Redacted Requests: `2`
- Blocked Requests: `1`
- **Total Violations**: `2 + 1 = 3`
- **Violation Frequency**: `(3 / 20) × 100 = 15.0%`

---

## 3. Effective-Use Score (0 – 100)

Evaluates how efficiently and cleanly tokens are utilized. An operator who generates a high volume of compliant tokens receives a high score, whereas frequent PII violations degrade the score.

### Components
1. **Token Efficiency (%)**: The percentage of tokens spent on clean, non-violating requests:
   ```
                            Clean Request Tokens
   Token Efficiency (%) = ───────────────────────── × 100
                                Total Tokens
   ```
   *(Clean Request Tokens = total tokens consumed by requests with decision = 'allow')*

2. **Compliance Rate (%)**: The percentage of requests that passed without policy violations:
   ```
                           Clean Requests
   Compliance Rate (%) = ────────────────── × 100
                           Total Requests
   ```

### Composite Formula
```
Effective-Use Score = (0.6 × Token Efficiency) + (0.4 × Compliance Rate)
```

### Example
- Total Tokens = `10,000`
- Clean Tokens = `8,500`  ──►  Token Efficiency = `85.0%`
- Total Requests = `50`
- Clean Requests = `45`   ──►  Compliance Rate = `90.0%`
- **Effective-Use Score**:
  ```
  Score = (0.6 × 85.0) + (0.4 × 90.0)
        = 51.0 + 36.0
        = 87.0
  ```

---

## 4. Authority-Trust Score & Trust Tiers (0 – 100)

Determines the governance trust rating and risk level for each operator based on role privileges, violation frequency, severe penalties for blocked requests, and positive volume credit.

### Formula
```
Authority-Trust Score = Base Trust - Trust Penalty + Volume Credit
```
*(Bounded between a minimum of 5.0 and a maximum of 100.0)*

### Step-by-Step Variables:

1. **Base Trust**:
   - Standard User: `85.0`
   - Admin User: `95.0` (receives +10.0 administrative baseline)

2. **Trust Penalty**:
   ```
   Trust Penalty = (Violation Frequency % × 0.6) + (Blocked Requests × 4.0)
   ```
   - Each percentage point of violations subtracts `0.6` points.
   - Each hard-blocked payload carries a severe penalty of `-4.0` points.

3. **Volume Credit**:
   ```
   Volume Credit = Min(10.0, Total Requests × 0.3)
   ```
   - Grants `+0.3` points for each request processed, rewarding sustained, compliant operational history (capped at `+10.0` points).

4. **Clamping**:
   - If calculated score > 100.0, score = `100.0`
   - If calculated score < 5.0, score = `5.0`

### Example
An operator with:
- Role: Standard user (Base Trust = `85.0`)
- Total Requests: `25` ──► Volume Credit = `Min(10.0, 25 × 0.3) = 7.5`
- Violations: `2` redacted, `0` blocked ──► Violation Frequency = `(2 / 25) × 100 = 8.0%`
- Trust Penalty = `(8.0 × 0.6) + (0 × 4.0) = 4.8`

```
Authority-Trust Score = 85.0 - 4.8 + 7.5
                      = 87.7
```

### Trust Tier Classification

| Score Range | Tier Title | Status | Visual Indicator |
| :--- | :--- | :--- | :--- |
| **88.0 – 100.0** | **Tier 1: High Authority** | Zero Risk / Fully Trusted | 🟢 `#10b981` (Emerald) |
| **70.0 – 87.9** | **Tier 2: Trusted Operator** | Normal Operating Status | 🔵 `#00f2fe` (Cyan) |
| **50.0 – 69.9** | **Tier 3: Moderate Trust** | Elevated Monitoring Required | 🟡 `#f59e0b` (Amber) |
| **5.0 – 49.9** | **Tier 4: Restricted** | High Compliance Risk | 🔴 `#f43f5e` (Rose) |

---

## 5. Python Reference Implementation

The live implementation from `pii_proxy/main.py`:

```python
# 1. Token aggregation
total_requests = len(events)
prompt_tokens = sum(e.prompt_tokens or 0 for e in events)
completion_tokens = sum(e.completion_tokens or 0 for e in events)
total_tokens = prompt_tokens + completion_tokens

# User scores ONLY evaluate ingress (user prompt), ignoring model egress violations:
# If (e.pii_count or 0) == 0, the user's prompt was clean and user committed NO violation.
clean_requests = sum(1 for e in events if (e.pii_count or 0) == 0)
redacted_requests = sum(1 for e in events if (e.pii_count or 0) > 0 and (e.decision == "redact" or e.action_mode in ("REDACT", "HASH")))
blocked_requests = sum(1 for e in events if (e.pii_count or 0) > 0 and (e.decision == "block" or e.action_mode == "BLOCK"))
total_violations = redacted_requests + blocked_requests

# Output tokens for all requests are counted in token usage;
# Clean requests include their completion (output) tokens.
clean_tokens = sum((e.prompt_tokens or 0) + (e.completion_tokens or 0) for e in events if (e.pii_count or 0) == 0)
violation_tokens = total_tokens - clean_tokens

# 2. Violation frequency
violation_frequency_pct = round((total_violations / total_requests) * 100, 2) if total_requests else 0.0

# 3. Effective-use score
if total_tokens > 0:
    token_efficiency = (clean_tokens / total_tokens) * 100
else:
    token_efficiency = 100.0 if total_requests == 0 else ((clean_requests / total_requests) * 100)

compliance_rate = ((clean_requests / total_requests) * 100) if total_requests else 100.0
effective_use_score = round(0.6 * token_efficiency + 0.4 * compliance_rate, 1)

# 4. Authority-trust score
base_trust = 85.0
if target_user.role == "admin":
    base_trust += 10.0

trust_penalty = (violation_frequency_pct * 0.6) + (blocked_requests * 4.0)
volume_credit = min(10.0, total_requests * 0.3)
authority_trust_score = round(max(5.0, min(100.0, base_trust - trust_penalty + volume_credit)), 1)
```

---

## 5. Response Checking (Egress Guardrail) Scoring Policy

When the proxy inspects LLM output for HIPAA or DPDP compliance:

### 1. Zero Score Penalty for Users
- Egress violations stem from upstream context (vector search RAG retrieval, internal system instructions, or foundation model pre-training).
- The user is **not penalized** for sensitive entities returned by the LLM.
- Model output violations **do NOT increase** `violation_frequency_pct` or subtract `-4.0` points via `trust_penalty`.
- The user's **Authority-Trust Score**, **Effective-Use Score**, and **Trust Tier** evaluate strictly the user's prompt (ingress) adherence.

### 2. Output Token Accounting
- For every request, including requests intercepted during egress response checking, **output tokens (`completion_tokens`) are recorded and counted in full**.
- Both input tokens and output tokens appear in:
  - Total Token Consumption (`total_tokens = prompt_tokens + completion_tokens`)
  - Session-level input & output token breakdowns
  - Per-request and per-model telemetry
- If the user's prompt was clean (`pii_count == 0`), all tokens spent (prompt + completion) are credited to `clean_tokens`.

