-- Migration 007: Super Admin Seed and Multi-Tenant Segregation
-- Ensures super_admin role and creates default platform operator account

-- 1. Insert default super_admin user if not exists
INSERT INTO users (id, name, email, role, clinic_id, status, email_verified_at, phone_verified_at, created_at)
VALUES (1000, 'PetPulse Platform Operator', 'superadmin@petpulse.com', 'super_admin', NULL, 'active', NOW(), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', clinic_id = NULL;

-- 2. Insert credentials for super_admin ('Password123!')
-- Hash: $2b$10$LBjaCPX632OCeau.NZS6l.Jib1jXbCKZnh4jfXm0gpb1ANAHOPpQK
INSERT INTO user_credentials (user_id, password_hash, password_changed_at)
VALUES (1000, '$2b$10$LBjaCPX632OCeau.NZS6l.Jib1jXbCKZnh4jfXm0gpb1ANAHOPpQK', NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Reset serial sequence above 1000
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users WHERE id < 1000), 1));

