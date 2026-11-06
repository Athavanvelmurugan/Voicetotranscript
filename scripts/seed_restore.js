const db = require('../backend/src/db/connection');

async function main() {
  await db.query(`
    INSERT INTO users (id, name, email, role)
    VALUES (1, 'Dr. Alex Morgan, DVM', 'dr.alex.default@petcare.vet', 'veterinarian')
    ON CONFLICT (id) DO UPDATE SET name = 'Dr. Alex Morgan, DVM';
  `);
  console.log('✅ User 1 successfully verified/restored.');

  await db.query(`
    INSERT INTO appointments (id, pet_id, doctor_id, scheduled_at, status, reason)
    VALUES (1, 1, 1, NOW(), 'in-progress', 'Checkup')
    ON CONFLICT (id) DO UPDATE SET pet_id = 1, doctor_id = 1;
  `);
  console.log('✅ Appointment 1 successfully verified/restored.');

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

