# Compliance Detection Methods: HIPAA & DPDP (India 2023)

This document provides a comprehensive technical breakdown of all personal data identifiers tracked by the **PII Governance & Anonymization Engine**, detailing the exact detection methods, regex patterns, contextual heuristics, and validation algorithms employed for **HIPAA Safe Harbor** and the **Digital Personal Data Protection (DPDP) Act (India 2023)**.

---

## Architecture Overview: Hybrid Tiered Engine

The system uses a **multi-tiered, hybrid detection architecture**:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                            INBOUND PROMPT / LIVE LLM REQUEST                             │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                      FRAMEWORK ROUTER (User Compliance Settings)                         │
│                                                                                          │
│   • Shared PII: Always evaluated (Email, Phone, IP, Credit Cards, MAC, Basic Dates)      │
│   • HIPAA Toggle: Evaluates 15 Safe Harbor PHI rules (SSN, MRN, Health Plan, Clinical)  │
│   • DPDP Toggle:  Evaluates 27 Indian Personal Identifiers (Aadhaar, PAN, UPI, PIN, etc) │
└────────────┬───────────────────────────────┬──────────────────────────────┬──────────────┘
             │                               │                              │
   [ If HIPAA is ON ]             [ If DPDP is ON ]               [ Shared Active ]
             │                               │                              │
             ▼                               ▼                              ▼
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│   HIPAA DETECTOR (US)   │     │    DPDP DETECTOR (IN)   │     │    SHARED DETECTOR      │
│ ─────────────────────── │     │ ─────────────────────── │     │ ─────────────────────── │
│ • Social Security (SSN) │     │ • Aadhaar (12-digit UID)│     │ • Email (RFC 5322)      │
│ • Medical Record (MRN)  │     │ • PAN Card (10-char ITD)│     │ • IPv4 & IPv6 Addresses │
│ • Health Beneficiary ID │     │ • UPI Handles & VPAs    │     │ • Credit / Debit Cards  │
│ • Hospital Dates & DOB  │     │ • Indian Mobile (+91)   │     │ • Bank Account / IBAN   │
│ • Vehicle VIN & Plates  │     │ • Indian PIN Codes      │     │ • Street Addresses      │
│ • Medical License / DL  │     │ • Passport, Voter ID, DL│     │ • UUIDs, MAC Addresses  │
│ • Biometric / Face Meta │     │ • Salary, CTC, Stipends │     │ • Device Serial Numbers │
│ • Patient Specific IDs  │     │ • IFSC Bank Codes       │     │ • Standard Date of Birth│
└────────────┬────────────┘     └────────────┬────────────┘     └────────────┬────────────┘
             │                               │                               │
             └───────────────────────┬───────┴───────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                   AGGREGATION, DEDUPLICATION & CONFLICT RESOLUTION                       │
│                                                                                          │
│  • Offsets sorted chronologically: start_idx asc, length desc, confidence desc           │
│  • Overlapping entity suppression: Keeps highest-confidence / most-specific match        │
│  • Category Mapping: Normalizes entity types to DB Category IDs [1 - 15]                 │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             ENFORCEMENT ENGINE (Action Mode)                             │
├───────────────────┬───────────────────┬────────────────────┬─────────────────────────────┤
│      REDACT       │       BLOCK       │        HASH        │          LOG_ONLY           │
│ ───────────────── │ ───────────────── │ ────────────────── │ ─────────────────────────── │
│ Static label      │ Immediate HTTP    │ Deterministic HMAC │ Passes prompt as-is, records│
│ replacement       │ 400 rejection     │ SHA-256 pseudonym  │ tamper-evident hash to      │
│ e.g. [REDACTED_   │ Prevents data     │ allows entity      │ audit trail with zero       │
│ AADHAAR]          │ egress to LLM     │ joins              │ modification                │
└───────────────────┴───────────────────┴────────────────────┴─────────────────────────────┘
```

1. **Tier 0: High-Precision Deterministic Matchers (Format Validation & Checksums)**:
   - For structured IDs with mathematical checksums, formats, or schemas (e.g., PAN, Aadhaar Verhoeff, SSN, IFSC, UPI handles, Credit Cards Luhn, IPv4/v6, MAC, UUID).
   - Zero hallucinations, $O(N)$ execution speed ($< 0.5\text{ ms}$).
2. **Tier 1: Contextual Pattern & Boundary Heuristics (Fast-Path Mode)**:
   - For semi-structured or localized values (e.g., PIN codes, dates of admission/birth, employee numbers, MRNs).
   - Uses positive lookaheads/lookbehinds and keyword anchors (`DOB:`, `Salary:`, `Admitted:`, `Roll No:`) to avoid false positives.
3. **Tier 2 / Advanced Filtering: GLiNER 152M Zero-Shot Neural Decision Engine**:
   - Evaluates unstructured human names (e.g., *Rahul Sharma*, *Sarah Connor*), unanchored cities (*Bangalore*, *Kolkata*), and natural compensation (*INR 24 LPA*) when **Advanced Filtering** is enabled.
   - Operates in ~45-50ms with 0% false positives on clinical terms, completely superseding legacy Microsoft Presidio.

---

## 1. HIPAA Safe Harbor (15 Protected Health Information Categories)

The Health Insurance Portability and Accountability Act (HIPAA) Privacy Rule (§ 164.514) defines individual identifiers that constitute Protected Health Information (PHI). The 15 covered categories include:

| # | HIPAA Identifier Field | Category ID & Name | Detection Method | Underlying Pattern / Algorithm | Confidence |
|---|------------------------|--------------------|------------------|--------------------------------|:----------:|
| **1** | **Names** (including initials or family/employer names) | `1: Names` | Contextual Heuristics + Presidio NLP | Context title prefixes: `(?i:Dr.\|Mr.\|Mrs.\|Ms.\|Patient\|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)` + Presidio `PERSON` entity | `0.91` |
| **2** | **Geographical data smaller than a state** (street address, city, county, ZIP code) | `2: Geographical Data` | Regex Grammar + Prefix Matching | Standard street types: `\b\d{1,5}\s+[\w\s.,#-]+?\s+(Street\|St\|Avenue\|Ave\|Road\|Rd\|Boulevard\|Blvd\|Drive\|Lane\|Court\|Way)\b`<br>US ZIP: `(?:\bZIP[:\s]+)?\d{5}(?:-\d{4})?\b` | `0.95` |
| **3** | **Dates directly related to an individual** (birth, admission, discharge, death years alone are generally excluded) | `3: Dates (Individual)` | Contextual Heuristics + ISO/Slash Date Regex | Clinical events: `(?i:Admitted\|Admission\|Discharged\|Died\|Surgery Date)[:\s]+(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\|\d{4}[/-]\d{1,2}[/-]\d{1,2})`<br>DOB: `(?i:DOB\|Birth\|Born)[:\s]+...` | `0.94` |
| **4** | **Telephone numbers** | `4: Telephone Numbers` | E.164 & NANP Regex Parser | NANP phone: `(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b`<br>Prefix keyword phone: `(?i:Phone\|Tel\|Cell)[:\s]+...` | `0.90` |
| **5** | **Fax numbers** | `5: Fax Numbers` | Keyword-Anchored Regex | `(?i:Fax)[:#\s]+(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b` | `0.95` |
| **6** | **Email addresses** | `6: Email Addresses` | RFC 5322 Compliant Regex | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` | `0.99` |
| **7** | **Social Security numbers (SSN)** | `7: Social Security Numbers (SSN)` | Deterministic Format Regex | 9-digit format: `\b\d{3}-\d{2}-\d{4}\b`<br>Keyword match: `(?i:SSN\|Social Security)[:#\s]+\d{3}[-\s]?\d{2}[-\s]?\d{4}\b` | `0.98` |
| **8** | **Medical record numbers (MRN)** | `8: Medical Record Numbers (MRN)` | Healthcare Context Regex | Format: `(?i:MRN\|Medical Record Number\|Med Rec #)[:#\s]+[A-Za-z0-9-]{6,12}\b` and `\bMRN-\d{6,10}\b` | `0.96` |
| **9** | **Health plan beneficiary numbers** | `9: Health Plan Beneficiary Numbers` | Insurance Policy Context Matcher | `(?i:Health Plan\|Beneficiary ID\|Policy #\|Member ID\|HICN\|Medicare ID)[:#\s]+[A-Za-z0-9-]{7,15}\b` | `0.95` |
| **10** | **Account numbers** | `10: Account Numbers` | Keyword-Bounded Regex | `(?i:Account #\|Acct #\|Bank Account\|IBAN)[:#\s]+[A-Za-z0-9-]{8,22}\b` | `0.95` |
| **11** | **Certificate/license numbers** | `11: Certificate/License Numbers` | State & Medical License Pattern | `(?i:Driver'?s License\|DL #\|License #\|Cert #\|Certificate #)[:#\s]+[A-Za-z0-9-]{6,16}\b` | `0.94` |
| **12** | **Vehicle identifiers and serial numbers (including license plates)** | `12: Vehicle Identifiers` | ISO 3779 VIN + License Plate Grammar | VIN (excluding I, O, Q): `\b[A-HJ-NPR-Z0-9]{17}\b`<br>Plate: `(?i:License Plate\|Plate #)[:#\s]+[A-Z0-9-]{3,8}\b` | `0.95` |
| **13** | **Device identifiers and serial numbers** | `13: Device Identifiers` | Hardware Identifier Regex | `(?i:Serial Number\|Serial #\|IMEI\|Device ID)[:#\s]+[A-Za-z0-9-]{8,20}\b` | `0.93` |
| **14** | **Web URLs** | `14: Web URLs` | URI Scheme Grammar | `\bhttps?://[^\s<>"{}|\\^`]+` and `\bwww\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}` | `0.98` |
| **15** | **IP address numbers** | `15: IP Addresses` | Octet-bounded IPv4 & IPv6 Regex | IPv4: `\b(?:(?:25[0-5]\|2[0-4][0-9]\|[01]?[0-9][0-9]?)\.){3}(?:...)\b`<br>IPv6: standard 128-bit hex format | `0.99` |

---

## 2. Digital Personal Data Protection (DPDP) Act — India 2023

Under India's DPDP Act, personal data is defined broadly as any data about an individual who is identifiable by or in relation to such data. The detector implements **27 specific identifiers and contextual attributes**:

| # | DPDP Identifier Field | Category ID & Name | Detection Method | Exact Pattern & Validation Heuristic | Confidence |
|---|-----------------------|--------------------|------------------|---------------------------------------|:----------:|
| **1** | **Aadhaar Number** | `7: Social Security Numbers` | Verhoeff-bounded 12-Digit Regex | `\b[2-9]\d{3}\s\d{4}\s\d{4}\b`<br>Or with keyword: `(?i:Aadhaar\|UIDAI\|Aadhar)[:#\s]+[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b` (First digit $\in [2-9]$) | `0.99` |
| **2** | **Permanent Account Number (PAN)** | `11: Certificate/License Numbers` | Indian Income Tax Dept Syntax Grammar | 5 uppercase letters (4th char = status: P, C, H, F, A, T, B, L, J, G), 4 numeric digits, 1 alphabetic check character: `\b[A-Z]{5}[0-9]{4}[A-Z]\b` | `0.99` |
| **3** | **Unified Payments Interface (UPI) ID** | `10: Account Numbers` | VPA Bank Handle Grammar | `\b[a-zA-Z0-9.\-_]{2,64}@(okaxis\|okhdfcbank\|oksbi\|okicici\|paytm\|ybl\|ibl\|upi\|axl\|apl\|barodampay\|federal\|kotak\|postbank\|idfcbank\|gpay\|phonepe)\b` | `0.98` |
| **4** | **Indian Mobile Numbers** | `4: Telephone Numbers` | TRAI Standard +91 / 10-Digit Grammar | Starts with valid Indian mobile series (6, 7, 8, 9): `\b(?:\+91[\s-]?)?[6-9]\d{9}\b` | `0.95` |
| **5** | **Indian PIN Code** (Postal Index Number) | `2: Geographical Data` | Context-bounded 6-digit Regex | Non-zero prefix (1-9) with postal anchor: `(?i:PIN\|PIN Code\|Pin\|Postal Code)[:#\s]+[1-9][0-9]{5}\b` | `0.95` |
| **6** | **Indian Passport Number** | `11: Certificate/License Numbers` | Ministry of External Affairs Format | 1 uppercase letter followed by 7 numeric digits: `(?i:Passport\|Passport No)[:#\s]+[A-Z][0-9]{7}\b` | `0.95` |
| **7** | **Voter ID (EPIC Card)** | `11: Certificate/License Numbers` | Election Commission of India 10-Char Syntax | 3 uppercase letters followed by 7 numeric digits: `(?i:Voter ID\|EPIC)[:#\s]+[A-Z]{3}[0-9]{7}\b` or `\b[A-Z]{3}[0-9]{7}\b` | `0.95` |
| **8** | **Indian Driving Licence (DL)** | `11: Certificate/License Numbers` | Parivahan Sarathi Syntax | 2-letter state code + 2-digit RTO + 11-digit license series: `\b[A-Z]{2}[0-9]{2}[-\s]?[0-9]{11}\b` | `0.94` |
| **9** | **Indian Financial System Code (IFSC)** | `10: Account Numbers` | RBI 11-Character Bank Branch Regex | 4 alphabetic chars (bank), fifth character always `0`, 6 alphanumeric chars (branch): `\b[A-Z]{4}0[A-Z0-9]{6}\b` | `0.92` |
| **10** | **Employee ID / Workplace Number** | `11: Certificate/License Numbers` | Corporate Context Heuristic | `(?i:Employee ID\|Emp ID\|Staff ID\|Worker ID)[:#\s]+[A-Za-z0-9-]{4,16}\b` | `0.93` |
| **11** | **Salary, CTC & Compensation History** | `10: Account Numbers` | Currency Symbol + Denomination Heuristic | `(?i:Salary\|Income\|CTC\|Annual Package\|Stipend)[:#\s]+(?:₹\|Rs\.?\|INR\s*)?[\d.,]+(?:\s*(?:LPA\|per annum\|p\.a\.\|per month\|pm\|lakhs?\|crores?\|k))?\b` | `0.92` |
| **12** | **Student ID, Roll No & Academic Records** | `11: Certificate/License Numbers` | Institution Context Heuristic | `(?i:Student ID\|Roll No\|Enrollment No\|Registration No)[:#\s]+[A-Za-z0-9-]{4,16}\b` | `0.92` |
| **13** | **Personal & Professional Names** | `1: Names` | Honorifics Heuristics + Presidio NLP | Contextual name detection matching Indian prefixes (Shri, Smt, Dr., Prof.) and capitalized full names | `0.91` |
| **14** | **Residential & Commercial Addresses** | `2: Geographical Data` | Locality + Building Number Context | `(?i:Address\|Location\|Residential Address)[:#\s]+[A-Za-z0-9\s.,#-]+?(?=\s*,\|\s*Zip\|\s*PIN\|\s*\n\|$)` | `0.92` |
| **15** | **City, District & Locality Information** | `2: Geographical Data` | Geopolitical Context Regex | `(?i:City\|Town\|Locality\|District)[:#\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)` | `0.88` |
| **16** | **Personal Email Addresses** | `6: Email Addresses` | RFC 5322 Standard Grammar | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` | `0.99` |
| **17** | **Telephone & Landline Numbers** | `4: Telephone Numbers` | STD Code + Landline Regex | `(?i:Tel\|Landline)[:#\s]+(?:\+91[\s-]?)?(?:0\d{2,4}[-\s]?)?\d{6,8}\b` | `0.90` |
| **18** | **Bank Account Numbers** | `10: Account Numbers` | Keyword-Anchored Digits | `(?i:Account #\|Acct #\|Bank Account)[:#\s]+[0-9]{9,18}\b` | `0.95` |
| **19** | **Credit & Debit Card Numbers** | `10: Account Numbers` | Luhn Checksum + Card BIN Parser | RuPay, Visa, Mastercard series (16 digits with space or hyphen) | `0.98` |
| **20** | **Age & Gender linked to individual** | `3: Dates (Individual)` | Demographic Pairings Heuristic | `(?i:Age\|Aged)[:#\s]+\d{1,3}\b` or `\b(?:Male\|Female\|Non-binary),?\s*(?:aged?\s*\d{1,3}\|\d{1,3}\s*years?\s*old)\b` | `0.90` |
| **21** | **Date of Birth (DOB)** | `3: Dates (Individual)` | Date Format + Context Anchor | `(?i:DOB\|Birth\|Born\|Date of Birth)[:#\s]+(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\|\d{4}[/-]\d{1,2}[/-]\d{1,2})` | `0.94` |
| **22** | **Precise GPS & Geolocation** | `2: Geographical Data` | Coordinate Latitude/Longitude Parser | `(?i:GPS\|Coordinates\|Geolocation)[:#\s]+[-+]?(?:[1-8]?\d(?:\.\d+)?\|90(?:\.0+)?),\s*[-+]?(?:180(?:\.0+)?\|(?:1[0-7]\d\|\d{1,2})(?:\.\d+)?)\b` | `0.95` |
| **23** | **Device Hardware IDs (IMEI / MAC)** | `13: Device Identifiers` | MAC Address & IMEI Parser | MAC: `\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b`<br>IMEI: `(?i:IMEI)[:#\s]+[0-9]{15}\b` | `0.98` |
| **24** | **IP Addresses (IPv4 & IPv6)** | `15: IP Addresses` | Validated Octet Parser | IPv4 and IPv6 network endpoint addresses | `0.99` |
| **25** | **Vehicle Registration (RC)** | `12: Vehicle Identifiers` | State Code + District + Series | `\b[A-Z]{2}[-\s]?[0-9]{2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4}\b` (e.g., `MH 12 AB 1234`) | `0.92` |
| **26** | **Universal Unique Identifiers (UUID)** | `13: Device Identifiers` | RFC 4122 Standard Regex | `\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b` | `0.98` |
| **27** | **Personal Profile / Web URLs** | `14: Web URLs` | URL Protocol & FQDN Parser | Direct user profile links, LinkedIn URLs, personal domain endpoints | `0.98` |

---

## 3. Method Comparison: Why This Architecture Was Chosen

In earlier testing on the `pii-method-testing` branch, three distinct approaches were benchmarked:

| Method | Strengths | Weaknesses | Role in Production |
|---|---|---|---|
| **Deterministic High-Precision Regex (Tier 0 Fast-Path)** | **Sub-millisecond latency (<0.5ms)**<br>Zero hallucination risk<br>Strict compliance with national formats (PAN, Aadhaar, IFSC, SSN, Cards) | Cannot detect bare unstructured names without honorific titles | **Always-On default for high-throughput APIs and streaming gateways** |
| **GLiNER 152M Small-v2.1 (Tier 1 Neural SLM)** | **Zero-shot recall (+68% higher recall)**<br>Catches bare names, cities, salaries<br>0% false positives on clinical terms | Adds ~45–50ms inference time | **User-toggled via Advanced Filtering in Dashboard Overview** |
| **Microsoft Presidio + spaCy (Superseded / Deprecated)** | Generic Western entity recognition | Fails on Indian names (*Rahul Sharma*)<br>False positives on medical drugs (*Metoprolol*) | **Deprecated & superseded by GLiNER** |

---

## 4. Toggle Enforcement Behavior

When processing prompts via the UI sandbox (`/api/test-inspect`) or live proxy endpoints (`/proxy/{user_uuid}/v1`):

```
+----------------+----------------+-------------------------------------------------------------+
| HIPAA Toggle   | DPDP Toggle    | Inspection & Protection Behavior                            |
+----------------+----------------+-------------------------------------------------------------+
| [ ON ]         | [ ON ]         | Both frameworks active. All 18 HIPAA + 27 DPDP items checked.|
| [ ON ]         | [ OFF ]        | HIPAA only. US PHI (SSN, MRN) protected; Indian IDs ignored.|
| [ OFF ]        | [ ON ]         | DPDP only. Indian IDs (Aadhaar, PAN, UPI) protected; HIPAA ignored.|
| [ OFF ]        | [ OFF ]        | Pass-Through mode. Zero inspections; latency < 0.05ms.      |
+----------------+----------------+-------------------------------------------------------------+
```

---

## 5. Bidirectional Inspection: Inbound Prompt (Ingress) vs. LLM Output (Egress)

### Why LLM Output Inspection (Egress) Is Critical
In enterprise and healthcare deployments, the LLM often receives sensitive internal context through:
- **Retrieval-Augmented Generation (RAG)**: Internal vector stores containing confidential patient charts, employee compensation databases, or banking records.
- **System Prompts & Memory**: Context injected by the host application that must remain internal.
- **Model Fine-Tuning**: Memorized sensitive credentials, identifiers, or proprietary data.

Even if the user's prompt is benign (e.g. *"Summarize our mutual customer files"*), the model might inadvertently leak confidential identifiers back to the user. The **Egress Guardrail** inspects the model's generated text before it leaves the proxy perimeter.

```text
┌────────────────┐      ┌─────────────────────────┐      ┌─────────────────┐
│                │ ───► │  Ingress Guardrail      │ ───► │                 │
│  User Prompt   │      │  (HIPAA / DPDP Check)   │      │  LLM / Model    │
│                │ ◄─── │  Egress Guardrail       │ ◄─── │  (RAG / Memory) │
└────────────────┘      └─────────────────────────┘      └─────────────────┘
                         ▲
                         │
        [ Action Mode: BLOCK / REDACT / HASH / LOG_ONLY ]
```

### Egress Guardrail Enforcement Modes

| Mode | Egress Action Behavior | Client Experience |
|---|---|---|
| **BLOCK** | The entire model response is intercepted and dropped immediately. Elevated to decision `block`. | Receives HTTP 400 error: `egress_compliance_violation` (`output_pii_blocked`). Zero sensitive tokens reach the client. |
| **REDACT** | Sensitive entities detected in the model output are replaced with `[REDACTED_<ENTITY_TYPE>]` placeholders. | Receives sanitized text with all prohibited context redacted (e.g., `[REDACTED_PAN]`, `[REDACTED_AADHAAR]`). |
| **HASH** | Sensitive entities are converted to deterministic cryptographic hashes (`[HASH:<token>]`). | Allows consistent tracking of anonymous entities without revealing real credentials. |
| **LOG_ONLY** | Model output is delivered as-is; all identified violations are recorded in the audit trail. | Normal response; security administrators receive alerts on compliance violations. |

### Audit & Telemetry Schema for Egress
- **`events.original_response`**: Stores the raw LLM completion text before sanitization.
- **`events.anonymized_response`**: Stores the sanitized output delivered to the end-user (or block message).
- **`events.egress_pii_count`**: Number of compliance violations detected in the model's output.
- **`pii_findings.direction`**: Categorizes each detected entity as either `ingress` (user prompt) or `egress` (LLM output).
- **Dashboard & Activity Logs**: Renders separate badges (`↑ Egress (Model)` vs `↓ Ingress (Prompt)`) with dedicated side-by-side inspection cards for Raw Output vs Sanitized Delivered Response.

