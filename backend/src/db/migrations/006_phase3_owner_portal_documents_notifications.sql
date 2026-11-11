-- =========================================================================
-- Migration 006: Phase 3 — Owner Portal, Signed Documents & Email Notifications
-- Multi-tenancy RLS enabled, SERIAL PKs (no UUIDs), Email-only notifications
-- =========================================================================

-- 1. Versioned Consent Templates
CREATE TABLE IF NOT EXISTS consent_templates (
  id SERIAL PRIMARY KEY,
  clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  type VARCHAR(50) NOT NULL DEFAULT 'audio_recording', -- audio_recording, surgical, general_treatment
  title VARCHAR(255) NOT NULL,
  body_md TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, type, version, language)
);

CREATE INDEX IF NOT EXISTS idx_consent_templates_clinic ON consent_templates(clinic_id, type, active);

-- 2. Enhance Recording Consents
ALTER TABLE recording_consents
  ADD COLUMN IF NOT EXISTS template_id INT REFERENCES consent_templates(id),
  ADD COLUMN IF NOT EXISTS template_version INT,
  ADD COLUMN IF NOT EXISTS signed_by_owner_id INT REFERENCES owners(id),
  ADD COLUMN IF NOT EXISTS signature_type VARCHAR(50) DEFAULT 'canvas', -- 'canvas', 'typed', 'doctor_in_person_attestation'
  ADD COLUMN IF NOT EXISTS signature_data TEXT, -- Base64 SVG/PNG or typed name
  ADD COLUMN IF NOT EXISTS ip VARCHAR(45),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recording_consents_owner ON recording_consents(signed_by_owner_id);

-- 3. Generated Signed PDF Files & Cryptographic Fingerprints (SERIAL PK, NO UUID)
CREATE TABLE IF NOT EXISTS generated_files (
  id SERIAL PRIMARY KEY,
  clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_id INT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  doc_id INT REFERENCES consultation_documents(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'prescription_pdf', 'visit_summary_pdf'
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  ledger_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gen_files_hash ON generated_files(ledger_hash);
CREATE INDEX IF NOT EXISTS idx_gen_files_doc ON generated_files(doc_id);
CREATE INDEX IF NOT EXISTS idx_gen_files_consultation ON generated_files(consultation_id);

-- 4. Notification Queue & Audit Log (SERIAL PK, NO UUID, EMAIL ONLY)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  owner_id INT REFERENCES owners(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL DEFAULT 'email', -- 'email'
  template VARCHAR(100) NOT NULL,
  recipient VARCHAR(100) NOT NULL, -- recipient email address
  subject VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_id);

-- 5. Notification Preferences (Email Only)
CREATE TABLE IF NOT EXISTS notification_preferences (
  owner_id INT PRIMARY KEY REFERENCES owners(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Expiring Secure Share Links (SERIAL PK, NO UUID)
CREATE TABLE IF NOT EXISTS share_links (
  id SERIAL PRIMARY KEY,
  doc_id INT NOT NULL REFERENCES consultation_documents(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token_hash);

-- 7. Row Level Security Policies
ALTER TABLE consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_consent_templates') THEN
    CREATE POLICY tenant_isolation_consent_templates ON consent_templates
      FOR ALL USING (clinic_id = current_setting('app.clinic_id', true)::int OR current_setting('app.is_super_admin', true) = 'true');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_generated_files') THEN
    CREATE POLICY tenant_isolation_generated_files ON generated_files
      FOR ALL USING (clinic_id = current_setting('app.clinic_id', true)::int OR current_setting('app.is_super_admin', true) = 'true');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_notifications') THEN
    CREATE POLICY tenant_isolation_notifications ON notifications
      FOR ALL USING (clinic_id = current_setting('app.clinic_id', true)::int OR current_setting('app.is_super_admin', true) = 'true');
  END IF;
END $$;

-- 8. Seed Default Recording Consent Templates
INSERT INTO consent_templates (clinic_id, version, type, title, body_md, language, active)
VALUES
  (1, 1, 'audio_recording', 'Digital Audio Recording & AI Medical Scribe Consent', 
   'I hereby grant permission to Central Valley Animal Hospital to record audio of this clinical consultation. The recording is strictly processed for the sole purpose of clinical transcription, medical record accuracy, and veterinary care documentation. I acknowledge that I may revoke this consent at any time.', 
   'en', true)
ON CONFLICT (clinic_id, type, version, language) DO NOTHING;
