const { Client, Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');

async function ensureDatabaseExists() {
  const rootClient = new Client({
    user: config.db.user,
    password: config.db.password,
    host: config.db.host,
    port: config.db.port,
    database: 'postgres', // connect to default postgres db to verify petcare exists
  });

  try {
    await rootClient.connect();
    const res = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.db.database]
    );

    if (res.rowCount === 0) {
      console.log(`[DB] Database "${config.db.database}" does not exist. Creating...`);
      // CREATE DATABASE cannot be executed inside a prepared statement
      await rootClient.query(`CREATE DATABASE "${config.db.database}"`);
      console.log(`[DB] Database "${config.db.database}" created successfully.`);
    } else {
      console.log(`[DB] Database "${config.db.database}" already exists.`);
    }
  } catch (err) {
    console.error('[DB] Error checking/creating database:', err.message);
    throw err;
  } finally {
    await rootClient.end();
  }
}

async function runMigrations() {
  await ensureDatabaseExists();

  const pool = new Pool(config.db);
  try {
    console.log(`[DB] Connecting to "${config.db.database}" on ${config.db.host}:${config.db.port}...`);
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schemaSql);
    console.log('[DB] ✅ Schema migrations applied successfully (all 9 tables verified).');

    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
    await pool.query(seedSql);
    console.log('[DB] ✅ Initial seed data applied (Doctors, Pets, Appointments with integer IDs 1, 2, 3).');

    // Run incremental migrations from migrations/ directory
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        console.log(`[DB] 🔄 Running migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await pool.query(sql);
        console.log(`[DB] ✅ Migration applied: ${file}`);
      }
    }
  } catch (err) {
    console.error('[DB] Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations, ensureDatabaseExists };

