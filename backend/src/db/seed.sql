-- Sample Initial Seed Data for PetCare Live Consultation

INSERT INTO users (name, email, role)
VALUES 
  ('Dr. Alex Morgan, DVM', 'alex.morgan@petcare.vet', 'veterinarian'),
  ('Dr. Emily Chen, DVM', 'emily.chen@petcare.vet', 'veterinarian')
ON CONFLICT (email) DO NOTHING;

INSERT INTO pets (id, name, species, breed, age_years, weight_kg, owner_name, owner_contact)
VALUES 
  (1, 'Bella', 'Canine (Dog)', 'Golden Retriever', 4.5, 28.5, 'Sarah Jenkins', '+1-555-0192'),
  (2, 'Luna', 'Feline (Cat)', 'Siamese', 3.0, 4.2, 'Michael Brown', '+1-555-0144')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, pet_id, doctor_id, scheduled_at, status, reason)
VALUES 
  (1, 1, (SELECT id FROM users ORDER BY id ASC LIMIT 1), NOW(), 'in-progress', 'Persistent lethargy, coughing, and reduced appetite for 3 days')
ON CONFLICT (id) DO NOTHING;

-- Synchronize sequences so future inserts get next safe integer
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('pets_id_seq', (SELECT COALESCE(MAX(id), 1) FROM pets));
SELECT setval('appointments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM appointments));
