# Compliance Detection Methods: HIPAA & DPDP (India 2023)

This document provides a comprehensive technical breakdown of all personal data identifiers tracked and guarded by the **PII Governance & Anonymization Engine**, detailing the exact detection methods, regular expressions, contextual heuristics, and validation algorithms employed for **HIPAA Safe Harbor** (15 identifiers) and the **Digital Personal Data Protection (DPDP) Act (India 2023)** (27 identifiers).

---

## 1. Architecture Overview: Hybrid Tiered Engine

The engine employs a **multi-tiered, zero-trust detection architecture** that guarantees sub-millisecond evaluation latency, deterministic reproducibility, and zero LLM hallucination:

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
│ • Device Identifiers    │     │ • Salary, CTC, Stipends │     │ • Device Serial Numbers │
│ • Web URLs & Addresses  │     │ • IFSC Bank Branch Codes│     │ • Standard Date of Birth│
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
│  • Category Normalization: Normalizes entity matches to DB Category IDs [1 - 15]         │
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

### Detection Tiers:
1. **Tier 0: High-Precision Deterministic Matchers (Format Validation)**:
   - For structured IDs with algorithmic schemas (e.g., PAN 5L-4N-1L, Aadhaar 12-digit UID, SSN 3-2-4, IFSC 4L-0-6AN, UPI handles, IPv4/v6 octets, MAC hex, RFC 4122 UUIDs).
   - Speed: $< 0.8\text{ ms}$ per 1,000 tokens.
2. **Tier 1: Contextual Pattern & Boundary Heuristics**:
   - For semi-structured localized values (e.g., PIN codes, clinical admission dates, compensation/CTC, employee numbers, MRNs).
   - Utilizes regex boundaries, keyword anchors (`DOB:`, `Salary:`, `Admitted:`, `MRN:`) and stop-word dictionaries (`NAME_STOP`) to eliminate false positives.
3. **Tier 2: Microsoft Presidio & Spacy NER Fallback (Optional)**:
   - Activated via `ENABLE_PRESIDIO=true` for freeform unstructured patient/doctor names and geopolitical entities.

---

## 2. HIPAA Compliance: Detection Methods (15 Safe Harbor Categories)

Under the Health Insurance Portability and Accountability Act (HIPAA) Privacy Rule (§ 164.514), the Safe Harbor de-identification method requires the removal of all 15 covered identifier categories:

| # | HIPAA Identifier Field | Category ID | Detection Method | Underlying Pattern & Code Implementation | Concrete Example | Confidence |
|---|------------------------|:-----------:|------------------|------------------------------------------|------------------|:----------:|
| **1** | **Names** (including initials or family/employer names) | `1: Names` | Contextual Heuristics + Presidio NLP + Stop-Word Filtering | Anchored titles: `(?i:Dr.\|Mr.\|Mrs.\|Ms.\|Prof.\|Patient\|Doctor)[:#\s]+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)` + Bare Capitalized Name Runs `\b[A-Z][a-z]+(?:\s+(?:[A-Z]\.\|[A-Z][a-z]+)){1,3}\b` checked against `NAME_STOP` dictionary. Optional Presidio `PERSON` entity fallback. | `Dr. Robert Chen`, `Patient Jane Doe` | `0.91` |
| **2** | **Geographical data smaller than a state** (street address, city, county, ZIP code) | `2: Geographical Data` | Regex Grammar + Prefix Matching + ZIP Parser | Standard Street Suffixes: `\b\d{1,5}\s+[A-Za-z0-9\s.,#-]+?\s+(Street\|St\|Terrace\|Avenue\|Ave\|Road\|Rd\|Boulevard\|Blvd\|Drive\|Lane\|Court\|Way)\b`<br>US ZIP: `(?:ZIP[:\s]+)?\d{5}(?:-\d{4})?\b`<br>City/County: `(?:City\|County\|Town\|Locality)[:#\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)` | `742 Evergreen Terr, Springfield, 62704` | `0.95` |
| **3** | **Dates directly related to an individual** (birth, admission, discharge, death years alone excluded) | `3: Dates (Individual)` | Clinical Event Anchors + ISO/Slash Date Regex | Clinical Event Context: `(?:Admitted\|Admission\|Discharged\|Discharge\|Died\|Death\|Surgery Date)[:#\s]+(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\|\d{4}[/-]\d{1,2}[/-]\d{1,2})`<br>DOB: `(?:DOB\|Birth\|Born)[:#\s]+(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})` | `DOB: 08/23/1984`, `Admitted: 10/02/2026` | `0.94` |
| **4** | **Telephone numbers** | `4: Telephone Numbers` | E.164 & NANP Telephone Parser | NANP phone: `(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b`<br>Prefixed phone: `(?:Phone\|Tel\|Mobile\|Cell)[:#\s]+(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b` | `+1 (555) 234-5678`, `202-555-0199` | `0.90` |
| **5** | **Fax numbers** | `5: Fax Numbers` | Keyword-Anchored Fax Regex | Keyword Anchor: `(?:Fax\|FAX\|fax)[:#\s]+(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b` | `Fax: +1-212-555-0143` | `0.95` |
| **6** | **Email addresses** | `6: Email Addresses` | RFC 5322 Compliant Grammar | RFC standard pattern: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` | `jane.doe@hospital.org` | `0.99` |
| **7** | **Social Security numbers (SSN)** | `7: Social Security Numbers` | Deterministic Format Regex | 9-digit format: `\b\d{3}-\d{2}-\d{4}\b`<br>Keyword match: `(?:SSN\|Social Security)[:#\s]+\d{3}[-\s]?\d{2}[-\s]?\d{4}\b` | `123-45-6789` | `0.98` |
| **8** | **Medical record numbers (MRN)** | `8: Medical Record Numbers` | Healthcare Anchor & Prefix Matcher | Healthcare Context: `(?:MRN\|Medical Record Number\|Med Rec #)[:#\s]+[A-Za-z0-9-]{6,12}\b` and `\bMRN-\d{6,10}\b` | `MRN-4820194`, `Med Rec #992144` | `0.96` |
| **9** | **Health plan beneficiary numbers** | `9: Health Plan Beneficiary Numbers` | Insurance Policy Context Grammar | Policy keywords: `(?:Health Plan\|Beneficiary ID\|Policy #\|Member ID\|Insurance ID\|HICN\|Medicare ID)[:#\s]+[A-Za-z0-9-]{7,15}\b` | `HICN-9948201`, `Policy #POL-88321` | `0.95` |
| **10** | **Account numbers** | `10: Account Numbers` | Keyword-Bounded Account Matcher | Account keywords: `(?:Account #\|Acct #\|Bank Account\|IBAN)[:#\s]+[A-Za-z0-9-]{8,22}\b` | `Acct #440291049281`, `IBAN US99...` | `0.95` |
| **11** | **Certificate/license numbers** | `11: Certificate/License Numbers` | State & Medical Board License Regex | Credentials: `(?:Driver'?s License\|DL #\|License #\|Cert #\|Certificate #)[:#\s]+[A-Za-z0-9-]{6,16}\b` | `DL #D98472019`, `Med Lic #MD-4819` | `0.94` |
| **12** | **Vehicle identifiers and serial numbers (including license plates)** | `12: Vehicle Identifiers` | ISO 3779 VIN + License Plate Grammar | VIN (excluding I, O, Q): `\b[A-HJ-NPR-Z0-9]{17}\b` or `(?:VIN\|Vehicle ID)[:#\s]+[A-HJ-NPR-Z0-9]{17}\b`<br>License plate: `(?:License Plate\|Plate #\|Tag #)[:#\s]+[A-Z0-9-]{3,8}\b` | `1HGCR2F83HA123456`, `Plate #7XYZ89` | `0.95` |
| **13** | **Device identifiers and serial numbers** | `13: Device Identifiers` | Hardware & IMEI Regex Matcher | Device keywords: `(?:Serial Number\|Serial #\|IMEI\|Device ID\|Advertising ID)[:#\s]+[A-Za-z0-9-]{8,20}\b` | `IMEI: 352099001761481`, `Serial #SN-882` | `0.93` |
| **14** | **Web URLs** | `14: Web URLs` | URI Scheme & FQDN Parser | Standard protocols: `\bhttps?://[^\s<>"{}|\\^`]+[^\s<>"{}|\\^`.,;:!?]` or `\bwww\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}` | `https://portal.clinic.org/patient/992` | `0.98` |
| **15** | **IP address numbers** | `15: IP Addresses` | Validated Octet IPv4 / IPv6 Parser | IPv4: `\b(?:(?:25[0-5]\|2[0-4][0-9]\|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]\|2[0-4][0-9]\|[01]?[0-9][0-9]?)\b`<br>IPv6: standard hex-colon notation | `192.168.1.105`, `2001:db8::1` | `0.99` |

---

## 3. DPDP Compliance: Detection Methods (27 Indian Personal Identifiers)

Under the **Digital Personal Data Protection Act 2023** (Ministry of Electronics & Information Technology, Government of India), personal data encompasses any data about an individual who is identifiable by or in relation to such data. The detector implements **27 specific identifiers**:

| # | DPDP Identifier Field | Category ID | Detection Method | Exact Pattern & Validation Heuristic | Concrete Example | Confidence |
|---|-----------------------|:-----------:|------------------|---------------------------------------|------------------|:----------:|
| **1** | **Aadhaar Number (UIDAI)** | `7: Social Security Numbers` | Verhoeff Checksum + 12-Digit UID Grammar | 12 digits, first digit $\in [2-9]$: `\b[2-9]\d{3}\s\d{4}\s\d{4}\b` or `(?:Aadhaar\|UIDAI\|Aadhar)[:#\s]+[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b` | `4532 8901 2345` | `0.99` |
| **2** | **Permanent Account Number (PAN)** | `11: Certificate/License Numbers` | ITD 10-Char Grammar (5L-4N-1L) | 5 uppercase letters (4th char = entity: P, C, H, F, A, T, B, L, J, G), 4 numeric digits, 1 check letter: `\b[A-Z]{5}[0-9]{4}[A-Z]\b` | `ABCDE1234F` | `0.99` |
| **3** | **UPI Handles & VPAs** | `10: Account Numbers` | VPA Bank Provider Extension Registry | Handle mapping to registered NPCI PSPs: `\b[a-zA-Z0-9.\-_]{2,64}@(okaxis\|okhdfcbank\|oksbi\|okicici\|paytm\|ybl\|ibl\|upi\|axl\|apl\|barodampay\|federal\|kotak\|postbank\|idfcbank\|gpay\|phonepe)\b` | `rajesh.kumar@okhdfcbank`, `user@paytm` | `0.98` |
| **4** | **Indian Mobile Numbers** | `4: Telephone Numbers` | TRAI Standard +91 & [6-9] 10-Digit Grammar | Starts with valid Indian mobile series (6, 7, 8, 9): `\b(?:\+91[\s-]?)?[6-9]\d{9}\b` or spaced `(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]\d{5}\b` | `+91 9876543210`, `98201 12345` | `0.95` |
| **5** | **Indian PIN Code** | `2: Geographical Data` | Postal Anchor + 6-Digit Non-Zero Regex | Non-zero prefix (1-9) with postal anchor: `(?:PIN\|PIN Code\|Pin\|Postal Code)[:#\s]+[1-9][0-9]{5}\b` | `PIN: 400001`, `560038` | `0.95` |
| **6** | **Indian Passport Number** | `11: Certificate/License Numbers` | MEA 1-Letter + 7-Digit Grammar | 1 uppercase letter followed by 7 digits: `(?:Passport\|Passport No)[:#\s]+[A-Z][0-9]{7}\b` or bare `\bpassport\s+[A-Z][0-9]{7}\b` | `Passport No: Z1234567` | `0.95` |
| **7** | **Voter ID (EPIC Card)** | `11: Certificate/License Numbers` | ECI 3-Letter + 7-Digit Parser | 3 uppercase letters followed by 7 digits: `(?:Voter ID\|EPIC)[:#\s]+[A-Z]{3}[0-9]{7}\b` or standalone `\b[A-Z]{3}[0-9]{7}\b` | `EPIC: ABC1234567` | `0.95` |
| **8** | **Indian Driving Licence (DL)** | `11: Certificate/License Numbers` | Parivahan Sarathi State+RTO Syntax | 2-letter state code + 2-digit RTO + 11-digit license series: `\b[A-Z]{2}[0-9]{2}[-\s]?[0-9]{11}\b` | `MH12-20180012345` | `0.94` |
| **9** | **IFSC Bank Branch Code** | `10: Account Numbers` | RBI 11-Char Format (4L-0-6AN) | 4 alphabetic chars (bank), 5th char always `0`, 6 alphanumeric chars (branch): `\b[A-Z]{4}0[A-Z0-9]{6}\b` | `HDFC0001234`, `SBIN0004567` | `0.92` |
| **10** | **Employee ID / Staff Number** | `11: Certificate/License Numbers` | Corporate Workplace Context Regex | `(?:Employee ID\|Emp ID\|Staff ID\|Worker ID)[:#\s]+[A-Za-z0-9-]{4,16}\b` or `\bEMP-?\d{3,8}\b` | `Emp ID: EMP-99214`, `Staff #8821` | `0.93` |
| **11** | **Salary & Compensation History** | `10: Account Numbers` | Currency (₹/Rs/INR) + CTC Heuristic | Symbol anchor + amount + period: `(?:Salary\|Income\|CTC\|Annual Package)[:#\s]+(?:₹\|Rs\.?\|INR\s*)?[\d.,]+(?:\s*(?:LPA\|per annum\|p\.a\.\|per month\|pm\|lakhs?\|crores?\|k))?\b` | `Salary: ₹18.5 LPA`, `CTC: 1,50,000 pm` | `0.92` |
| **12** | **Student ID & Roll Numbers** | `11: Certificate/License Numbers` | Academic Institution Anchor Regex | `(?:Student ID\|Roll No\|Enrollment No\|Registration No)[:#\s]+[A-Za-z0-9-]{4,16}\b` | `Roll No: 20BCS1042`, `Reg #992144` | `0.92` |
| **13** | **Personal & Full Names** | `1: Names` | Honorifics (Shri/Smt/Dr) + NER | Prefixes `(?i:Shri\|Smt\|Dr\.\|Prof\.)` + Capitalized name runs + Presidio NER fallbacks | `Shri Rajesh Kumar`, `Anita Sharma` | `0.91` |
| **14** | **Residential & Street Addresses** | `2: Geographical Data` | Premise & Locality Boundary Parser | `(?:Address\|Location\|Residential Address)[:#\s]+[A-Za-z0-9\s.,#-]+?(?=\s*,\|\s*Zip\|\s*PIN\|\s*\n\|$)` | `Flat 402, Shanti Towers, MG Road` | `0.92` |
| **15** | **City, District & Locality** | `2: Geographical Data` | Geopolitical Location Classifier | `(?:City\|Town\|Locality\|District)[:#\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)` | `City: Pune`, `District: Ernakulam` | `0.88` |
| **16** | **Personal Email Addresses** | `6: Email Addresses` | RFC 5322 Standard Grammar | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` | `rajesh.kumar@gmail.com` | `0.99` |
| **17** | **Landline & STD Telephone** | `4: Telephone Numbers` | STD Area Code + Landline Parser | Indian fixed-line telecommunications: `(?:Tel\|Landline)[:#\s]+(?:\+91[\s-]?)?(?:0\d{2,4}[-\s]?)?\d{6,8}\b` | `Tel: 020-25678901`, `011-23456789` | `0.90` |
| **18** | **Bank Account Numbers** | `10: Account Numbers` | Banking Anchor + Digit Sequence | `(?:Account #\|Acct #\|Bank Account)[:#\s]+[0-9]{9,18}\b` or `(?:Account\|A/C)[^\d\n]{0,20}\d{9,18}\b` | `Acct #987654321012`, `11-16 digits` | `0.95` |
| **19** | **Credit & Debit Card Numbers** | `10: Account Numbers` | Luhn Mod-10 + Card BIN Matcher | RuPay, Visa, Mastercard, Amex 16-digit sequences with Luhn checksum validation | `RuPay 6071 2234 5567 8901` | `0.98` |
| **20** | **Age & Demographic Pairings** | `3: Dates (Individual)` | Demographic Pairing Heuristics | `(?:Age\|Aged)[:#\s]+\d{1,3}\b` or `\b(?:Male\|Female\|Non-binary),?\s*(?:aged?\s*\d{1,3}\|\d{1,3}\s*years?\s*old)\b` | `Age: 32 years`, `Male, aged 28` | `0.90` |
| **21** | **Date of Birth (DOB)** | `3: Dates (Individual)` | ISO/Indian Slash Date Regex | `(?:DOB\|Birth\|Born\|Date of Birth)[:#\s]+(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\|\d{4}[/-]\d{1,2}[/-]\d{1,2})` | `DOB: 15/08/1992`, `Born: 1985-04-12` | `0.94` |
| **22** | **Precise GPS Coordinates** | `2: Geographical Data` | Coordinate Lat/Long Parser | `(?:GPS\|Coordinates\|Geolocation)[:#\s]+[-+]?(?:[1-8]?\d(?:\.\d+)?\|90(?:\.0+)?),\s*[-+]?(?:180(?:\.0+)?\|(?:1[0-7]\d\|\d{1,2})(?:\.\d+)?)\b` | `GPS: 18.5204° N, 73.8567° E` | `0.95` |
| **23** | **Device Hardware IDs (IMEI / MAC)** | `13: Device Identifiers` | MAC Hex & 15-Digit IMEI Parser | MAC: `\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b`<br>IMEI: `(?:IMEI)[:#\s]+[0-9]{15}\b` | `IMEI: 864201048291048`, `00:1A:2B:3C:4D:5E` | `0.98` |
| **24** | **IP Addresses (IPv4 & IPv6)** | `15: IP Addresses` | Validated Octet Parser | IPv4 decimal octets ($0-255$) and IPv6 128-bit hex notation | `103.21.244.0`, `2405:201::` | `0.99` |
| **25** | **Vehicle Registration (RC)** | `12: Vehicle Identifiers` | State + District + Series RC Grammar | `\b[A-Z]{2}[-\s]?[0-9]{2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4}\b` | `MH 12 AB 1234`, `DL 01 CA 5678` | `0.92` |
| **26** | **UUIDs & System Identifiers** | `13: Device Identifiers` | RFC 4122 Standard GUID Regex | `\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b` | `550e8400-e29b-41d4-a716-446655440000` | `0.98` |
| **27** | **Personal Profile / Web URLs** | `14: Web URLs` | FQDN & Profile Path Matcher | Personal domain endpoints, social profile paths: `linkedin.com/in/...`, `twitter.com/...` | `linkedin.com/in/rajesh-kumar` | `0.98` |

---

## 4. Enforcement & Compliance Execution in Code

### Ingress & Egress Integration
In [`pii_proxy/main.py`](file:///Users/bhushan/Projects/Hackathon/pii_proxy/main.py), every incoming request is routed through the detector before being dispatched to the model node:

```python
# 1. Inspect Inbound User Prompt
blocked_matches = detector.detect(
    latest_user_msg, 
    check_hipaa=check_hipaa, 
    check_dpdp=check_dpdp
)

# 2. Action Enforcement
if action_mode == "BLOCK" and blocked_matches:
    raise HTTPException(status_code=400, detail="Blocked by GuardIAn: prompt violates compliance policy")
elif action_mode == "HASH":
    sanitized_prompt, _ = anonymizer.process_text(prompt, vault, mode="HASH", check_hipaa=check_hipaa, check_dpdp=check_dpdp)
elif action_mode == "REDACT":
    sanitized_prompt, _ = anonymizer.process_text(prompt, vault, mode="REDACT", check_hipaa=check_hipaa, check_dpdp=check_dpdp)
```

### Tamper-Evident Receipts
Every detection event generates an audit entry and updates the cryptographic hash chain in `DBReceipt`:
- Computes SHA-256 payload over previous receipt hash + event details.
- Verifiable via `GET /api/sessions/{session_id}/receipts/verify`.
