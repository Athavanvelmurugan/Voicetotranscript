-- Migration: 008_multi_hospital_and_doctors_seed.sql
-- Description: Seed multi-hospital veterinary network, specialists, availability, and enhance clinics/users

-- 1. Extend clinics & users with address, phone, specialty
ALTER TABLE clinics 
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS specialty VARCHAR(255);

-- 2. Seed / Update 4 Accredited Veterinary Hospitals
INSERT INTO clinics (id, name, slug, status, timezone, locale, address, phone, is_emergency)
VALUES 
  (1, 'Central Valley Animal Hospital', 'central-valley', 'active', 'Asia/Kolkata', 'en', '1044 Blossom Hill Rd, San Jose, CA', '+1 (408) 555-0199', FALSE),
  (200, 'Starlight 24/7 Emergency & Trauma Hospital', 'starlight-emergency', 'active', 'Asia/Kolkata', 'en', '742 Evergreen Blvd, Downtown Metro', '+1 (555) 911-PETS', TRUE),
  (204, 'Sunset Animal Specialty & Wellness Center', 'sunset-wellness', 'active', 'Asia/Kolkata', 'en', '1200 Ocean Ave, Westside Medical District', '+1 (555) 880-CARE', FALSE),
  (207, 'Pacific Paws Exotic & Avian Care', 'pacific-paws', 'active', 'Asia/Kolkata', 'en', '55 Marina Shoreline, Bay Area', '+1 (555) 345-WILD', FALSE)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  is_emergency = EXCLUDED.is_emergency,
  status = 'active';

SELECT setval(pg_get_serial_sequence('clinics', 'id'), COALESCE((SELECT MAX(id) FROM clinics), 207));

-- 3. Seed / Update Doctors across Hospitals with distinct specialties using ON CONFLICT (email)
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) + 10 FROM users));

-- Hospital 1: Central Valley Animal Hospital
INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (1, 'Dr. Mouni, BVSc', 'mouni@gmail.com', 'doctor', 'active', 'VET-CA-88910', 'Chief Veterinary Officer • General Medicine & Preventative Care')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 1,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (1, 'Dr. Emily Chen, DVM', 'emily.chen@petcare.vet', 'doctor', 'active', 'VET-CA-92144', 'Lead Small Animal Surgeon • Orthopedics & Soft Tissue')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 1,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (1, 'Dr. Rajesh Kumar, MVSc', 'rajesh.kumar@centralvalleyvet.com', 'doctor', 'active', 'VET-CA-77412', 'Veterinary Dermatologist • Allergy & Immunology')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 1,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

-- Hospital 200: Starlight 24/7 Emergency & Trauma Hospital
INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (200, 'Dr. Gregory House, DVM', 'gregory.house@starlight.vet', 'doctor', 'active', 'VET-EM-60012', 'Internal Diagnostic Medicine & Veterinary Ultrasound')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 200,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (200, 'Dr. Sarah Connor, DVM', 'sarah.connor@starlight.vet', 'doctor', 'active', 'VET-EM-60034', 'Emergency Critical Care & Trauma Specialist')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 200,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

-- Hospital 204: Sunset Animal Specialty & Wellness Center
INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (204, 'Dr. Michael Chang, DVM', 'michael.chang@sunset.vet', 'doctor', 'active', 'VET-DS-44101', 'Veterinary Dentistry & Oral Reconstruction')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 204,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (204, 'Dr. Amanda Ross, DVM', 'amanda.ross@sunset.vet', 'doctor', 'active', 'VET-FM-33092', 'Feline Medicine & Geriatric Pet Wellness')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 204,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

-- Hospital 207: Pacific Paws Exotic & Avian Care
INSERT INTO users (clinic_id, name, email, role, status, license_number, specialty)
VALUES 
  (207, 'Dr. Liam Vance, DVM', 'liam.vance@pacificpaws.vet', 'doctor', 'active', 'VET-EX-10982', 'Avian, Reptile & Exotic Small Mammal Specialist')
ON CONFLICT (email) DO UPDATE SET 
  clinic_id = 207,
  name = EXCLUDED.name,
  license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty,
  role = 'doctor',
  status = 'active';

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));

-- 4. User Credentials ('Password123!') for all seeded doctors
INSERT INTO user_credentials (user_id, password_hash)
SELECT u.id, '$2b$10$LBjaCPX632OCeau.NZS6l.Jib1jXbCKZnh4jfXm0gpb1ANAHOPpQK'
FROM users u
LEFT JOIN user_credentials uc ON uc.user_id = u.id
WHERE uc.user_id IS NULL AND u.email IN (
  'mouni@gmail.com', 'emily.chen@petcare.vet', 'rajesh.kumar@centralvalleyvet.com',
  'gregory.house@starlight.vet', 'sarah.connor@starlight.vet',
  'michael.chang@sunset.vet', 'amanda.ross@sunset.vet', 'liam.vance@pacificpaws.vet'
);

-- 5. Availability Schedules: Mon (1) through Sat (6), 09:00 to 18:00
DELETE FROM doctor_availability WHERE doctor_id IN (
  SELECT id FROM users WHERE email IN (
    'mouni@gmail.com', 'emily.chen@petcare.vet', 'rajesh.kumar@centralvalleyvet.com',
    'gregory.house@starlight.vet', 'sarah.connor@starlight.vet',
    'michael.chang@sunset.vet', 'amanda.ross@sunset.vet', 'liam.vance@pacificpaws.vet'
  )
);

INSERT INTO doctor_availability (clinic_id, doctor_id, weekday, start_time, end_time, slot_minutes, is_active)
SELECT 
  u.clinic_id,
  u.id,
  day_num,
  '09:00:00'::time,
  '18:00:00'::time,
  15,
  TRUE
FROM users u
CROSS JOIN generate_series(1, 6) AS day_num
WHERE u.email IN (
  'mouni@gmail.com', 'emily.chen@petcare.vet', 'rajesh.kumar@centralvalleyvet.com',
  'gregory.house@starlight.vet', 'sarah.connor@starlight.vet',
  'michael.chang@sunset.vet', 'amanda.ross@sunset.vet', 'liam.vance@pacificpaws.vet'
);
