# 🏥 PetCare AI — Veterinary Clinical Ambient Scribe

[![Status](https://img.shields.io/badge/Status-Production--Ready-059669?style=for-the-badge&logo=shield)](https://github.com)
[![Engine](https://img.shields.io/badge/STT-Whisper--large--v3-d97706?style=for-the-badge&logo=openai)](https://groq.com)
[![Clinical LLM](https://img.shields.io/badge/LLM-Groq%20gpt--oss--120b%20%7C%20Qwen%20Failover-7c3aed?style=for-the-badge&logo=groq)](https://groq.com)
[![Audit](https://img.shields.io/badge/Audit-RFC%208785%20SHA--256%20Chained-0284c7?style=for-the-badge&logo=security)](https://github.com)
[![Architecture](https://img.shields.io/badge/Workflow-Decoupled%20Ingestion%20%26%20Synthesis-10b981?style=for-the-badge&logo=architecture)](https://github.com)

**PetCare AI** is an ambient clinical intelligence and automated veterinary documentation system. Built for busy veterinary clinics and animal hospitals, it captures spoken doctor-client consultations in real time, isolates vocal audio with acoustic Voice Activity Detection (VAD), transcribes dialogue using **OpenAI Whisper-large-v3**, normalizes veterinary pharmacology, extracts structured medical findings with **Groq LLM (`openai/gpt-oss-120b`)**, and drafts **3 core clinical documents** (**Summary**, **Prescription**, and **Lab Tests**) — all governed by an explicit human-in-the-loop review workflow and a tamper-evident cryptographic audit ledger.

---

## 📑 Table of Contents

1. [Executive Summary & Problem Solved](#-executive-summary--problem-solved)
2. [What's New in the Latest Release](#-whats-new-in-the-latest-release)
3. [System Architecture](#-system-architecture)
4. [End-to-End Workflow Explained](#-end-to-end-workflow-explained)
5. [The Realigned 3-Document Model](#-the-realigned-3-document-model)
6. [Key Features & Capabilities](#-key-features--capabilities)
7. [Tech Stack](#-tech-stack)
8. [Project Directory Layout](#-project-directory-layout)
9. [Prerequisites & Environment Setup](#-prerequisites--environment-setup)
10. [Quick Start Guide](#-quick-start-guide)
11. [Testing & Quality Verification](#-testing--quality-verification)
12. [Database Schema Reference](#-database-schema-reference)
13. [REST API & Real-Time WebSocket Reference](#-rest-api--real-time-websocket-reference)
14. [Clinical Safety & Compliance Guarantees](#-clinical-safety--compliance-guarantees)
15. [Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)

---

## 💡 Executive Summary & Problem Solved

### The Veterinary Problem
Veterinarians spend **2 to 3 hours every day** manually typing consultation records, SOAP notes, and prescription orders after clinical hours. This administrative burden causes:
- **Clinician Burnout**: High cognitive fatigue and extended uncompensated evening work.
- **Documentation Gaps**: Rushed notes often omit subtle symptoms, dosage timings, or owner compliance advice.
- **Impaired Client Focus**: Looking at a computer screen during a consultation detracts from examining the animal and connecting with the anxious pet owner.

### The PetCare AI Solution
PetCare AI acts as an invisible, silent co-pilot in the exam room:
1. **Listens Passively**: Captures conversation via browser microphone or uploaded audio recordings.
2. **Understands Veterinary Nuance**: Distinguishes between doctor instructions and owner reports, correctly recognizing specialized veterinary drug names (e.g., *Clavamox, Apoquel, Cerenia*).
3. **Drafts Instant Records**: Automatically constructs formatted Medical Summaries, ready-to-dispense Prescriptions, and Diagnostic Lab requisitions.
4. **Guarantees Clinician Oversight**: AI drafts remain pending until the attending veterinarian explicitly reviews, edits, and clicks **Approve & Sign All** or **Reject AI Draft**.
5. **Maintains Medical-Legal Compliance**: Every revision, approval, and rejection is permanently recorded in a SHA-256 cryptographically chained audit ledger.

---

## 🌟 What's New in the Latest Release

The latest release brings major production hardening across acoustic ingestion, clinical synthesis, and session isolation:

| Feature | Category | What It Does & Why It Matters |
|:---|:---:|:---|
| **Decoupled Audio & Synthesis** | *Workflow & AI* | Uploading audio now transcribes dialogue immediately without prematurely generating clinical notes. Full medical document synthesis occurs only when the clinician explicitly clicks **Generate AI Drafts**, saving LLM token costs and eliminating unreviewed hallucinated drafts. |
| **Clinical Insights Modal with Governance** | *Clinician UX* | An executive glassmorphism popup offering a unified clinical overview with **Approve & Sign All** (batch signs and locks all drafts into immutable legal records) and **Reject AI Draft** (rejects draft with mandatory audit reason), plus 1-click clipboard export. |
| **Resilient Multi-Model LLM Failover** | *Reliability* | Extraction defaults to Groq's flagship **`openai/gpt-oss-120b`**. If Groq experiences rate limits (`429`) or service degradation (`503`), the engine automatically falls back to **`qwen/qwen3.8-27b`** without clinician interruption. |
| **Consultation Session Isolation** | *Architecture* | Zero transcript ghosting across patient switching. Employs per-consultation WebSocket isolation, browser `AbortController` cancellation, and synchronous state resets to ensure dialogue from pet A never bleeds into pet B. |
| **Acoustic Voice Activity Detection (VAD)** | *Audio Pipeline* | Analyzes 20ms audio frames with a `-42 dB` RMS energy gate and 300ms hangover padding. Automatically trims dead air and drops silent chunks before Whisper processing, drastically reducing latency and hallucinations. |
| **Dual-Pass Verification & Boundary Stitcher** | *Transcription* | Runs a secondary verification pass on complete consultation audio, using a fuzzy-matching boundary stitcher to eliminate duplicated or clipped phrases across consecutive 15-second chunk cuts. |
| **Veterinary Drug Alias Normalization** | *Clinical Safety* | Curated pharmacology dictionary (`drug_aliases.json`) with Levenshtein fuzzy matching that standardizes phonetically misheard animal drugs (e.g., mapping "clavamox 250" or "amox-clav" to normalized active compound and dosage). |
| **RFC 8785 Cryptographic Audit Ledger** | *Compliance* | Append-only SHA-256 chained block ledger tracking all consultation actions, approvals, and document diffs using RFC 8785 canonical JSON, guaranteeing tamper-evident legal audit trails. |
| **Dedicated SaaS Directory Portal** | *Navigation* | Added a full-page directory manager (`/directory`) alongside the workspace modal to seamlessly manage veterinary staff and pet registry with active consultation deletion guards. |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier (React 18 + Vite)"]
        A[Microphone Audio Stream / File Upload] --> B[15s Audio Chunk / Binary Dispatcher]
        B --> C[Audio Controls & Animated Soundwave]
        D[2-Tier Patient Header & Doctor Switcher]
        E[Clinical Document Workspace: Summary | Rx | Lab]
        F[Clinical Insights Modal: Approve & Sign All / Reject]
    end

    subgraph Ingestion["Acoustic Ingestion & Hardening"]
        G[Binary Magic Bytes Validation] --> H[VAD Silence Trimmer RMS Gate]
        H --> I[SHA-256 Chunk Hash Deduplication]
    end

    subgraph Transcription["Speech-to-Text & Diarization"]
        J[Groq Whisper-large-v3 Engine] --> K[Boundary Phrase Stitcher]
        K --> L[Veterinary Drug Alias Normalizer]
        L --> M[Semantic Speaker Diarizer: Doctor vs Owner]
    end

    subgraph Intelligence["Clinical AI Synthesis Engine"]
        N[Prompt Builder with Patient Context] --> O{Primary Groq LLM: gpt-oss-120b}
        O -->|Rate Limit / 429| P[Secondary Groq LLM: qwen3.8-27b]
        O -->|Success| Q[Structured Clinical JSON Output]
        P -->|Success| Q
        Q --> R[Zod Clinical Safety Guardrails]
        R --> S[Formulary Contraindication Interceptor]
        S --> T[3-Document Synthesizer: Summary, Rx, Lab]
    end

    subgraph Persistence["Storage & Cryptographic Audit Layer"]
        U[(PostgreSQL 14+: 12 Relational Tables)]
        V[(Binary Audio Chunks BYTEA)]
        W[(RFC 8785 Chained SHA-256 Audit Ledger)]
        X[(Immutable Version History)]
    end

    A --> G
    I --> J
    M -->|Real-Time WebSocket Stream| Client
    Client -->|Explicit Clinician 'Generate' Action| N
    T --> U
    T --> X
    F -->|Approve & Sign| W
    W --> U
```

---

## 🔄 End-to-End Workflow Explained

For any third person evaluating or onboarding onto the project, here is the complete journey of a patient visit:

```
[1. Check-In & Consent] ──> [2. Audio Capture] ──> [3. Acoustic VAD & Whisper] ──> [4. Real-Time Stream]
                                                                                            │
[7. Cryptographic Lock] <── [6. Clinician Review] <── [5. Decoupled AI Synthesis] <─────────┘
```

1. **Patient Check-In & Digital Consent**:
   - The attending veterinarian selects the patient from the header dropdown.
   - Pet owner digital recording consent is verified and timestamped before recording can be activated.
2. **Audio Capture (Live Mic or Audio Upload)**:
   - **Live Mode**: Records in 15-second rolling buffers with real-time waveform animation.
   - **Upload Mode**: Ingests pre-recorded consultations (`.wav`, `.mp3`, `.webm`, `.ogg`, `.m4a`).
3. **Acoustic Gating & Whisper Transcription**:
   - Audio is inspected for valid magic bytes (preventing corrupt payloads).
   - Voice Activity Detection (VAD) drops empty silence regions.
   - Audio is transcribed by **Whisper-large-v3** via Groq API (< 1.2s per chunk).
   - Drug names are normalized against the veterinary formulary dictionary.
4. **Real-Time Diarized Streaming**:
   - Spoken segments stream immediately to the UI via WebSockets.
   - The system classifies speaker roles (**Doctor** vs. **Owner**) with manual 1-click overrides.
5. **Decoupled AI Synthesis (On-Demand)**:
   - Audio transcription alone does *not* prematurely generate medical notes.
   - When the doctor finishes the consultation and clicks **Generate AI Drafts**, the consultation dialogue is processed by Groq `openai/gpt-oss-120b` (with auto-failover to `qwen/qwen3.8-27b`).
   - Zod schemas validate the clinical extraction and intercept safety contraindications (e.g., toxic feline medications).
6. **Clinician-in-the-Loop Review**:
   - The clinician reviews the generated findings in the **Clinical Insights Modal** or directly within the 3 document tabs.
   - Individual fields can be edited directly in the workspace.
7. **Approval & Cryptographic Ledger Signing**:
   - Clicking **Approve & Sign All** freezes the documents as immutable legal records.
   - An RFC 8785 canonical SHA-256 block is chained into `consultation_audit_ledger`.
   - Alternatively, clicking **Reject AI Draft** discards the recommendation with an audit-logged clinical reason.

---

## 📋 The Realigned 3-Document Model

To avoid documentation overload, PetCare AI organizes clinical documentation into **3 core medical documents**:

| Tab | Document | Contents & Clinical Structure | Primary Purpose |
|:---:|:---|:---|:---|
| **1** | **Summary** *(Default)* | • Narrative Clinical Overview<br>• Chief Complaints & Reported Symptoms with Duration<br>• Physical Examination Findings (Vitals, Palpation, Auscultation)<br>• Assessment & Diagnoses (Categorized: *Confirmed* vs. *Suspected*)<br>• Client Home Care, Dietary & Follow-Up Guidance<br>• Missing Information & Safety Checklist | Serves as the complete legal clinical encounter record and the client discharge instructions. |
| **2** | **Prescription** | • Prescribed Medication List with Item Numbers<br>• Formulation, Strength, Dosage, and Administration Route<br>• Frequency, Duration, and Doctor Administration Notes<br>• Verbatim Transcript Quote Evidence verifying doctor instruction | Standalone, pharmacy-ready medication order with full clinical audit provenance. |
| **3** | **Lab Tests** | • Recommended Diagnostic Investigations (CBC, Chem 17, Urinalysis)<br>• Test Classification (*Discussed with Owner* vs. *Formally Ordered*)<br>• Clinical Justification & Next-Step Decision Criteria | Diagnostic order requisition ready for the hospital reference laboratory. |

---

## ⚡ Key Features & Capabilities

### 🎙️ 1. Ambient Live Recording & File Ingestion
- Real-time animated CSS soundwave visualizer provides immediate sensory feedback of live audio capture.
- High-precision tabular figures timer (`00:27 [RECORDING]`) with animated status pulse.
- Upload support for existing consultation recordings (`WAV`, `MP3`, `WebM`, `OGG`, `M4A`) up to 25 MB.
- Zero-disk in-memory processing option for high-throughput, secure multi-tenant deployments.

### 👥 2. Dual-Speaker Diarization & Role Controls
- **Automated Semantic Diarizer**: Analyzes clinical linguistics to classify speaker turns (e.g., symptoms described as Pet Owner; exam findings and medication plans as Doctor).
- **Segmented Control Toolbar**: 1-click override to toggle between **Auto AI**, **Attending Doctor**, and **Pet Owner** roles.

### 🛡️ 3. Clinical Insights Modal & Governance Dashboard
- Glassmorphism overlay (`backdrop-filter: blur(12px)`) presenting the entire case at a glance.
- Visual cards: Clinical Narrative, Chief Complaints, Symptoms with Duration/Severity, Diagnoses, Prescriptions, and Diagnostics.
- **Approve & Sign All**: Batch approves and locks all 3 documents into immutable legal records.
- **Reject AI Draft**: Discards AI suggestions with mandatory clinical explanation.
- **1-Click Copy**: Copies the full clinical text formatted for EHR/PIMS paste in one click.

### 🔒 4. Consultation Isolation & State Resilience
- WebSocket room isolation guarantees zero cross-talk between open sessions.
- Browser `AbortController` cleanly terminates active HTTP requests when switching patients.
- Synchronous state flushing prevents UI ghosting of prior consultation data.

### 💊 5. Veterinary Pharmacology Intelligence
- Built-in formulary dictionary (`drug_aliases.json`) maps mispronounced or phonetically corrupted brand names to generic equivalents.
- Safety Intercept Engine flags life-threatening contraindications (such as Acetaminophen/Paracetamol in cats) before documents are drafted.

### 🏥 6. Full SaaS Directory Management
- Full CRUD interface for hospital veterinarians and patient records.
- Protects active consultations by preventing deletion of attending veterinarians tied to ongoing records.
- URL-synchronized navigation (`?page=directory` vs `?page=consultation`).

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18.3 (Strict Mode, Hooks, Functional Architecture)
- **Tooling**: Vite 6.1 (ESM, Sub-second HMR)
- **Icons**: Lucide React
- **Styling**: Custom Vanilla CSS Design System with Slate neutral palette, glassmorphism, and responsive grid
- **Testing**: Playwright 1.65 (Cross-browser E2E testing with fake audio device stream injection)

### Backend
- **Runtime**: Node.js 18+ (CommonJS)
- **Framework**: Express.js 4.21
- **Real-Time Transport**: Native WebSocket Server (`ws` 8.18)
- **Safety Validation**: Zod 3.24 (Type-safe schema validation)
- **Audio Storage**: Multer 2.5 with in-memory buffer handling and automatic temp file management
- **Testing**: Native Node.js Test Runner (`node --test`)

### Database & Security
- **Database Engine**: PostgreSQL 14+
- **Driver**: `pg` 8.13 (Connection pooling and transactional rollbacks)
- **Audit Standard**: RFC 8785 JSON Canonicalization with SHA-256 chained hashing

### AI & Speech Infrastructure
- **Speech-to-Text (STT)**: OpenAI Whisper-large-v3 via Groq API (< 1.2s latency per 15s chunk)
- **Primary Clinical LLM**: Groq `openai/gpt-oss-120b`
- **Secondary Failover LLM**: Groq `qwen/qwen3.8-27b`

---

## 📂 Project Directory Layout

```text
Voice to transcript/
├── backend/
│   ├── src/
│   │   ├── config/              # Centralized environment config & drug aliases
│   │   │   ├── index.js         # Configuration loader & defaults
│   │   │   └── drug_aliases.json# Curated veterinary formulary dictionary
│   │   ├── db/                  # PostgreSQL pool, schema, and migrations
│   │   │   ├── connection.js    # pg Pool singleton
│   │   │   ├── migrate.js       # Migration runner
│   │   │   └── schema.sql       # 12 relational tables & constraints
│   │   ├── modules/
│   │   │   ├── audio/           # Audio controller, chunk storage, and validation
│   │   │   ├── audit/           # Cryptographic SHA-256 audit ledger service
│   │   │   ├── clinical-ai/     # LLM extractor, multi-model failover, and Zod schemas
│   │   │   ├── consultations/   # Consultation lifecycle management
│   │   │   ├── directory/       # Veterinarian and patient directory endpoints
│   │   │   ├── documents/       # Document patching, approvals, and legal locking
│   │   │   ├── realtime/        # WebSocket server and consultation room routing
│   │   │   ├── templates/       # Document builders (Summary, Prescription, Lab Tests)
│   │   │   └── transcription/   # VAD service, boundary stitcher, and Whisper client
│   │   └── server.js            # Express bootstrap and combined HTTP/WS listener
│   ├── tests/
│   │   ├── integration/         # Consultation lifecycle and directory REST API tests
│   │   └── unit/                # VAD, dual-pass, audio hash, and safety schema tests
│   └── package.json
│
├── frontend/
│   ├── e2e/                     # Playwright E2E test specs (live audio, directory, UI)
│   ├── src/
│   │   ├── features/
│   │   │   ├── consultation/    # Main clinical consultation workspace
│   │   │   │   ├── components/  # Document editor, live recording, and insights modal
│   │   │   │   └── hooks/       # useMicrophone, useConsultationWebSocket
│   │   │   └── directory/       # SaaS Directory management page
│   │   ├── styles/              # Design system CSS tokens and responsive layout
│   │   ├── App.jsx              # Top-level router and navigation shell
│   │   └── main.jsx             # React DOM root
│   ├── playwright.config.js     # Single-worker Playwright config with virtual microphone
│   └── vite.config.js
│
├── scripts/                     # Database seed restore and audio test generators
├── tests/                       # ASR audit suites and verification manifests
└── package.json                 # Root npm orchestration commands
```

---

## ⚙️ Prerequisites & Environment Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher (running on `localhost:5432`)
- **Groq API Key**: Required for high-throughput Whisper-large-v3 and LLM extraction ([Get Groq Key](https://console.groq.com/keys))

### 2. Environment Configuration (`.env`)
Create a `.env` file in the project root directory:

```ini
# Application Port
PORT=5000
NODE_ENV=development

# PostgreSQL Database
DB_USER=postgres
DB_PASSWORD=root
DB_HOST=localhost
DB_PORT=5432
DB_NAME=petcare

# Groq High-Speed AI Engine
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_WHISPER_MODEL=whisper-large-v3
GROQ_LLM_MODEL=openai/gpt-oss-120b

# OpenAI Fallback (Optional)
OPENAI_API_KEY=sk_your_openai_api_key_here
OPENAI_MODEL=gpt-4o

# Audio Retention Policy (GDPR/Compliance)
AUDIO_RETENTION_DAYS=30
```

---

## 🚀 Quick Start Guide

Follow these simple steps to run the entire application locally:

### Step 1: Install Dependencies
From the project root:
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Step 2: Initialize Database & Run Migrations
Make sure your local PostgreSQL service is running, then run:
```bash
npm run backend:migrate
```
*This automatically creates the `petcare` database, creates all 12 relational tables, applies audit ledger migrations, and seeds initial veterinarians and patients.*

### Step 3: Start the Backend Server
```bash
npm run backend:dev
```
- REST API Base: `http://localhost:5000/api/v1`
- WebSocket Server: `ws://localhost:5000/ws/v1/consultations/:id`

### Step 4: Start the Frontend Application
In a separate terminal window:
```bash
npm run frontend:dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing & Quality Verification

PetCare AI includes extensive automated verification covering the backend audio pipeline, clinical schemas, and frontend user flows.

### 1. Backend Automated Test Suite
Executes unit and integration test suites:
```bash
npm run backend:test
```
Covers:
- Consultation REST API lifecycle and status transitions
- Acoustic Voice Activity Detection (VAD) energy gating and silence trimming
- Binary magic bytes inspection (WAV, MP3, WebM, OGG, M4A)
- Dual-pass transcription and boundary phrase stitching
- SHA-256 chunk hashing and upload idempotency
- Veterinary drug alias normalization
- RFC 8785 cryptographic audit ledger chain integrity
- Zod clinical safety schemas and contraindication interception

### 2. Frontend Playwright E2E Suite
Runs end-to-end browser automation in Google Chrome, injecting real veterinary consultation audio into a virtual microphone:
```bash
cd frontend && npx playwright test
```
Or run the headed live audio test:
```bash
npm run test:live
```

---

## 🗄️ Database Schema Reference

All tables use sequential integer primary keys (`id SERIAL PRIMARY KEY: 1, 2, 3...`) for clean routing, predictable foreign key constraints, and standard indexing.

| Table Name | Primary Key | Foreign Keys | Key Columns | Clinical Purpose |
|:---|:---|:---|:---|:---|
| `users` | `id SERIAL` | None | `name`, `email`, `role` | Attending veterinarians and hospital staff. |
| `pets` | `id SERIAL` | None | `name`, `species`, `breed`, `age_years`, `weight_kg`, `owner_name` | Patient registry and owner demographics. |
| `appointments` | `id SERIAL` | `pet_id`, `doctor_id` | `scheduled_at`, `status`, `reason` | Scheduled clinical visits. |
| `consultations` | `id SERIAL` | `pet_id`, `doctor_id`, `appointment_id` | `status`, `language`, `consent_given`, `started_at`, `ended_at` | Active consultation session state. |
| `transcript_segments` | `id SERIAL` | `consultation_id` | `sequence_number`, `speaker_role`, `text`, `confidence`, `is_final_pass` | Sequential speech transcripts with unique `(consultation_id, sequence_number)`. |
| `consultation_audio` | `id SERIAL` | `consultation_id (UNIQUE)` | `audio_data (BYTEA)`, `audio_hash`, `mime_type`, `file_name` | Complete raw audio binary for dual-pass verification. |
| `consultation_audio_chunks` | `id SERIAL` | `consultation_id` | `chunk_index`, `audio_hash`, `audio_data (BYTEA)`, `mime_type` | Uploaded audio chunks with unique idempotency constraint. |
| `clinical_extractions` | `id SERIAL` | `consultation_id (UNIQUE)` | `pet_info`, `symptoms`, `medications`, `diagnoses`, `raw_llm_response` | Validated clinical JSON extraction object. |
| `consultation_documents` | `id SERIAL` | `consultation_id` | `doc_type`, `status`, `current_version`, `content (JSONB)` | Generated clinical documents (`summary`, `prescription`, `lab_tests`). |
| `document_versions` | `id SERIAL` | `document_id`, `changed_by` | `version_number`, `content (JSONB)`, `doctor_notes` | Complete version history of doctor edits. |
| `document_approvals` | `id SERIAL` | `document_id`, `doctor_id` | `action ('approved' / 'rejected')`, `reason`, `approved_at` | Legal sign-off ledger; locks document as immutable. |
| `consultation_audit_ledger` | `id SERIAL` | `consultation_id` | `sequence_number`, `event_type`, `previous_hash`, `current_hash`, `payload_snapshot` | RFC 8785 SHA-256 cryptographically chained audit ledger. |
| `recording_consents` | `id SERIAL` | `consultation_id (UNIQUE)` | `consent_type`, `given_by`, `consent_text` | Explicit recording consent signed by pet owner. |
| `audio_retention_policies` | `id SERIAL` | `consultation_id (UNIQUE)` | `retain_until`, `auto_delete_audio` | Automated GDPR/privacy audio deletion policy. |

---

## 🌐 REST API & Real-Time WebSocket Reference

All mutating requests require the `x-doctor-id: <id>` header for audit trail attribution.

### Consultation Lifecycle Endpoints
| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/api/v1/consultations` | Creates a new consultation session for a patient. |
| `GET` | `/api/v1/consultations` | Lists all consultations with doctor and patient metadata. |
| `GET` | `/api/v1/consultations/:id` | Returns full consultation details and current status. |
| `POST` | `/api/v1/consultations/:id/consent` | Records owner digital recording consent. |
| `POST` | `/api/v1/consultations/:id/start` | Starts recording (guards against missing consent). |
| `POST` | `/api/v1/consultations/:id/pause` | Pauses audio capture. |
| `POST` | `/api/v1/consultations/:id/resume` | Resumes active recording session. |
| `POST` | `/api/v1/consultations/:id/stop` | Stops recording; marks session ready for clinician review. |
| `POST` | `/api/v1/consultations/:id/reset` | Resets consultation to clean scheduled state. |
| `POST` | `/api/v1/consultations/:id/complete` | Formally finalizes and locks the consultation. |
| `DELETE` | `/api/v1/directory/consultations/:id` | Deletes consultation session and associated documents. |

### Audio & AI Scribe Endpoints
| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/api/v1/consultations/:id/audio-chunk` | Multipart upload of 15s audio chunk; transcribes via Whisper API. |
| `POST` | `/api/v1/consultations/:id/upload-and-scribe` | Single-turn audio upload. Transcribes dialogue into segments with `autoGenerate=false`. |
| `POST` | `/api/v1/consultations/:id/generate` | Triggers LLM clinical extraction and generates all 3 medical documents. |
| `GET` | `/api/v1/consultations/:id/transcript` | Eager HTTP hydration of all stored transcript segments. |
| `GET` | `/api/v1/consultations/:id/documents` | Returns all clinical documents for the consultation. |

### Document Governance & Legal Audit Endpoints
| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/v1/documents/:id` | Retrieves a single document draft. |
| `PATCH` | `/api/v1/documents/:id` | Saves doctor draft edits; blocks with `403` if document is approved. |
| `POST` | `/api/v1/documents/:id/approve` | Veterinarian formally approves document (locks as immutable). |
| `POST` | `/api/v1/documents/:id/reject` | Rejects document with mandatory clinical justification reason. |
| `GET` | `/api/v1/documents/:id/versions` | Retrieves complete revision history with doctor diff notes. |
| `GET` | `/api/v1/consultations/:id/audit` | Retrieves immutable audit trail with before/after snapshots. |

### Real-Time WebSocket Protocol
- **Endpoint**: `ws://localhost:5000/ws/v1/consultations/:id`
- **Client Messages**: `auth`, `audio_chunk`, `pause`, `resume`, `stop`, `reconnect`
- **Server Broadcasts**:
  - `connected`: Handshake confirmation.
  - `transcript_partial`: Streaming live speech chunk before Whisper finalization.
  - `transcript_final`: Finalized Whisper transcript with sequence number and confidence score.
  - `status_change`: Synchronizes consultation state across browser tabs.
  - `extraction_progress`: Broadcasts AI extraction milestones during synthesis.
  - `documents_ready`: Notifies client that all 3 clinical documents are drafted.

---

## 🛡️ Clinical Safety & Compliance Guarantees

1. **Human-in-the-Loop Imperative**:
   - AI is never permitted to finalize medical records autonomously.
   - All generated drafts must be explicitly inspected and approved by a licensed attending veterinarian.
2. **Formulary Safety Intercept Engine**:
   - The clinical extraction pipeline validates against veterinary contraindication rules.
   - Example: If Paracetamol/Acetaminophen is mentioned in a feline consultation, the safety validator flags a fatal contraindication alert and prevents unreviewed approval.
3. **Immutability After Approval**:
   - Once a document receives formal doctor approval (`status = 'approved'`), the backend rejects subsequent `PATCH` requests with `403 Forbidden`.
   - Any further amendments require creating a new document version with documented clinical justification.
4. **Tamper-Evident Audit Ledger**:
   - Powered by RFC 8785 canonical JSON formatting and SHA-256 block chaining.
   - Each audit log entry points to the previous entry's cryptographic hash, making retroactive modification detectable.
5. **GDPR / Audio Retention Policy**:
   - The database maintains an `audio_retention_policies` table.
   - Raw audio chunks can be scheduled for automatic purging after 30 days while retaining the legal text record.

---

## ❓ Frequently Asked Questions (FAQ)

### Q: Why is audio upload decoupled from document generation?
**A:** In a clinical setting, veterinarians often record or upload an audio consultation and review the raw transcript first before incurring LLM processing costs or committing to generated notes. Decoupling upload from generation allows doctors to verify transcript completeness, ensure sound quality, and initiate AI synthesis only when ready.

### Q: What happens if Groq hits rate limits during a busy clinic hour?
**A:** The clinical extractor includes multi-model failover. If the primary model (`openai/gpt-oss-120b`) returns an HTTP 429 (Rate Limit) or 503 (Unavailable), the system automatically attempts synthesis with the secondary model (`qwen/qwen3.8-27b`). If both fail, a deterministic fallback parser structures the transcript into safe clinical draft templates so the doctor is never blocked.

### Q: How does the system prevent dialogue from one pet leaking into another?
**A:** Each consultation operates on an isolated WebSocket room scoped to its consultation ID. When switching consultations in the UI, an `AbortController` cancels pending HTTP requests, the previous WebSocket connection is torn down, and the client state is synchronously reset before fetching the new patient's transcript.

### Q: How does PetCare AI handle background clinic noise (barking, instruments)?
**A:** The acoustic Voice Activity Detection (VAD) service runs energy RMS calculations on 20ms frames with a `-42 dB` threshold and 300ms hangover padding. Non-vocal frames (such as empty air or background hum) are trimmed before reaching Whisper, reducing API latency and hallucinated phrases.

---

## 📄 License & Proprietary Notice

Proprietary & Confidential. Built for Central Valley Animal Hospital and clinical veterinary partners.
