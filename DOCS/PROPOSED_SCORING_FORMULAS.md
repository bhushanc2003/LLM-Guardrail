# PII Guardrail — Scoring Formulas & Metric Alternatives

This document provides simple, human-readable formulas for the 3 core governance metrics on the PII Guardrail platform.

---

## The 3 Core Metrics

```
+--------------------------------------------------------------------------+
|                        3 CORE GOVERNANCE METRICS                         |
+--------------------------------------------------------------------------+
|                                                                          |
|  1. AUTHORITY-TRUST SCORE (0 - 100)                                      |
|     Streak-based exponential growth + severity-based penalties.           |
|     Trust builds slowly, violations reset everything.                    |
|                                                                          |
|  2. VIOLATION FREQUENCY (Graph)                                          |
|     Time-series chart of violations by type (not a single number).       |
|                                                                          |
|  3. EFFECTIVE-USE SCORE (0% - 100%)                                      |
|     Clean requests / Total requests × 100.                               |
|     Clean = no guardrail intervention at all.                            |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## 1. Authority-Trust Score (0 – 100)
*Trust is built through streaks of clean behavior. One violation resets everything.*

### Core Principle
> **Streak-based exponential growth + Severity-based penalties**
> - Trust grows with **consecutive** clean requests (streak counter)
> - A violation **resets the streak to zero** — you start earning trust from scratch
> - The penalty depends on **what PII was leaked** (not all violations are equal)
> - Past penalties **never disappear** — your history follows you

### Formula:
```
Authority-Trust = Base + Streak Bonus − Cumulative Penalties

Where:
  Base               = 80.0 (default starting score)
  Streak Bonus       = 20 × (1 − e^(−current_streak / 25))   [Max +20 pts, bringing score to 100]
  current_streak     = consecutive clean requests since last violation
  Cumulative Penalties = sum of all past violation penalties
```

### What Happens on Each Request:

```
  Clean Request  →  current_streak += 1  →  Streak Bonus grows towards +20 pts
  Violation      →  current_streak = 0   →  Streak Bonus drops to ZERO
                    + apply severity penalty based on PII type detected
```

### How Trust is Earned (Exponential Streak Growth):

| Current Streak | Streak Bonus (of 20 max) | Resulting Score (Base 80 + Bonus) |
| :---: | :---: | :---: |
| 0 (Start) | +0.0 | 80.0 |
| 5 | +3.6 | 83.6 |
| 10 | +6.6 | 86.6 |
| 25 | +12.6 | 92.6 |
| 50 | +17.3 | 97.3 |
| 100 | +19.6 | 99.6 |

**One violation → streak resets to 0 → bonus drops back to 0.**
You have to rebuild from scratch.

### How Trust is Lost (Severity-Based Penalties):
The penalty depends on **what type of PII was leaked**:

| Severity | PII Types | Penalty | Why |
| :--- | :--- | :---: | :--- |
| 🟢 **Low** | Names, generic identifiers | **−3 pts** | Common, low risk |
| 🟡 **Medium** | Email addresses, phone numbers, physical addresses | **−8 pts** | Personal but recoverable |
| 🔴 **High** | SSN, credit card numbers, passport numbers | **−15 pts** | Identity theft risk |
| ⛔ **Critical** | Medical records, bank accounts, biometric data | **−25 pts** | Irreversible damage |

> If a single request leaks **multiple PII types**, use the **highest severity** penalty.

### Base Score:
- Standard User: **50 points**
- Admin User: **60 points**

### Score Bounds:
- Clamped between **0** (minimum) and **100** (maximum)

### Example — Trust Built, Then Lost, Then Rebuilt:

```
PHASE 1: User builds trust with 20 clean requests
─────────────────────────────────────────────
  Base            =  50.0
  Streak (20)     =  50 × (1 − e^(−20/25)) = +27.5
  Penalties       =  0
  SCORE           =  77.5  →  Tier 2: Trusted Operator  ✅

PHASE 2: User leaks a credit card number (High severity)
─────────────────────────────────────────────
  Streak resets   →  0  (bonus drops to 0)
  Penalty applied →  −15 pts (High: credit card)
  Base            =  50.0
  Streak (0)      =  0
  Penalties       =  −15
  SCORE           =  35.0  →  Tier 4: Restricted  🔴

PHASE 3: User rebuilds with 30 more clean requests
─────────────────────────────────────────────
  Base            =  50.0
  Streak (30)     =  50 × (1 − e^(−30/25)) = +34.9
  Penalties       =  −15  (still there from Phase 2!)
  SCORE           =  69.9  →  Tier 2: Trusted Operator  ✅
  (But notice: they needed 30 requests just to recover!)
```

### Trust Tier Classification:
| Score Range | Tier Title | What It Means | Color |
| :--- | :--- | :--- | :--- |
| **85 – 100** | **Tier 1: High Authority** | Proven track record; full access | Emerald (`#10b981`) |
| **65 – 84** | **Tier 2: Trusted Operator** | Standard operating status | Cyan (`#00f2fe`) |
| **40 – 64** | **Tier 3: Moderate Trust** | Under monitoring; needs improvement | Amber (`#f59e0b`) |
| **Below 40** | **Tier 4: Restricted** | High compliance risk; limited access | Rose (`#fb7185`) |

---

## 2. Violation Frequency (Graph — Not a Score)
*Visualized as a time-series chart, not a single number.*

### Why a Graph?
A single percentage (e.g., "12%") hides important context:
- **When** did violations happen? (Recently? Months ago?)
- **Are they trending** up or down?
- **Was it a one-time incident** or a pattern?

A graph answers all of these at a glance.

### What the Graph Shows:
```
  Y-axis: Number of violations (per day/week)
  X-axis: Time (last 30 days)
  
  Data points:
    - Redacted requests
    - Blocked requests
    - Hashed requests
    - Logged requests
```

### Graph Types:
- **Bar chart** (stacked by violation type) — best for daily breakdown
- **Line chart** (trend over time) — best for spotting patterns

### Data Tracked Per Time Period:
| Category | Meaning | Color on Graph |
| :--- | :--- | :--- |
| **Redacted** | PII was detected and masked | Amber |
| **Blocked** | Request was rejected entirely | Rose |
| **Hashed** | PII was hashed/pseudonymized | Cyan |
| **Logged** | PII was flagged and logged | Slate |

> **No formula needed.** The graph speaks for itself.
> The dashboard card shows the graph directly instead of a gauge.

---

## 3. Effective-Use Score (0% – 100%)
*What percentage of your requests were completely clean?*

### Core Logic:
> A request is **"clean"** only if it required **zero intervention** from the guardrail.
> Any request that was blocked, redacted, hashed, or logged is **not clean**.

### Formula:
```
                                    Clean Requests
Effective-Use Score (%) = ─────────────────────────────── × 100
                                   Total Requests
```

Where:
```
Clean Requests = Total − Blocked − Redacted − Hashed − Logged
```

### Example:
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

> **Simple rule:** If the guardrail had to do anything to your request, it's not clean.

---

## 4. UI Dashboard Layout

```
+--------------------+--------------------+--------------------+--------------------+
|  AUTHORITY-TRUST   |     VIOLATION      |   EFFECTIVE-USE    |    TOTAL TOKENS    |
|       SCORE        |     FREQUENCY      |       SCORE        |      TRACKED       |
|                    |                    |                    |                    |
|    77.5 / 100  (O) |   [BAR CHART]      |      82.0%     (O) |     10,000     (O) |
|                    |   ▁▂▃▅▂▁▁▃▂▁      |                    |                    |
|   [Tier 2 Badge]   |  Trend: last 30d   | 82 clean / 100 req | 8,000 in / 2,000 out|
+--------------------+--------------------+--------------------+--------------------+
```

- **(O)** = circular gauge widget
- Violation Frequency card shows a **mini bar chart** instead of a gauge

