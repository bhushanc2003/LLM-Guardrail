# PII Guardrail — Scoring Formulas & Token Metrics Reference

This document explains in plain language, ASCII math, and Python reference code how the system calculates the **3 Core Governance Metrics** and token telemetry:
1. **Authority-Trust Score & Trust Tiers** (Exponential streak growth + severity penalties)
2. **Violation Frequency** (Time-series trend graph by breach category)
3. **Effective-Use Score** (Clean request ratio)
4. **Token Telemetry** (Input vs. output tokens across requests and models)

---

```
+--------------------------------------------------------------------------+
|                        3 CORE GOVERNANCE METRICS                         |
+--------------------------------------------------------------------------+
|                                                                          |
|  1. AUTHORITY-TRUST SCORE (0 - 100)                                      |
|     Streak-based exponential growth + severity-based penalties.          |
|     Trust builds slowly, violations reset the streak to zero.            |
|                                                                          |
|  2. VIOLATION FREQUENCY (Graph — Not a Single Score)                     |
|     Time-series daily breakdown of violations by category:               |
|     Redacted (Amber), Blocked (Rose), Hashed (Cyan), Logged (Slate).     |
|                                                                          |
|  3. EFFECTIVE-USE SCORE (0% - 100%)                                      |
|     Clean requests / Total requests × 100.                               |
|     Clean = zero guardrail intervention (no redact/block/hash/log).      |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## 1. Authority-Trust Score (0 – 100)
*Trust is built through streaks of clean behavior. One violation resets everything.*

### Core Principle
- **Streak-based exponential growth + Severity-based penalties**
- Trust grows with **consecutive clean requests** (streak counter)
- A violation **resets the streak to zero** — earning trust starts from scratch
- The penalty depends on **what PII was leaked** (not all violations are equal)
- Cumulative penalties **never disappear** — past compliance history follows the user

### Formula
```
Authority-Trust = Base + Streak Bonus − Cumulative Penalties

Where:
  Streak Bonus         = 50 × (1 − e^(−current_streak / 25))
  current_streak       = consecutive clean requests since last violation
  Cumulative Penalties = sum of all past violation penalties (never resets)
```

### Base Score
- Standard User: `50.0 points`
- Admin User: `60.0 points`

### Score Bounds
- Clamped between `0.0` (minimum) and `100.0` (maximum)

### How Trust is Earned (Exponential Streak Growth)
```
Clean Request → current_streak += 1 → Streak Bonus grows exponentially towards +50.0
```

| Current Streak | Streak Bonus (of 50 max) | % of Ceiling |
| :---: | :---: | :---: |
| 1 | +2.0 | 4% |
| 5 | +9.1 | 18% |
| 10 | +16.5 | 33% |
| 25 | +31.6 | 63% |
| 50 | +43.2 | 86% |
| 100 | +49.1 | 98% |

### How Trust is Lost (Severity-Based Penalties)
```
Violation → current_streak = 0 (Streak Bonus drops to 0) + apply penalty
```

| Severity | PII Types | Penalty | Rationale |
| :--- | :--- | :---: | :--- |
| 🟢 **Low** | Names, generic identifiers, dates, URLs, IPs | **−3 pts** | Common, low risk |
| 🟡 **Medium** | Email addresses, phone numbers, physical addresses, fax | **−8 pts** | Personal but recoverable |
| 🔴 **High** | SSN, credit cards, passport, Aadhaar, PAN, government IDs, denied tool call | **−15 pts** | Identity theft risk / boundary breach |
| ⛔ **Critical** | Medical records (MRN), bank accounts, biometric data, health beneficiary | **−25 pts** | Irreversible / high-liability damage |

> If a single request leaks **multiple PII types**, the **highest severity** penalty is applied.

### Trust Tier Classification

| Score Range | Tier Title | Status | Visual Indicator |
| :--- | :--- | :--- | :--- |
| **85.0 – 100.0** | **Tier 1: High Authority** | Proven track record; full access | 🟢 `#10b981` (Emerald) |
| **65.0 – 84.9** | **Tier 2: Trusted Operator** | Standard operating status | 🔵 `#00f2fe` (Cyan) |
| **40.0 – 64.9** | **Tier 3: Moderate Trust** | Under monitoring; needs improvement | 🟡 `#f59e0b` (Amber) |
| **Below 40.0** | **Tier 4: Restricted** | High compliance risk; limited access | 🔴 `#fb7185` (Rose) |

---

## 2. Violation Frequency (Graph — Not a Single Number)
*Visualized as a time-series chart, not a single opaque percentage.*

### Why a Graph?
A single percentage hides critical context:
- **When** did violations happen?
- **Are they trending** up or down?
- **Was it a one-time incident** or a repeated pattern?

### Data Tracked Per Time Period
The dashboard card displays a stacked mini bar chart across the last 14 to 30 days:
| Category | Meaning | Color on Graph |
| :--- | :--- | :--- |
| **Redacted** | PII detected and masked | Amber (`#f59e0b`) |
| **Blocked** | Request rejected entirely | Rose (`#fb7185`) |
| **Hashed** | PII pseudonymized/hashed | Cyan (`#00f2fe`) |
| **Logged** | PII flagged and logged in audit trail | Slate (`#94a3b8`) |
| **Clean** | Zero guardrail remediation needed | Emerald (`#10b981`) |

---

## 3. Effective-Use Score (0% – 100%)
*What percentage of user requests were completely clean?*

### Core Logic
> A request is **"clean"** only if it required **zero intervention** from the guardrail.
> Any request that was blocked, redacted, hashed, or logged is **not clean**.

### Formula
```
                                    Clean Requests
Effective-Use Score (%) = ─────────────────────────────── × 100
                                   Total Requests

Where:
Clean Requests = Total − Blocked − Redacted − Hashed − Logged − Denied
```

### Example
- Total Requests: `100`
- Clean: `82`
- Redacted: `8`
- Blocked: `5`
- Hashed: `3`
- Logged: `2`
```
Clean Requests      = 82
Effective-Use Score = (82 / 100) × 100 = 82.0%
```

---

## 4. Token Tracking (Input & Output Tokens)

Each LLM interaction processed through the proxy consists of two distinct token streams:
```
[User Prompt Ingress]  ──►  prompt_tokens     (Input Tokens)
[LLM Model Response]   ──►  completion_tokens (Output Tokens)
--------------------------------------------------------------
Total Tokens           =    Input Tokens + Output Tokens
```

### Output Token Accounting (Egress Guardrail Policy)
- The user is **only judged on user prompt ingress**. PII in model output (egress) or tool results does not penalize user trust.
- For every request, **output tokens (`completion_tokens`) are recorded and counted in full**.
- Both input and output tokens are visualized with the circular gauge and per-model consumption breakdown.

---

## 5. Python Reference Implementation

The implementation from `pii_proxy/main.py`:

```python
import math
from datetime import datetime, timedelta

def get_finding_severity(entity_type: str) -> str:
    ent = (entity_type or "").upper()
    if any(k in ent for k in ["MRN", "HEALTH", "MEDICAL", "BIOMETRIC", "BANK", "ACCOUNT_NUMBER", "UPI", "FINANCIAL"]):
        return "critical"
    if any(k in ent for k in ["SSN", "CREDIT_CARD", "PASSPORT", "AADHAAR", "PAN", "VOTER", "LICENSE", "DRIVING", "TAX_ID", "NATIONAL_ID"]):
        return "high"
    if any(k in ent for k in ["EMAIL", "PHONE", "TELEPHONE", "FAX", "ADDRESS"]):
        return "medium"
    return "low"

SEVERITY_PENALTIES = {"low": 3.0, "medium": 8.0, "high": 15.0, "critical": 25.0}

# 1. Classification & Effective-Use
total_requests = len(events)
classifications = [classify_event(e) for e in events]
clean_requests = sum(1 for c, _ in classifications if c == "clean")
effective_use_score = round((clean_requests / total_requests) * 100, 1) if total_requests > 0 else 100.0

# 2. Authority-Trust Score
base_score = 60.0 if user.role == "admin" else 50.0
chrono_events = sorted(events, key=lambda ev: ev.created_at or datetime.min)
current_streak = 0
cumulative_penalties = 0.0

for ev in chrono_events:
    cat, ents = classify_event(ev)
    if cat == "clean":
        current_streak += 1
    else:
        current_streak = 0
        penalty = max(SEVERITY_PENALTIES[get_finding_severity(ent)] for ent in ents) if ents else 15.0 if cat in ("denied", "blocked") else 8.0
        cumulative_penalties += penalty

streak_bonus = 50.0 * (1.0 - math.exp(-current_streak / 25.0))
raw_authority_trust = base_score + streak_bonus - cumulative_penalties
authority_trust_score = round(max(0.0, min(100.0, raw_authority_trust)), 1)
```
