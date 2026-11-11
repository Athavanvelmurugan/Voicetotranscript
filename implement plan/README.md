# PetCare AI — Platform Implementation Master Plan

> From a single-clinic AI scribe to a multi-tenant veterinary SaaS with Doctor, Pet Owner, Clinic Admin, Front Desk, and Super Admin portals.

---

## 🗺️ Implementation Phases Overview

| Phase | Title | Duration (2-3 devs) | Primary Outcome | Document Link |
|:---:|:---|:---:|:---|:---|
| **1** | **Identity, RBAC & Multi-Tenancy** | 3–4 wks | Secure login, clinics, roles, no spoofing | [Phase 1 Specification](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/Phase%201%20-%20Identity,%20RBAC%20&%20Multi-Tenancy.md) |
| **2** | **Clinic Admin, Registry & Scheduling** | 3 wks | Clinic self-service: staff, pets, owners, appointments | [Phase 2 Specification](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/Phase%202%20-%20Clinic%20Admin,%20Registry%20&%20Scheduling.md) |
| **3** | **Owner Portal v1, Documents & Notifications** | 4 wks | Digital consent, verified signed PDFs, WhatsApp/SMS alerts | [Phase 3 Specification](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/Phase%203%20-%20Owner%20Portal%20v1,%20Documents%20&%20Notifications.md) |
| **4** | **Retention Engine** | 4 wks | Dose reminders, vaccine tracking, longitudinal AI memory | [Phase 4 Specification](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/Phase%204%20-%20Retention%20Engine.md) |
| **5** | **Business Layer** | 4 wks | Clinic invoicing, SaaS subscriptions, Super Admin portal | [Phase 5 Specification](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/Phase%205%20-%20Business%20Layer.md) |
| **6** | **Operations** | 3–4 wks | Front desk token queue, nurse vitals, pharmacy, lab pipeline | [Phase 6 Specification](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/Phase%206%20-%20Operations.md) |
| **7** | **Advanced Capabilities & Telehealth** | 4+ wks | Pre-visit intake, teleconsults, insurance bundles, async chat | [Phase 7 Specification](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/Phase%207%20-%20Advanced.md) |
| **UI** | **UI, Theme & Mobile Guidelines** | Cross-Phase | Single theme token file, mobile-first 360px, side-by-side viewports | [UI Guidelines](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/implement%20plan/UI_GUIDELINES.md) |

*Total time to commercial sellable product (Phases 1–5): roughly **4–5 months**.*

---

## 0. Guiding Architectural Decisions

| Decision | Choice | Reason |
|:---|:---|:---|
| **App structure** | **One frontend app, role-based routing** (`/doctor`, `/owner`, `/admin`, `/desk`, `/superadmin`) | One codebase, unified design system, single deployment |
| **Backend** | Keep Express modular monolith | Add structured modules without requiring a rewrite |
| **Tenancy** | **Shared DB, `clinic_id` on every tenant table** + PostgreSQL Row-Level Security (RLS) | Cost-effective; hardware-enforced isolation at the database layer |
| **Auth** | Email+password, phone OTP (owners), JWT access + refresh in `httpOnly` cookies, TOTP MFA for staff | Robust medical-grade security |
| **Jobs & Queues** | BullMQ + Redis | Background reminders, notifications, PDF generation, retention purging |
| **File Storage** | S3-compatible object storage (not BYTEA in Postgres) | Encrypted storage for audio recordings, PDFs, clinical media |
| **Notifications** | Email (SES/Resend), SMS (MSG91/Twilio), WhatsApp (Cloud API/Gupshup), Web Push | India-first and global multi-channel reach |
| **Rollout** | Feature flags per clinic | Controlled, risk-free gradual feature releases |

### Roles & Permissions (RBAC)

| Role | Scope & Permissions |
|:---|:---|
| `super_admin` | Platform-wide management, subscription metrics, infrastructure health; **no clinical PHI by default** |
| `clinic_admin` | Single clinic: staff management, working hours, billing, and integrity audit logs |
| `doctor` | Assigned consultations, patient records, clinical signing, and medication safety overrides |
| `staff` | Front desk token queue, nurse triage vitals, pharmacy dispensing, lab sample intake |
| `pet_owner` | Self-service: own pets, digital consents, signed PDF downloads, dose reminders |

### Golden Rules (Never Break)

1. **Every query is tenant-scoped.** Always enforce `clinic_id` via Postgres RLS and query parameters.
2. **Identity comes from the JWT, never from request headers.** Header `x-doctor-id` trust is strictly prohibited.
3. **Every sensitive action writes to the audit ledger.**
4. **AI output is always a draft until a licensed doctor reviews and signs.**
5. **Each phase ships behind feature flags with automated test verification before the next begins.**

---

## 🏛️ Cross-Cutting Workstreams

### A. Audit Ledger Expansion
- Append immutable cryptographic entries for: `login`, `login_failed`, `mfa_enrolled`, `document_viewed`, `document_exported`, `pdf_issued`, `consent_signed`, `role_changed`, `impersonation_started`, `data_exported`, `data_deleted`.
- Scoped hash-chains per `clinic_id` to guarantee tenant independence.
- Nightly automated integrity audit job with proactive alerting.

### B. Privacy & Compliance
- **Regulatory Framework:** Compliance with the DPDP Act 2023 (India) and GDPR.
- Explicit versioned consent tracking, purpose limitation, and automated data erasure workflows.
- Audio retention worker to systematically purge raw consultation audio while retaining signed text and cryptographic fingerprints.
- At-rest AES-256 encryption on database volumes, object storage, and sensitive PII columns.

### C. Reliability & Observability
- Environments: `dev`, `staging`, and `prod` with automated migration rollback plans.
- Structured JSON logging, Sentry error monitoring, Datadog/Prometheus metrics, and BullMQ queue depth monitoring.
- Concurrency rate limiters and provider failover chains for Whisper and LLM endpoints.

### D. Testing Matrix
- **Unit Testing:** `node --test` for algorithms, date calculations, and dose formulations.
- **Integration Testing:** Real PostgreSQL instance with RLS enabled to test multi-tenancy.
- **Security Testing:** Automated cross-tenant isolation tests and OWASP ZAP scanning.
- **End-to-End (E2E):** Playwright automated journeys per user role.
- **AI Quality Benchmarks:** Golden audio transcripts tested against expected extractions to track edit distances and prevent regressions.

---

## 📂 Target Repository Structure

```
backend/src/modules/
  auth/            # Signup, login, logout, refresh, otp, reset, email verify
  mfa/             # TOTP setup, verification, recovery keys
  rbac/            # Role and permission matrices, route guards
  tenancy/         # Clinic context middleware, Postgres RLS injector
  invitations/     # Staff invite tokens and acceptance flows
  sessions/        # Multi-device session tracking and revoking
  clinics/         # Clinic entity and branch management
  staff/           # Staff roster and license approval
  owners/          # Pet owner registry and duplicate merging
  pets/            # Pet registry, medical history, allergies
  scheduling/      # Availability engine and calendar booking
  clinic-settings/ # Letterhead, hours, retention policies
  audio/           # Audio ingest and streaming chunks
  transcription/   # Whisper processing and multi-language support
  clinical-ai/     # LLM prompting, patient memory, dose formulary
  consultations/   # Consultation lifecycles and queue
  documents/       # SOAP summaries, prescriptions, lab orders
  audit/           # Cryptographic tamper-evident ledger
  pdf/             # Headless PDF rendering with QR verification
  notifications/   # WhatsApp, SMS, and Email delivery queue
  consents/        # Digital consent signatures and templates
  medications/     # Structured adherence schedules and dose logs
  vaccinations/    # Species-specific protocols and reminders
  billing/         # Invoices, payments, Razorpay/Stripe webhooks
  subscriptions/   # SaaS tiered plans and usage metering
  inventory/       # Pharmacy stock movements and dispensing
  lab/             # Diagnostics sample lifecycle and results
  jobs/            # BullMQ background workers
frontend/src/features/
  auth/            # Login, clinic registration, OTP, MFA
  doctor/          # Queue, consultation workspace, patient memory
  owner/           # Mobile-friendly pet portal, reminders, consents
  admin/           # Clinic settings, staff, calendar, audit log
  desk/            # Front desk check-in, token queue, nurse triage
  superadmin/      # System health, SaaS billing, usage margins
  shared/          # Common UI components, design tokens, API client
```

---

## ⚡ Risk Register

| Risk | Impact | Mitigation Strategy |
|:---|:---|:---|
| **Tenant Data Leak** | Critical | Enforce DB-level PostgreSQL RLS + strict cross-tenant CI test suite. |
| **AI Hallucination in Prescriptions** | Critical | Human doctor sign-off required; formulary safety engine flags dosages and species contraindications. |
| **LLM & Whisper Cost Overrun** | High | Real-time usage event metering, hard plan caps, and model fallback tiering. |
| **WhatsApp Template Delays** | Medium | Initiate template approvals early; implement SMS and email fallbacks. |
| **Regional Language Translation Errors** | Medium | Dual-review verification, doctor preview before dispatch, and prominent "AI-Translated" badges. |
| **Single-Provider Dependency** | Medium | Maintain dynamic fallback chain across LLM and transcription providers. |

---

## ✅ Definition of Done (Per Feature)

1. Database migration written with validated rollback script.
2. Tenant scoping and RBAC authorization enforced and covered by tests.
3. Cryptographic audit event logged for state changes.
4. Usage event recorded for billable compute (Whisper/LLM/SMS/WhatsApp).
5. Protected behind a tenant feature flag.
6. Unit, integration, and E2E test coverage passes CI.
7. Technical documentation and API references updated.
8. Deployed and verified on staging with pilot clinic users.

