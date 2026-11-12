-- Migration: 010_backfill_existing_tenants.sql
-- Description: Idempotent backfill mapping existing clinics, users, doctors, owners, and pets
--              into practices, hospital_profiles, user_roles, practice_members, doctor_profiles,
--              pet_owner_profiles, and pet_practice_links.

-- 1. Backfill `practices` 1:1 from existing `clinics`
INSERT INTO practices (
  clinic_id, practice_type, name, slug, status, email, phone, address, is_discoverable, created_at, updated_at
)
SELECT
  c.id,
  'HOSPITAL',
  c.name,
  c.slug,
  CASE
    WHEN LOWER(c.status) = 'active' THEN 'ACTIVE'
    WHEN LOWER(c.status) = 'suspended' THEN 'SUSPENDED'
    WHEN LOWER(c.status) = 'pending_approval' THEN 'PENDING_APPROVAL'
    WHEN LOWER(c.status) = 'pending_verification' THEN 'PENDING_VERIFICATION'
    WHEN LOWER(c.status) = 'rejected' THEN 'REJECTED'
    WHEN LOWER(c.status) IN ('cancelled', 'inactive') THEN 'INACTIVE'
    ELSE 'ACTIVE'
  END,
  NULL,
  c.phone,
  c.address,
  TRUE,
  c.created_at,
  NOW()
FROM clinics c
ON CONFLICT (clinic_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('practices', 'id'), COALESCE((SELECT MAX(id) FROM practices), 1));

-- 2. Backfill `hospital_profiles` for existing HOSPITAL practices
INSERT INTO hospital_profiles (
  practice_id, hospital_name, hospital_email, contact_number, address, city, state, pin_code,
  registration_number, admin_name, approved_at, created_at
)
SELECT
  pr.id,
  pr.name,
  COALESCE((SELECT u.email FROM users u WHERE u.clinic_id = pr.clinic_id AND u.role = 'clinic_admin' LIMIT 1), 'admin@' || pr.slug || '.vet'),
  COALESCE(pr.phone, 'Not Provided'),
  COALESCE(pr.address, 'Address on file'),
  'Metro',
  'State',
  '000000',
  'LIC-' || pr.clinic_id,
  COALESCE((SELECT u.name FROM users u WHERE u.clinic_id = pr.clinic_id AND u.role = 'clinic_admin' LIMIT 1), pr.name || ' Admin'),
  CASE WHEN pr.status = 'ACTIVE' THEN pr.created_at ELSE NULL END,
  pr.created_at
FROM practices pr
WHERE pr.practice_type = 'HOSPITAL'
ON CONFLICT (practice_id) DO NOTHING;

-- 3. Backfill `user_roles` from existing `users.role`
INSERT INTO user_roles (user_id, role)
SELECT
  u.id,
  CASE LOWER(u.role)
    WHEN 'super_admin' THEN 'SUPER_ADMIN'
    WHEN 'clinic_admin' THEN 'HOSPITAL_ADMIN'
    WHEN 'doctor' THEN 'DOCTOR'
    WHEN 'veterinarian' THEN 'DOCTOR'
    WHEN 'owner' THEN 'PET_OWNER'
    ELSE 'STAFF'
  END
FROM users u
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Backfill `practice_members` for users assigned to clinics
INSERT INTO practice_members (
  practice_id, user_id, role, status, is_primary, joined_at, approved_at, created_at
)
SELECT
  pr.id,
  u.id,
  CASE LOWER(u.role)
    WHEN 'clinic_admin' THEN 'ADMIN'
    WHEN 'doctor' THEN 'DOCTOR'
    WHEN 'veterinarian' THEN 'DOCTOR'
    ELSE 'STAFF'
  END,
  CASE
    WHEN LOWER(u.status) = 'active' THEN 'ACTIVE'
    WHEN LOWER(u.status) = 'suspended' THEN 'SUSPENDED'
    WHEN LOWER(u.status) IN ('deactivated', 'inactive') THEN 'INACTIVE'
    ELSE 'ACTIVE'
  END,
  TRUE,
  u.created_at,
  u.created_at,
  u.created_at
FROM users u
JOIN practices pr ON pr.clinic_id = u.clinic_id
WHERE u.clinic_id IS NOT NULL
  AND LOWER(u.role) <> 'super_admin'
ON CONFLICT (practice_id, user_id) DO NOTHING;

-- Update practices.owner_user_id for hospital admins where empty
UPDATE practices pr
SET owner_user_id = pm.user_id
FROM practice_members pm
WHERE pm.practice_id = pr.id
  AND pm.role IN ('OWNER', 'ADMIN')
  AND pr.owner_user_id IS NULL;

-- 5. Backfill `doctor_profiles` for existing doctors
INSERT INTO doctor_profiles (
  user_id, qualification, registration_number, specialization, years_of_experience, license_verified_at
)
SELECT
  u.id,
  'DVM / BVSc',
  u.license_number,
  u.specialty,
  0,
  u.license_verified_at
FROM users u
WHERE LOWER(u.role) IN ('doctor', 'veterinarian')
ON CONFLICT (user_id) DO NOTHING;

-- 6. Backfill `pet_practice_links` from existing `pets.clinic_id`
INSERT INTO pet_practice_links (pet_id, practice_id, clinic_id, status, first_linked_at)
SELECT
  p.id,
  pr.id,
  p.clinic_id,
  'ACTIVE',
  p.created_at
FROM pets p
JOIN practices pr ON pr.clinic_id = p.clinic_id
WHERE p.clinic_id IS NOT NULL
ON CONFLICT (pet_id, practice_id) DO NOTHING;

-- 7. Backfill `pet_owner_profiles` for owners already linked to a user_id
INSERT INTO pet_owner_profiles (user_id, full_name, email, phone, address, preferred_language, legacy_owner_id)
SELECT
  o.user_id,
  o.name,
  o.email,
  o.phone,
  o.address,
  COALESCE(o.preferred_language, 'en'),
  o.id
FROM owners o
WHERE o.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 8. Sync `appointments.practice_id` from `appointments.clinic_id`
UPDATE appointments a
SET practice_id = pr.id
FROM practices pr
WHERE pr.clinic_id = a.clinic_id
  AND a.practice_id IS NULL;

