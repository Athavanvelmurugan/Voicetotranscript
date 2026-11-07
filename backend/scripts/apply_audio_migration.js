const db = require('../src/db/connection');

async function applyAudioMigration() {
  const query = `
    CREATE TABLE IF NOT EXISTS consultation_audio (
      id SERIAL PRIMARY KEY,
      consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      audio_data BYTEA NOT NULL,
      mime_type VARCHAR(100) NOT NULL DEFAULT 'audio/wav',
      file_name VARCHAR(255) DEFAULT 'audio.wav',
      file_size_bytes BIGINT NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_consultation_audio_consultation_id ON consultation_audio(consultation_id);
  `;
  await db.query(query);
  console.log('✅ consultation_audio table created successfully in PostgreSQL.');
  await db.pool.end();
}

applyAudioMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

