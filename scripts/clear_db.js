const db = require('../backend/src/db/connection');

const tables = [
  'consultation_audit_logs',
  'audio_retention_policies',
  'recording_consents',
  'document_approvals',
  'document_versions',
  'consultation_documents',
  'clinical_extractions',
  'transcript_segments',
  'consultations',
  'appointments',
  'pets',
  'users'
];

async function clearDatabase() {
  console.log('[DB Clear] Starting full database wipe across all 12 tables...');
  try {
    const truncateQuery = `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`;
    await db.query(truncateQuery);
    console.log('[DB Clear] ✅ TRUNCATE ... RESTART IDENTITY CASCADE executed successfully.');

    console.log('[DB Clear] Verifying table row counts:');
    let totalRows = 0;
    for (const t of tables) {
      const res = await db.query(`SELECT COUNT(*) FROM ${t}`);
      const count = parseInt(res.rows[0].count, 10);
      totalRows += count;
      console.log(` - ${t}: ${count} rows`);
    }

    if (totalRows === 0) {
      console.log('[DB Clear] ✅ Complete success: All 12 tables are completely cleared (0 rows).');
    } else {
      console.warn(`[DB Clear] ⚠️ Warning: Found ${totalRows} residual rows across tables.`);
    }
  } catch (err) {
    console.error('[DB Clear] ❌ Error clearing database:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  clearDatabase();
}

module.exports = { clearDatabase, tables };

