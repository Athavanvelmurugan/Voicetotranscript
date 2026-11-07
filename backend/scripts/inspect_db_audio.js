const db = require('../src/db/connection');

async function inspectDatabase() {
  console.log('====================================================');
  console.log('🔍 DATABASE INSPECTION: AUDIO & CONSULTATION PERSISTENCE');
  console.log('====================================================\n');

  // 1. Table Row Counts
  const tables = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('📊 Table Record Counts:');
  for (const row of tables.rows) {
    const countRes = await db.query(`SELECT count(*) FROM "${row.table_name}"`);
    console.log(`  - ${row.table_name.padEnd(25)} : ${countRes.rows[0].count} rows`);
  }

  // 2. Consultations table columns related to audio
  console.log('\n🎙️ Columns in "consultations" table:');
  const cols = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'consultations'
    ORDER BY ordinal_position;
  `);
  cols.rows.forEach(c => console.log(`  - ${c.column_name.padEnd(25)} (${c.data_type})`));

  // 3. Latest consultations data
  console.log('\n📋 Recent Consultations in DB:');
  const consults = await db.query(`
    SELECT id, status, language, audio_duration_seconds, audio_file_path, consent_given, created_at 
    FROM consultations 
    ORDER BY id DESC LIMIT 5;
  `);
  console.log(consults.rows);

  // 4. Transcript Segments sample
  console.log('\n📝 Recent Transcript Segments in DB:');
  const segments = await db.query(`
    SELECT id, consultation_id, sequence_number, speaker_role, source, LEFT(text, 60) AS text_preview, created_at 
    FROM transcript_segments 
    ORDER BY id DESC LIMIT 5;
  `);
  console.log(segments.rows);

  // 5. Clinical Extractions sample
  console.log('\n🧠 Recent Clinical Extractions in DB:');
  const extractions = await db.query(`
    SELECT id, consultation_id, status, model_used, created_at 
    FROM clinical_extractions 
    ORDER BY id DESC LIMIT 5;
  `);
  console.log(extractions.rows);

  // 6. Consultation Documents sample
  console.log('\n📄 Recent Consultation Documents in DB:');
  const docs = await db.query(`
    SELECT id, consultation_id, doc_type, status, current_version, created_at 
    FROM consultation_documents 
    ORDER BY id DESC LIMIT 5;
  `);
  console.log(docs.rows);

  await db.pool.end();
}

inspectDatabase().catch(err => {
  console.error(err);
  process.exit(1);
});

