const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../src/db/connection');

describe('Database Clear Verification Unit Test', () => {
  after(async () => {
    await db.pool.end();
  });
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

  it('should verify all 12 tables in PostgreSQL database contain exactly 0 rows', async () => {
    for (const table of tables) {
      const res = await db.query(`SELECT COUNT(*) FROM ${table}`);
      const count = parseInt(res.rows[0].count, 10);
      assert.strictEqual(count, 0, `Table ${table} must have 0 rows, found ${count}`);
    }
  });
});
