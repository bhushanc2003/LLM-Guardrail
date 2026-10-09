# GuardIAn: Full Enterprise System Architecture Blueprint

**Platform:** GuardIAn — The Invisible Privacy & Governance Layer for Generative AI & Autonomous Agents  
**Compliance Standards:** HIPAA Safe Harbor (18 PHI Categories) & Indian Digital Personal Data Protection Act 2023 (27 DPDP Categories)  
**Agentic Paradigms:** Single-Agent Execution, Multi-Agent Orchestration, Dual-Sided Tool Call Interception  
**Date:** October 10, 2026  
**Interactive Preview:** Open [`DOCS/architecture_viewer.html`](file:///Users/bhushan/Projects/Hackathon/DOCS/architecture_viewer.html) or navigate to `http://localhost:8000/architecture` on the live server.

---

## 1. Master System & Ecosystem Architecture (Mermaid)

```mermaid
flowchart TD
    %% Styling Definitions
    classDef client fill:#090d1a,stroke:#00f2fe,stroke-width:2px,color:#f8fafc;
    classDef proxy fill:#0c1327,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef guardrail fill:#151030,stroke:#a855f7,stroke-width:2px,color:#f8fafc;
    classDef agent fill:#0a192f,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    classDef tool fill:#1f1625,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;
    classDef llm fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#f8fafc;
    classDef vault fill:#1c1917,stroke:#ec4899,stroke-width:2px,color:#f8fafc;

    subgraph CLIENT_LAYER["1. Client & Application Ingress"]
        C1["Client Web / Mobile App"]:::client
        C2["Agentic SDK / Cline / Cursor"]:::client
        C3["Enterprise Backend Services"]:::client
    end

    C1 -->|"Inbound Prompt / Tool Request"| GW["GuardIAn API Gateway & Auth Router\n(JWT / API Key / Dynamic Policy)"]:::proxy
    C2 -->|"Proxy Base URL (:8000/proxy/{uuid})"| GW
    C3 -->|"REST / Streaming Payload"| GW

    subgraph INGRESS_GUARDRAIL["2. Ingress Guardrail Pipeline (Prompt & Intent Inspection)"]
        GW --> CS["Compliance Context Selector\n(HIPAA Active / DPDP Active)"]:::guardrail
        CS --> T0{"Advanced Filtering\nMode Active?"}:::guardrail

        T0 -->|"OFF (Fast-Path <0.5ms)"| DET_FAST["Deterministic Engine\n• Luhn Checksum (Credit Cards)\n• Verhoeff Checksum (Aadhaar 12-digit)\n• ITD Syntax (PAN 10-char)\n• Strict Phone, Email, IPv4/v6, SSN, MRN"]:::guardrail
        T0 -->|"ON (Neural SLM ~45ms)"| DET_NEURAL["GLiNER Zero-Shot SLM (152M)\n• Unanchored Names (Rahul Sharma)\n• Unstructured Cities (Kolkata, Bangalore)\n• Compensation / CTC (INR 24 LPA)\n• Hospital Facilities"]:::guardrail

        DET_FAST --> SANITIZE["Deduplication & Stop-Word Gate\n• Generic Noun Filter (GENERIC_NOUN_STOP)\n• Clinical Drug Protection (0% False Positives)"]:::guardrail
        DET_NEURAL --> SANITIZE

        SANITIZE --> ACTION_ROUTER{"Action Mode\nEnforcement"}:::guardrail
        ACTION_ROUTER -->|"REDACT"| MASK_TOKEN["Reversible Vault Masking\n[REDACTED_TYPE] / [TOKEN_ID]"]:::vault
        ACTION_ROUTER -->|"BLOCK"| REJECT["HTTP 400 Compliance Rejection\n(Request Terminated at Edge)"]:::guardrail
        ACTION_ROUTER -->|"HASH"| HASH_TOKEN["HMAC-SHA256 Tokenization\n[HASH:8a7b9c1d]"]:::vault
        ACTION_ROUTER -->|"LOG_ONLY"| PASS_AUDIT["Zero-Touch Pass-Through\n(Telemetry Audited)"]:::guardrail
    end

    MASK_TOKEN --> ORCHESTRATION
    HASH_TOKEN --> ORCHESTRATION
    PASS_AUDIT --> ORCHESTRATION

    subgraph ORCHESTRATION["3. Agentic Runtime & Execution Environment"]
        direction TB

        subgraph SINGLE_AGENT["Single Agent Workflow"]
            SA["Autonomous Agent Instance\n(ReAct / Tool-Use Loop)"]:::agent
            SA_MEM["Agent Working Memory & Scratchpad\n(Sanitized Tokens Protected)"]:::agent
            SA <--> SA_MEM
        end

        subgraph MULTI_AGENT["Multi-Agent Swarm / Hierarchical Orchestration"]
            SUPERVISOR["Supervisor / Orchestrator Agent"]:::agent
            CROSS_GUARD{"Inter-Agent Guardrail\n(Cross-Agent PII Firewall)"}:::guardrail
            W1["Worker Agent: Medical/Clinical"]:::agent
            W2["Worker Agent: Finance/Billing"]:::agent
            W3["Worker Agent: External Search/Web"]:::agent

            SUPERVISOR -->|"Task Delegation"| CROSS_GUARD
            CROSS_GUARD -->|"Sanitized Task Context"| W1
            CROSS_GUARD -->|"Sanitized Financial Task"| W2
            CROSS_GUARD -->|"Sanitized Web Search"| W3
            W1 -->|"Sub-Task Result"| CROSS_GUARD
            W2 -->|"Sub-Task Result"| CROSS_GUARD
            W3 -->|"Sub-Task Result"| CROSS_GUARD
            CROSS_GUARD -->|"Safe Aggregated Context"| SUPERVISOR
        end
    end

    subgraph TOOL_CALL_GUARDRAIL["4. Dual-Sided Tool Call Guardrail"]
        SA -->|"Function Call Generated"| TOOL_INSPECT{"Pre-Invocation Tool Guardrail\n(Inspect Arguments)"}:::tool
        W1 -->|"Tool Call Request"| TOOL_INSPECT
        W2 -->|"Tool Call Request"| TOOL_INSPECT
        W3 -->|"Tool Call Request"| TOOL_INSPECT

        TOOL_INSPECT -->|"Argument Contains Leak"| TOOL_SANITIZE["Parameter Scrubbing\nReplace PII in SQL, API body, CLI args"]:::tool
        TOOL_INSPECT -->|"Clean Arguments"| TOOL_EXEC["Execute External Tool / Sandbox\n(DB Query, REST API, Bash Script)"]:::tool
        TOOL_SANITIZE --> TOOL_EXEC

        TOOL_EXEC -->|"Raw Return Value"| TOOL_EGRESS{"Post-Execution Output Guardrail\n(Database/API Result Scrubbing)"}:::tool
        TOOL_EGRESS -->|"Sanitized Return Payload"| SA
        TOOL_EGRESS -->|"Sanitized Return Payload"| SUPERVISOR
    end

    ORCHESTRATION -->|"Sanitized Context Payload"| UPSTREAM_LLMS["5. Target Upstream Foundation Models\n(OpenAI GPT-4o, Google Gemini 2.0, Anthropic Claude, Local Ollama)"]:::llm

    subgraph EGRESS_GUARDRAIL["6. Egress Guardrail & Deanonymization Vault"]
        UPSTREAM_LLMS -->|"Raw Model Completion"| EGRESS_INSPECT["Egress Leak & Hallucination Inspector\n• Scans for Raw PII Hallucinations\n• Detects Reverse-Prompt Injection"]:::guardrail

        EGRESS_INSPECT --> VAULT_LOOKUP{"Deanonymization\nAuthorized?"}:::vault
        VAULT_LOOKUP -->|"Yes (Authorized Client)"| RECONSTITUTE["Session Vault Deanonymization\n([TOKEN_NAME_1] ──► Real Patient/User Name)"]:::vault
        VAULT_LOOKUP -->|"No (Zero-Trust Delivery)"| SAFE_STREAM["Deliver Scrubbed Output As-Is"]:::vault

        RECONSTITUTE --> FINAL_RESP["Final Governed Response to Client"]:::client
        SAFE_STREAM --> FINAL_RESP
    end

    subgraph GOVERNANCE_ANALYTICS["7. Continuous Trust & Governance Analytics"]
        SANITIZE -.-> AUDIT_DB[("PostgreSQL / SQLite Audit Store\n• Tamper-Evident SHA256 Events\n• Violations & Breaches")]:::vault
        TOOL_INSPECT -.-> AUDIT_DB
        EGRESS_INSPECT -.-> AUDIT_DB
        AUDIT_DB --> TRUST_ENGINE["Dynamic Authority-Trust Scoring Engine\n• Score: 0–100 Scale | Tier 1–4 Tiers\n• Streak Bonuses (+1/clean request)\n• Penalty Demotions (-15/breach, -25/attack)\n• Effective-Use Clean Token Ratio"]:::guardrail
        TRUST_ENGINE --> DASHBOARD["Real-Time Security Dashboard\n(Overview, Activity, Trust & Tokens, Sandbox Test)"]:::client
    end
```

---

## 2. In-Depth Subsystem Architectures

### A. Compliance Framework Matrix & Dual-Tier Detection Pipeline

The detection layer enforces **HIPAA Safe Harbor (45 CFR § 164.514)** and the **Indian DPDP Act 2023** via a two-tier hybrid architecture:

```mermaid
graph LR
    subgraph INPUT["Input Stream"]
        RAW["Raw Unsanitized Text"]
    end

    subgraph TIER0["Tier 0: Deterministic Fast-Path (<0.5ms)"]
        direction TB
        R_HIPAA["HIPAA Identifiers:\n• SSN: \\d{3}-\\d{2}-\\d{4}\n• MRN: MRN-\\d{6,8}\n• Beneficiary ID: HICN/Member ID\n• Clinical Dates: mm/dd/yyyy\n• Provider Names with Titles (Dr. / Nurse)"]
        R_DPDP["DPDP Identifiers:\n• Aadhaar (12-digit + Verhoeff)\n• PAN (5L + 4D + 1L regex)\n• UPI ID (@okaxis, @okhdfcbank)\n• Indian Mobile (+91 / [6-9]\\d{9})\n• PIN Code (6 digits)\n• Passport & Voter ID"]
        R_SHARED["Shared Core Identifiers:\n• Credit Cards (Luhn Algorithm)\n• Bank Accounts / IBAN\n• IPv4 / IPv6 / MAC / UUID\n• Email Addresses (RFC 5322)"]
    end

    subgraph TIER1["Tier 1: Neural Zero-Shot SLM (~45ms)"]
        direction TB
        G_MODEL["GLiNER Small v2.1 (152M params)\nDeBERTa-v3 Bidirectional Backbone"]
        G_ENT["Dynamic Context Extraction:\n• 'person name' (unanchored human names)\n• 'city' & 'street address'\n• 'hospital' & healthcare facilities\n• 'salary' & unanchored CTC packages\n• 'student roll number'"]
        G_MODEL --> G_ENT
    end

    subgraph RESOLUTION["Aggregation & Precision Gate"]
        STOP["GENERIC_NOUN_STOP Gate\n(Suppresses 'Patient', 'attending physician',\n'candidate', 'bank counter', 'office')"]
        CLINICAL["Clinical Pharmacology Whitelist\n(Preserves 'Tamoxifen', 'Metoprolol',\n'Alzheimer', 'Parkinson')"]
        SPAN_MERGE["Span Deduplication Engine\n(Chronological Sorting & Non-overlapping Substring Resolution)"]
    end

    RAW --> R_HIPAA
    RAW --> R_DPDP
    RAW --> R_SHARED
    RAW --> G_MODEL

    R_HIPAA --> SPAN_MERGE
    R_DPDP --> SPAN_MERGE
    R_SHARED --> SPAN_MERGE
    G_ENT --> STOP
    STOP --> CLINICAL
    CLINICAL --> SPAN_MERGE

    SPAN_MERGE --> OUTPUT_MATCHES["Standardized PIIMatch List\n(Entity Type, Offsets, Confidence, Framework)"]
```

---

### B. Dual-Sided Tool Call & Function Execution Guardrail

Autonomous AI agents generate structured function calls (e.g. executing SQL queries, calling external REST APIs, or invoking CLI tools). GuardIAn intercepts tool interactions **both on ingress (before tool execution)** and **on egress (before results reach the agent)**.

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Autonomous Agent
    participant Guardrail as Tool Call Guardrail
    participant Vault as PIISessionVault
    participant Tool as External Tool / API / DB
    participant LLM as Target LLM

    Agent->>Guardrail: Emits Function Call: get_records(user_ssn="987-65-4320", patient="Sarah Connor")
    Note over Guardrail: Pre-Execution Parameter Inspection
    Guardrail->>Guardrail: Detects SSN (987-65-4320) & Name (Sarah Connor)
    Guardrail->>Vault: Stores mapping: [TOKEN_SSN_1] ↔ 987-65-4320, [TOKEN_NAME_1] ↔ Sarah Connor
    Guardrail->>Tool: Invokes Tool with Safe Pseudonyms: get_records(user_ssn="[TOKEN_SSN_1]", patient="[TOKEN_NAME_1]")
    Tool-->>Guardrail: Returns Raw Tool Result: {diagnosis: "Cardiology", balance: "$4,200", pan: "ABCDE1234F"}
    Note over Guardrail: Post-Execution Output Inspection
    Guardrail->>Guardrail: Scans Tool Return for PII Leaks (Detects PAN: ABCDE1234F)
    Guardrail->>Vault: Registers PAN Token: [TOKEN_PAN_1] ↔ ABCDE1234F
    Guardrail-->>Agent: Feeds Sanitized Tool Output: {diagnosis: "Cardiology", balance: "$4,200", pan: "[REDACTED_PAN]"}
    Agent->>LLM: Formulates Next-Step Reasoning using Sanitized Context
    LLM-->>Agent: Returns Final Answer: "Patient records reviewed under [TOKEN_NAME_1]."
```

---

### C. Single Agent vs. Multi-Agent Orchestration Guardrail

In multi-agent systems, agents delegate tasks and share scratchpads. Without a specialized inter-agent firewall, a breach in one specialized worker agent compromises the entire swarm.

```mermaid
graph TD
    subgraph MULTI_AGENT_SYSTEM["Multi-Agent Swarm with Inter-Agent Guardrails"]
        USER["User Prompt"] --> AGW["Ingress Guardrail"]
        AGW --> SUP["Supervisor / Planner Agent"]

        SUP --> S_MEM["Shared Swarm Memory"]

        SUP --> FW1{"Inter-Agent Guardrail\n(Worker 1 Firewall)"}
        SUP --> FW2{"Inter-Agent Guardrail\n(Worker 2 Firewall)"}
        SUP --> FW3{"Inter-Agent Guardrail\n(Worker 3 Firewall)"}

        subgraph WORKER_CLINICAL["Clinical Domain Agent"]
            FW1 --> CLINICAL_AGENT["Clinical Specialist Agent"]
            CLINICAL_AGENT --> TOOL_CLINICAL["EHR Database Tool"]
            TOOL_CLINICAL --> CLINICAL_AGENT
            CLINICAL_AGENT --> FW1
        end

        subgraph WORKER_FINANCIAL["Financial Domain Agent"]
            FW2 --> FINANCE_AGENT["Billing / Payroll Agent"]
            FINANCE_AGENT --> TOOL_FINANCE["Accounting API"]
            TOOL_FINANCE --> FINANCE_AGENT
            FINANCE_AGENT --> FW2
        end

        subgraph WORKER_WEB["Open Web Agent"]
            FW3 --> WEB_AGENT["External Search Agent"]
            WEB_AGENT --> TOOL_WEB["Public Search API"]
            TOOL_WEB --> WEB_AGENT
            WEB_AGENT --> FW3
        end

        FW1 -->|"Aggregated Sanitized Findings"| SUP
        FW2 -->|"Aggregated Sanitized Findings"| SUP
        FW3 -->|"Aggregated Sanitized Findings"| SUP

        SUP --> EGRESS["Egress Guardrail & Deanonymizer"]
        EGRESS --> CLIENT["Governed Client Response"]
    end
```

---

## 3. Governance & Authority-Trust Scoring Formula

GuardIAn calculates dynamic security trust scores for all client connections and autonomous agent instances in real time:

$$\text{Authority-Trust Score} = \text{Clamp}_{0}^{100}\Big(\text{Base (80)} + \text{Streak Bonus} - \text{Violation Penalties}\Big)$$

Where:
* **Streak Bonus:** $+1$ point awarded for every consecutive clean prompt ($\text{max} +20$).
* **Minor Violation Penalty (Redacted PII):** $-5$ points per occurrence.
* **Major Compliance Breach (Blocked Request):** $-15$ points per occurrence.
* **Malicious Injection / Attack Attempt:** $-25$ points with immediate tier downgrade.

### Trust Tiers & Access Privileges

| Tier Level | Score Range | Status | Agent Permissions & Capabilities |
| :---: | :---: | :---: | :--- |
| **Tier 1: Master Operator** | $90 - 100$ | 🛡️ Highly Trusted | Full multi-agent orchestration, unrestricted tool access, low-latency fast-path streaming. |
| **Tier 2: Trusted Operator** | $70 - 89$ | 🔒 Standard Secure | Standard agentic execution, mandatory tool argument inspection enabled. |
| **Tier 3: Monitored User** | $40 - 69$ | ⚠️ Elevated Risk | Neural SLM dual-pass mandatory; tool invocation requires strict parameter whitelisting. |
| **Tier 4: Restricted / Quarantined** | $0 - 39$ | 🚨 Zero-Trust Lockdown | Automatic BLOCK mode enforced; external tool calls revoked; audit events flagged to SIEM. |

---

## 4. Verification & Interactive Preview

To interactively view, zoom, and export these architectural diagrams:
1. Open the standalone viewer: [`DOCS/architecture_viewer.html`](file:///Users/bhushan/Projects/Hackathon/DOCS/architecture_viewer.html) in your browser.
2. Or navigate directly to `http://localhost:8000/architecture` on the running API server.
