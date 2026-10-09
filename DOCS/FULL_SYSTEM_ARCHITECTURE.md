# GuardIAn End-to-End System Architecture

**System:** Full-Spectrum Generative AI Privacy, Compliance & Security Guardrail  
**Standards:** HIPAA Safe Harbor (18 PHI Categories) & Indian DPDP Act 2023 (27 Identifiers)  
**Execution Profiles:** Sub-Millisecond Deterministic Fast-Path (`<0.2 ms`) & Neural SLM (`~40 ms`)  
**Scope:** Ingress Gateway · Dual Compliance Core · Tool Call Enclave · Single & Multi-Agent Mesh · Egress Sanitization  
**Date:** October 10, 2026  

---

## Architecture Diagram (Mermaid Preview)

```mermaid
flowchart TD
    %% ==========================================
    %% TIER 1: CLIENT & INGESTION TIER
    %% ==========================================
    subgraph ClientTier["1. Ingestion & Client Tier"]
        direction TB
        WebApp["Enterprise Web Applications\n(React Dashboard / HTTPS)"]
        IDE["Agentic IDEs & Extensions\n(Cursor / Cline / Open WebUI)"]
        SDK["Enterprise Pipelines & SDKs\n(LangChain / LlamaIndex / REST)"]
    end

    %% ==========================================
    %% TIER 2: REVERSE PROXY & GATEWAY
    %% ==========================================
    subgraph GatewayTier["2. API Gateway & Ingress Reverse Proxy (:8000)"]
        direction TB
        ProxyIngress["FastAPI ASGI Gateway\n/proxy/{uuid}/v1/chat/completions"]
        AuthMiddleware["Clerk JWT Authentication & Rate Limiter"]
        SessionRouter["Dynamic Mode Router\n(REDACT | BLOCK | HASH | LOG_ONLY)"]
    end

    %% ==========================================
    %% TIER 3: DUAL-TIER COMPLIANCE & INSPECTION ENGINE
    %% ==========================================
    subgraph ComplianceTier["3. Dual-Tier Compliance & PII Inspection Core"]
        direction TB
        
        subgraph FastPath["Tier 0: Deterministic Fast-Path (<0.2 ms)"]
            Aadhaar["Aadhaar Verhoeff Checksum\n(12-Digit UID, [2-9] Root)"]
            PAN["PAN Card ITD Syntax\n([A-Z]{5}[0-9]{4}[A-Z])"]
            UPI["UPI VPA Syntax Engine\n(@okaxis, @okhdfcbank, @paytm)"]
            HIPAA_Keys["HIPAA Safe Harbor Regex\n(SSN, MRN, Health Plan IDs, Dates)"]
            Luhn["Luhn Card Checksum & IBAN"]
        end

        subgraph NeuralSLM["Tier 1: Zero-Shot Neural SLM (~40 ms)"]
            GLiNER["GLiNER 152M Bi-encoder Engine\n(Threshold: 0.52 Precision Gate)"]
            NamesLocs["Unanchored Names & Cities\n(Rahul Sharma, Indiranagar, Bengaluru)"]
            StopFilter["GENERIC_NOUN_STOP Gate\n(Suppresses 'patient', 'doctor', 'office')"]
            RxPreserve["Rx Drug Preservation Gate\n(Tamoxifen, Metoprolol = 0% False Alarms)"]
        end

        Dedupe["Span Conflict Resolver & Token Deduplicator"]
    end

    %% ==========================================
    %% TIER 4: STATE & CRYPTOGRAPHIC VAULT
    %% ==========================================
    subgraph StorageTier["4. Cryptographic Vault & State Enclave"]
        direction TB
        Vault[("PIISessionVault\nIn-Memory HMAC-SHA256 Mapping\n[HASH:7a8b9c] ↔ Raw Entity")]
        AuditDB[("Immutable Audit Ledger\nSQLite WAL / Forensic JSON Store\nSOC2 Type II & HIPAA Evidence")]
    end

    %% ==========================================
    %% TIER 5: AGENT RUNTIME & REASONING ENCLAVE
    %% ==========================================
    subgraph AgentTier["5. Autonomous Agent Runtime (Single & Multi-Agent)"]
        direction TB

        subgraph SingleAgent["Single-Agent ReAct Execution Loop"]
            AgentCore["Agent Reasoning Core\n(Ingests Safe Context with [HASH:id])"]
            ReAct["Thought ➔ Action ➔ Observation Loop\n(Protected from Prompt Injection)"]
            LLMGateway["Model Dispatch\n(OpenAI / Claude / Gemini Base APIs)"]
        end

        subgraph MultiAgent["Multi-Agent Orchestration Mesh"]
            Supervisor["Supervisor / Orchestrator Agent\n(Task Decomposition & Delegation)"]
            A2ABus{"Inter-Agent Guardrail Bus\n(A2A Gateway with RBAC Policy)"}
            WorkerClinical["Worker Alpha: Clinical Specialist\n[HIPAA Permitted]"]
            WorkerBilling["Worker Beta: Billing / Financial\n[DPDP Permitted]"]
            WorkerPublic["Worker Gamma: Public Summarizer\n[Zero PII Permitted]"]
        end
    end

    %% ==========================================
    %% TIER 6: TOOL CALL & FUNCTION GUARDRAILS
    %% ==========================================
    subgraph ToolTier["6. Tool Execution Guardrail Enclave"]
        direction TB
        PreToolGuard["1. Pre-Execution Argument Guardrail\n• Inspects function args (query, payload)\n• Blocks external SSN/Card exfiltration"]
        
        subgraph ToolExecution["Sandboxed Tool Targets"]
            DB[("SQL Database\nPostgres / MySQL")]
            CRM["Internal CRM / EHR\nSalesforce / Epic"]
            WebSearch["External Web / APIs\nSearch & Retrieval"]
        end
        
        PostToolGuard["2. Post-Execution Return Scrubbing\n• Scans returned rows against HIPAA & DPDP\n• Strips DB raw PII before LLM context injection"]
    end

    %% ==========================================
    %% TIER 7: EGRESS SANITIZATION & CLIENT DELIVERY
    %% ==========================================
    subgraph EgressTier["7. Egress Guardrail & Streaming Gateway"]
        direction TB
        DualPassScan["Dual-Pass Output Inspection\n(Catches Model Hallucinations of PII)"]
        ReverseVault["Reverse De-anonymization Engine\n(Restores [HASH:id] for Authorized Session)"]
        SSEBuffer["Sliding-Window Streaming Buffer\n(Prevents PII Split across SSE Chunks)"]
        FinalDelivery["Sanitized HTTP 200 / Streamed Chunk Delivery"]
    end

    %% ==========================================
    %% TIER 8: CONTROL PLANE & TELEMETRY
    %% ==========================================
    subgraph ControlPlane["8. Control Plane, Scoring & Telemetry"]
        direction TB
        TrustScore["Authority-Trust Scoring Engine\nATS = 80 + StreakBonus - ViolationPenalty"]
        EUS["Effective-Use Score (EUS)\nClean Ratio: 100%"]
        SSEPush["Real-Time SSE Telemetry Stream\n/api/sessions/{id}/events"]
        AdminDashboard["Real-Time Security Dashboard\n(Overview · Violations · Trust Analytics)"]
    end

    %% ==========================================
    %% CONNECTORS & DATA FLOW
    %% ==========================================
    WebApp -->|HTTPS Request| ProxyIngress
    IDE -->|API Payloads| ProxyIngress
    SDK -->|Streaming Requests| ProxyIngress

    ProxyIngress --> AuthMiddleware
    AuthMiddleware --> SessionRouter

    SessionRouter -->|Dispatch Text| FastPath
    SessionRouter -->|Dispatch Text| NeuralSLM

    FastPath --> Dedupe
    NeuralSLM --> Dedupe

    Dedupe -->|Token Mapping| Vault
    Dedupe -->|Log Breach Events| AuditDB

    Dedupe -->|Safe Masked Prompt| AgentCore
    Dedupe -->|Safe Masked Prompt| Supervisor

    %% Single-Agent Loop
    AgentCore --> ReAct
    ReAct --> LLMGateway
    LLMGateway --> DualPassScan

    %% Tool Call Guardrail Loop
    ReAct -->|Function Call Intent| PreToolGuard
    PreToolGuard -->|Sanitized Arguments| ToolExecution
    ToolExecution -->|Raw Execution Results| PostToolGuard
    PostToolGuard -->|Safe Observations| ReAct

    %% Multi-Agent Loop
    Supervisor --> A2ABus
    A2ABus <-->|RBAC Filtered Messages| WorkerClinical
    A2ABus <-->|RBAC Filtered Messages| WorkerBilling
    A2ABus <-->|Zero-PII Filtered Messages| WorkerPublic
    WorkerClinical -->|Sub-task Result| A2ABus
    WorkerBilling -->|Sub-task Result| A2ABus
    WorkerPublic -->|Sub-task Result| A2ABus
    A2ABus -->|Aggregated Safe Context| Supervisor
    Supervisor --> DualPassScan

    %% Egress Pipeline
    DualPassScan --> ReverseVault
    ReverseVault --> SSEBuffer
    SSEBuffer --> FinalDelivery
    FinalDelivery -->|Safe Response (Zero Leaks)| ClientTier

    %% Telemetry & Control Plane Links
    Dedupe -.->|Breach Telemetry| TrustScore
    FinalDelivery -.->|Request Counts| EUS
    TrustScore --> SSEPush
    EUS --> SSEPush
    AuditDB --> SSEPush
    SSEPush --> AdminDashboard
```

---

## Architectural Breakdown & Tier Specifications

### 1. Ingestion & Client Tier
* **Supported Clients:** Standard OpenAI SDK, LangChain, LlamaIndex, Cline, Cursor IDE, and web frontends.
* **Protocol:** Standard HTTPS / WSS streaming via standard OpenAI `/v1/chat/completions` REST interface.

### 2. API Gateway & Ingress Reverse Proxy
* **Port:** `:8000` (ASGI running FastAPI + Uvicorn).
* **Per-User Route Isolation:** `/proxy/{user_uuid}/v1/chat/completions`.
* **Dynamic Action Modes:**
  * `BLOCK`: Immediate HTTP 400 rejection on compliance violation.
  * `REDACT`: Static replacement with `[REDACTED_TYPE]` token.
  * `HASH`: Reversible deterministic cryptographic tokenization (`[HASH:7a8b9c]`).
  * `LOG_ONLY`: Zero-modification pass-through with audit trail recording.

### 3. Dual-Tier Compliance & PII Inspection Core
* **Tier 0 Deterministic Fast-Path (<0.2 ms):**
  * Verhoeff Checksum Algorithm for 12-digit Indian Aadhaar UIDs.
  * Income Tax Department (ITD) pattern validation for Indian PAN cards.
  * Luhn algorithm for Payment Cards (Visa, MasterCard, Amex) and bank account numbers.
  * RegEx patterns for UPI handles, Indian mobile numbers, PIN codes, SSN, MRN, Health Plan IDs.
* **Tier 1 Zero-Shot Neural SLM (~40 ms):**
  * GLiNER 152M bi-encoder zero-shot entity recognizer.
  * Captures unstructured bare names (*Sarah Connor, Rahul Sharma*), unanchored locations (*Indiranagar, Kolkata*), and compensation packages (*INR 24 LPA*).
  * **Precision Gate (0.52 Threshold) + `GENERIC_NOUN_STOP`:** Drops common occupational and role titles (*patient, physician, doctor, candidate, office*) to eliminate false positives.
  * **Clinical Medication Safeguard:** Automatically preserves pharmaceutical drugs (*Tamoxifen, Metoprolol, Lisinopril, Zoloft*) with 0% false alarms.

### 4. Cryptographic Vault & State Enclave
* **PIISessionVault:** Scoped in-memory token store mapping cryptographic hashes (`[HASH:7a8b9c]`) to original plain text values. Pure memory footprint with zero disk persistence for leak prevention.
* **Immutable Audit Ledger:** Append-only SQLite WAL / JSON event store recording audit metadata for SOC2 Type II, HIPAA, and DPDP compliance certifications.

### 5. Autonomous Agent Runtime (Single & Multi-Agent)
* **Single-Agent ReAct Isolation:**
  * The agent plans, thinks, and loops over safe tokenized context without exposing plain text identities to the underlying LLM.
  * Protects system prompts and internal reasoning traces from prompt injection and exfiltration.
* **Multi-Agent Orchestration Mesh (A2A Gateway):**
  * **Supervisor Agent:** Orchestrates high-level goals and breaks tasks into specialized sub-tasks.
  * **Inter-Agent Guardrail Bus:** Intercepts agent-to-agent communications and applies Role-Based Access Control (RBAC).
  * **Specialized Worker Agents:** Clinical agents cannot leak patient records to public summarizers or external report generators.

### 6. Tool Execution Guardrail Enclave
* **Pre-Execution Argument Inspection:**
  * Intercepts function call payloads (*e.g. SQL queries, external API params*).
  * Scrubs and tokenizes sensitive arguments before dispatching calls to third-party tools or external endpoints.
* **Post-Execution Return Scrubbing:**
  * Inspects rows and JSON payloads returned from enterprise databases or EHR systems.
  * Removes raw PII from tool outputs before injecting observations into the agent's context window.

### 7. Egress Sanitization & Client Delivery
* **Dual-Pass Output Inspection:** Scans generated text from LLMs before returning it to the user, eliminating model hallucinations of real PII.
* **Reverse De-anonymization:** Safely swaps tokenized hashes back to original values for authorized users on the client side.
* **Sliding-Window Streaming Buffer:** Buffers 64 tokens across Server-Sent Events (SSE) chunks to prevent PII entities from splitting across chunk boundaries.

### 8. Control Plane, Scoring & Telemetry
* **Authority-Trust Score (ATS):** Dynamic trust rating (0–100) based on clean execution streaks and compliance violations.
* **Effective-Use Score (EUS):** Measures prompt hygiene (`Clean Requests / Total Requests × 100`).
* **Real-time SSE Event Push:** Telemetry streamed live to the security dashboard (`/api/sessions/{id}/events`).
