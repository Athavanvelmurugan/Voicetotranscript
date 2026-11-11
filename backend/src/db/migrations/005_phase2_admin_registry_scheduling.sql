-- Migration: 005_phase2_admin_registry_scheduling.sql
-- Description: Phase 2 Clinic Admin, Registry, Scheduling, Doctor Availability, and Operational Audit Logs

-- 1. Owners Registry Table
CREATE TABLE IF NOT EXISTS owners (
  id SERIAL PRIMARY KEY,
  clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owners_clinic_phone ON owners(clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_owners_clinic_name ON owners(clinic_id, name);

-- 2. Pet-Owner Many-to-Many Relationship
CREATE TABLE IF NOT EXISTS pet_owners (
  pet_id INT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id INT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pet_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_pet_owners_owner ON pet_owners(owner_id);

-- 3. Extend pets table for Clinical Safety
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS sex VARCHAR(20) DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS microchip_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chronic_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_key VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_pets_microchip ON pets(clinic_id, microchip_no);

-- 4. Clinic Settings & Letterhead
CREATE TABLE IF NOT EXISTS clinic_settings (
  clinic_id INT PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  letterhead_key VARCHAR(255),
  logo_key VARCHAR(255),
  address TEXT,
  phone VARCHAR(50),
  gstin VARCHAR(50),
  working_hours JSONB NOT NULL DEFAULT '{
    "monday": {"start": "09:00", "end": "19:00"},
    "tuesday": {"start": "09:00", "end": "19:00"},
    "wednesday": {"start": "09:00", "end": "19:00"},
    "thursday": {"start": "09:00", "end": "19:00"},
    "friday": {"start": "09:00", "end": "19:00"},
    "saturday": {"start": "09:00", "end": "17:00"},
    "sunday": null
  }'::jsonb,
  default_language VARCHAR(10) NOT NULL DEFAULT 'en',
  audio_retention_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Doctor Availability
CREATE TABLE IF NOT EXISTS doctor_availability (
  id SERIAL PRIMARY KEY,
  clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes INT NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_avail_schedule ON doctor_availability(clinic_id, doctor_id, weekday, is_active);

-- 6. Extend appointments table
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'general_checkup',
  ADD COLUMN IF NOT EXISTS duration_min INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'desk',
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(clinic_id, doctor_id, scheduled_at, status);

-- 7. Operational Audit Events Table
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_clinic_time ON audit_events(clinic_id, created_at DESC);

-- 8. Backfill Data
-- A. Backfill Owners from existing Pets table
DO $$
DECLARE
  p RECORD;
  new_owner_id INT;
BEGIN
  FOR p IN SELECT id, clinic_id, owner_name, owner_contact FROM pets WHERE owner_name IS NOT NULL LOOP
    -- Check if owner exists for this clinic
    SELECT id INTO new_owner_id FROM owners 
    WHERE clinic_id = p.clinic_id AND name = p.owner_name LIMIT 1;

    IF new_owner_id IS NULL THEN
      INSERT INTO owners (clinic_id, name, phone, preferred_language)
      VALUES (p.clinic_id, p.owner_name, COALESCE(NULLIF(p.owner_contact, ''), '9876543200'), 'en')
      RETURNING id INTO new_owner_id;
    END IF;

    -- Link pet to owner if not already linked
    INSERT INTO pet_owners (pet_id, owner_id, is_primary)
    VALUES (p.id, new_owner_id, true)
    ON CONFLICT (pet_id, owner_id) DO NOTHING;
  END LOOP;
END $$;

-- B. Backfill Clinic Settings for all clinics
INSERT INTO clinic_settings (clinic_id, address, phone)
SELECT id, '123 Veterinary Hospital Road, Central District', '+91 98765 43210'
FROM clinics c
WHERE NOT EXISTS (SELECT 1 FROM clinic_settings cs WHERE cs.clinic_id = c.id);

-- C. Backfill Doctor Availability for all active doctors (Mon to Fri 09:00 - 17:00)
DO $$
DECLARE
  u RECORD;
  w INT;
BEGIN
  FOR u IN SELECT id, clinic_id FROM users WHERE role = 'doctor' AND clinic_id IS NOT NULL LOOP
    FOR w IN 1..5 LOOP
      INSERT INTO doctor_availability (clinic_id, doctor_id, weekday, start_time, end_time, slot_minutes)
      SELECT u.clinic_id, u.id, w, '09:00:00'::TIME, '17:00:00'::TIME, 15
      WHERE NOT EXISTS (
        SELECT 1 FROM doctor_availability da 
        WHERE da.clinic_id = u.clinic_id AND da.doctor_id = u.id AND da.weekday = w
      );
    END LOOP;
  END LOOP;
END $$;

-- 9. Row-Level Security Policies for Phase 2 Tables
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinic_isolation_policy ON owners;
CREATE POLICY clinic_isolation_policy ON owners
  FOR ALL
  USING (
    clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    OR current_setting('app.is_super_admin', true) = 'true'
  );

ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinic_isolation_policy ON clinic_settings;
CREATE POLICY clinic_isolation_policy ON clinic_settings
  FOR ALL
  USING (
    clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    OR current_setting('app.is_super_admin', true) = 'true'
  );

ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinic_isolation_policy ON doctor_availability;
CREATE POLICY clinic_isolation_policy ON doctor_availability
  FOR ALL
  USING (
    clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    OR current_setting('app.is_super_admin', true) = 'true'
  );

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinic_isolation_policy ON audit_events;
CREATE POLICY clinic_isolation_policy ON audit_events
  FOR ALL
  USING (
    clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    OR current_setting('app.is_super_admin', true) = 'true'
  );

