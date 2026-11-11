const db = require('../backend/src/db/connection');

async function run() {
  await db.query(`
    UPDATE users 
    SET name = 'Dr. Alex Morgan, DVM', license_number = 'DVM-77291', status = 'active'
    WHERE id = 3;
  `);
  console.log('User 3 updated to Dr. Alex Morgan, DVM');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
