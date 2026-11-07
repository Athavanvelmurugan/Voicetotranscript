-- Base PetCare Application Tables (Preserved & Created if not already present)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'veterinarian',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  species VARCHAR(100) NOT NULL,
  breed VARCHAR(100),
  age_years NUMERIC(4,1),
  weight_kg NUMERIC(5,2),
  owner_name VARCHAR(255),
  owner_contact VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 9 New Tables for AI Veterinary Consultation System (INTEGER PKs: 1, 2, 3...)
-- =========================================================================

-- 1. Consultations
CREATE TABLE IF NOT EXISTS consultations (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'recording', 'paused', 'processing', 'completed', 'cancelled')),
  language VARCHAR(20) NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'ta', 'en-ta')),
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  audio_file_path TEXT,
  audio_duration_seconds INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_pet_id ON consultations(pet_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

-- 2. Transcript Segments (Strict sequence number to prevent duplicates)
CREATE TABLE IF NOT EXISTS transcript_segments (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  is_partial BOOLEAN NOT NULL DEFAULT false,
  speaker_role VARCHAR(50) DEFAULT 'unknown'
    CHECK (speaker_role IN ('doctor', 'owner', 'laboratory', 'existing_medical_record', 'unknown')),
  language_detected VARCHAR(20),
  confidence NUMERIC(4,3) DEFAULT 1.000,
  start_ms INTEGER DEFAULT 0,
  end_ms INTEGER DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'openai_realtime',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_consultation_sequence_partial UNIQUE (consultation_id, sequence_number, is_partial)
);

CREATE INDEX IF NOT EXISTS idx_segments_consultation ON transcript_segments(consultation_id, sequence_number);

-- 3. Clinical Extractions (One consolidated extraction per consultation)
CREATE TABLE IF NOT EXISTS clinical_extractions (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL UNIQUE REFERENCES consultations(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'needs_review')),
  model_used VARCHAR(100),
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  pet_info JSONB DEFAULT '{}'::jsonb,
  chief_complaints JSONB DEFAULT '[]'::jsonb,
  symptoms JSONB DEFAULT '[]'::jsonb,
  medical_history JSONB DEFAULT '{}'::jsonb,
  allergies JSONB DEFAULT '[]'::jsonb,
  vitals JSONB DEFAULT '{}'::jsonb,
  observations JSONB DEFAULT '[]'::jsonb,
  diagnoses JSONB DEFAULT '[]'::jsonb,
  medications JSONB DEFAULT '[]'::jsonb,
  lab_tests JSONB DEFAULT '[]'::jsonb,
  follow_up JSONB DEFAULT '{}'::jsonb,
  missing_info JSONB DEFAULT '[]'::jsonb,
  contradictions JSONB DEFAULT '[]'::jsonb,
  raw_extraction JSONB,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  processing_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Consultation Documents (Prescription, Lab Tests, SOAP Notes, Follow-up, Summary)
CREATE TABLE IF NOT EXISTS consultation_documents (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  extraction_id INTEGER REFERENCES clinical_extractions(id) ON DELETE SET NULL,
  doc_type VARCHAR(50) NOT NULL
    CHECK (doc_type IN ('prescription', 'lab_tests', 'soap_notes', 'follow_up', 'summary')),
  status VARCHAR(50) NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'draft', 'needs_review', 'approved', 'rejected', 'failed')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  doctor_notes TEXT,
  current_version INTEGER NOT NULL DEFAULT 1,
  missing_fields JSONB DEFAULT '[]'::jsonb,
  ai_confidence NUMERIC(4,3) DEFAULT 1.000,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_consultation_doc_type UNIQUE (consultation_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_docs_consultation ON consultation_documents(consultation_id);
CREATE INDEX IF NOT EXISTS idx_docs_status ON consultation_documents(status);

-- 5. Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES consultation_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  change_type VARCHAR(50) NOT NULL
    CHECK (change_type IN ('ai_generated', 'doctor_edit', 'approved', 'rejected', 'regenerated')),
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_doc_version UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id);

-- 6. Document Approvals
CREATE TABLE IF NOT EXISTS document_approvals (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES consultation_documents(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected')),
  version_number INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_document ON document_approvals(document_id);

-- 7. Consultation Audit Logs (Immutable ledger)
CREATE TABLE IF NOT EXISTS consultation_audit_logs (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('doctor', 'system', 'ai')),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_consultation ON consultation_audit_logs(consultation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON consultation_audit_logs(created_at);

-- 8. Recording Consents
CREATE TABLE IF NOT EXISTS recording_consents (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL UNIQUE REFERENCES consultations(id) ON DELETE CASCADE,
  given_by VARCHAR(255) NOT NULL,
  consent_method VARCHAR(50) NOT NULL DEFAULT 'digital_signature',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Audio Retention Policies
CREATE TABLE IF NOT EXISTS audio_retention_policies (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL UNIQUE REFERENCES consultations(id) ON DELETE CASCADE,
  retain_until TIMESTAMPTZ NOT NULL,
  deletion_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (deletion_status IN ('pending', 'deleted', 'retained')),
  deleted_at TIMESTAMPTZ,
  policy_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Binary Audio Storage (Direct in-database persistence without disk saving)
CREATE TABLE IF NOT EXISTS consultation_audio (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  audio_data BYTEA NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'audio/wav',
  file_name VARCHAR(255) DEFAULT 'audio.wav',
  file_size_bytes BIGINT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_audio_consultation_id ON consultation_audio(consultation_id);

-- 11. Cryptographic Audit Ledger (Append-only SHA-256 hash-chained immutable ledger)
CREATE TABLE IF NOT EXISTS consultation_audit_ledger (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('doctor', 'system', 'ai', 'admin')),
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_hash VARCHAR(64) NOT NULL,
  current_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consultation_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_audit_ledger_consultation ON consultation_audit_ledger(consultation_id);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_seq ON consultation_audit_ledger(consultation_id, sequence_number);


