-- Migration: 009_independent_registration_multi_practice.sql
-- Description: Independent self-registration, multi-practice workspaces (HOSPITAL & INDEPENDENT),
--              unified RBAC roles, doctor profiles, hospital profiles, pet-owner profiles,
--              hospital join requests & invitations, and multi-practice pet linking.

-- 1. Expand clinics.status check constraint to support full onboarding lifecycle
ALTER TABLE clinics DROP CONSTRAINT IF EXISTS clinics_status_check;
ALTER TABLE clinics ADD CONSTRAINT clinics_status_check
  CHECK (status IN (
    'active', 'suspended', 'trial', 'cancelled',
    'pending_verification', 'pending_approval', 'rejected', 'inactive'
  ));

-- 2. Support multiple password hashing algorithms (Argon2id for new, bcrypt for legacy)
ALTER TABLE user_credentials
  ADD COLUMN IF NOT EXISTS password_algo VARCHAR(20) NOT NULL DEFAULT 'bcrypt';

-- 3. Ensure users supports status lifecycle & optional clinic_id (never mandatory)
ALTER TABLE users ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS profile_photo_key TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN (
    'active', 'suspended', 'deactivated', 'invited',
    'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'INACTIVE'
  ));

-- 4. Multi-Role RBAC table (`user_roles`)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(40) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PET_OWNER', 'STAFF')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- 5. Practices (`HOSPITAL` | `INDEPENDENT`), bridged 1:1 with clinics(id) for full RLS & clinical compatibility
CREATE TABLE IF NOT EXISTS practices (
  id SERIAL PRIMARY KEY,
  clinic_id INT UNIQUE NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  practice_type VARCHAR(20) NOT NULL CHECK (practice_type IN ('HOSPITAL', 'INDEPENDENT')),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  owner_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION'
    CHECK (status IN ('PENDING_VERIFICATION', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'INACTIVE')),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pin_code VARCHAR(20),
  specialization VARCHAR(255),
  is_discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practices_type_status ON practices(practice_type, status);
CREATE INDEX IF NOT EXISTS idx_practices_owner ON practices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_practices_city ON practices(city);

-- 6. Hospital Profiles (for HOSPITAL registration & Super Admin verification workflow)
CREATE TABLE IF NOT EXISTS hospital_profiles (
  practice_id INT PRIMARY KEY REFERENCES practices(id) ON DELETE CASCADE,
  hospital_name VARCHAR(255) NOT NULL,
  hospital_email VARCHAR(255) NOT NULL,
  contact_number VARCHAR(50) NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city VARCHAR(100) NOT NULL DEFAULT '',
  state VARCHAR(100) NOT NULL DEFAULT '',
  pin_code VARCHAR(20) NOT NULL DEFAULT '',
  registration_number VARCHAR(120) NOT NULL,
  admin_name VARCHAR(255) NOT NULL,
  reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Doctor Profiles (Independent and/or Hospital-Affiliated veterinarians)
CREATE TABLE IF NOT EXISTS doctor_profiles (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  qualification VARCHAR(255) NOT NULL DEFAULT 'BVSc / DVM',
  registration_number VARCHAR(120),
  specialization VARCHAR(255),
  years_of_experience INT NOT NULL DEFAULT 0 CHECK (years_of_experience >= 0),
  photo_key TEXT,
  independent_practice_id INT REFERENCES practices(id) ON DELETE SET NULL,
  license_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_indep ON doctor_profiles(independent_practice_id);

-- 8. Pet Owner Profiles (Unified with `users`, linked to legacy `owners` for backward compatibility)
CREATE TABLE IF NOT EXISTS pet_owner_profiles (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  address TEXT,
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
  legacy_owner_id INT UNIQUE REFERENCES owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Practice Memberships (`practice_members`)
CREATE TABLE IF NOT EXISTS practice_members (
  id SERIAL PRIMARY KEY,
  practice_id INT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'DOCTOR', 'RECEPTIONIST', 'STAFF')),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN ('PENDING_VERIFICATION', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'INACTIVE')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  invited_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(practice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_practice_members_user_status ON practice_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_practice_members_practice_status ON practice_members(practice_id, status);

-- 10. Hospital Invitations (`hospital_invitations`)
CREATE TABLE IF NOT EXISTS hospital_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id INT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  clinic_id INT REFERENCES clinics(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invited_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'STAFF')),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  invited_by INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hosp_invitations_email_status ON hospital_invitations(LOWER(email), status);
CREATE INDEX IF NOT EXISTS idx_hosp_invitations_user_status ON hospital_invitations(invited_user_id, status);

-- 11. Hospital Join Requests (`hospital_join_requests`)
CREATE TABLE IF NOT EXISTS hospital_join_requests (
  id SERIAL PRIMARY KEY,
  practice_id INT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  doctor_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosp_join_req_pending_unique
  ON hospital_join_requests(practice_id, doctor_user_id)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_hosp_join_req_practice ON hospital_join_requests(practice_id, status);
CREATE INDEX IF NOT EXISTS idx_hosp_join_req_doctor ON hospital_join_requests(doctor_user_id, status);

-- 12. Evolve `pets`, `owners`, `appointments` & create `pet_practice_links`
ALTER TABLE pets ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pets_owner_user ON pets(owner_user_id);

ALTER TABLE owners ALTER COLUMN clinic_id DROP NOT NULL;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS practice_id INT REFERENCES practices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_practice ON appointments(practice_id);

CREATE TABLE IF NOT EXISTS pet_practice_links (
  id SERIAL PRIMARY KEY,
  pet_id INT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  practice_id INT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  consent_shared BOOLEAN NOT NULL DEFAULT TRUE,
  first_linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ,
  UNIQUE(pet_id, practice_id)
);

CREATE INDEX IF NOT EXISTS idx_pet_practice_links_practice ON pet_practice_links(practice_id, status);
CREATE INDEX IF NOT EXISTS idx_pet_practice_links_clinic ON pet_practice_links(clinic_id, status);

-- Update RLS policies on `pets`, `owners`, and `audit_events` for hospital-optional & multi-practice access
DROP POLICY IF EXISTS clinic_isolation_policy ON pets;
CREATE POLICY clinic_isolation_policy ON pets
  FOR ALL
  USING (
    clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    OR owner_user_id = NULLIF(current_setting('app.user_id', true), '')::int
    OR EXISTS (
      SELECT 1 FROM pet_practice_links ppl
      WHERE ppl.pet_id = pets.id
        AND ppl.status = 'ACTIVE'
        AND ppl.clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    )
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS clinic_isolation_policy ON owners;
CREATE POLICY clinic_isolation_policy ON owners
  FOR ALL
  USING (
    clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    OR user_id = NULLIF(current_setting('app.user_id', true), '')::int
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- 13. Make `audit_events.clinic_id` nullable so pre-practice / platform auth & approval events log cleanly
ALTER TABLE audit_events ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS practice_id INT REFERENCES practices(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS clinic_isolation_policy ON audit_events;
CREATE POLICY clinic_isolation_policy ON audit_events
  FOR ALL
  USING (
    clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::int
    OR clinic_id IS NULL
    OR actor_user_id = NULLIF(current_setting('app.user_id', true), '')::int
    OR current_setting('app.is_super_admin', true) = 'true'
  );

