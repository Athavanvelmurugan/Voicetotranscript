const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../../backend/src/db/connection');

const API_BASE = 'http://localhost:5000/api/v1/consultations';
const AUDIO_DIR = path.join(__dirname, 'audio');

async function testStorageAndLive() {
  console.log('========================================================================');
  console.log('🔬 AUDITING LIVE CHUNKING (E1-E5) & AUDIO BYTE STORAGE (A8-A9)');
  console.log('========================================================================\n');

  // Test consultation ID 9998
  const testId = 9998;

  try {
    // Setup clean consultation
    await db.query(`DELETE FROM transcript_segments WHERE consultation_id = $1`, [testId]);
    await db.query(`DELETE FROM consultation_audio WHERE consultation_id = $1`, [testId]);
    await db.query(`DELETE FROM consultations WHERE id = $1`, [testId]);
    await db.query(`
      INSERT INTO consultations (id, doctor_id, pet_id, status, language, consent_given)
      VALUES ($1, 1, 1, 'recording', 'en', true)
      ON CONFLICT (id) DO UPDATE SET status = 'recording', consent_given = true;
    `, [testId]);

    // ─── Test A8 & A9: Upload audio via upload-and-scribe and test byte integrity ─
    console.log('[AUDIT A8 & A9] Testing Audio DB Byte-Identity & Hash Storage...');
    const testWavPath = path.join(AUDIO_DIR, 'doses_units.wav');
    const originalBytes = fs.readFileSync(testWavPath);
    const originalSha256 = crypto.createHash('sha256').update(originalBytes).digest('hex');

    const form = new FormData();
    form.append('audio', new Blob([originalBytes], { type: 'audio/wav' }), 'doses_units.wav');
    form.append('consultationId', String(testId));

    const uploadRes = await fetch(`${API_BASE}/${testId}/upload-and-scribe`, {
      method: 'POST',
      body: form,
    });
    console.log('Upload status:', uploadRes.status);

    // Check DB record for A8: Is SHA-256 hash stored?
    const { rows: audioRows } = await db.query(
      `SELECT * FROM consultation_audio WHERE consultation_id = $1 ORDER BY id DESC LIMIT 1`,
      [testId]
    );

    const audioRow = audioRows[0];
    console.log('Audio DB row columns:', Object.keys(audioRow || {}));
    const hasHashColumn = 'audio_hash' in (audioRow || {}) || 'sha256' in (audioRow || {});
    console.log(`[A8 Evidence] Audio hash column exists in DB: ${hasHashColumn ? 'PASS' : 'FAIL (No hash column)'}`);

    // Check DB retrieval for A9: Is retrieved audio byte-identical?
    const streamRes = await fetch(`${API_BASE}/${testId}/audio`);
    const streamedBuffer = Buffer.from(await streamRes.arrayBuffer());
    const streamedSha256 = crypto.createHash('sha256').update(streamedBuffer).digest('hex');

    const byteIdentical = (originalSha256 === streamedSha256) && (originalBytes.length === streamedBuffer.length);
    console.log(`[A9 Evidence] Original SHA-256: ${originalSha256}`);
    console.log(`[A9 Evidence] Streamed SHA-256: ${streamedSha256}`);
    console.log(`[A9 Evidence] Byte identical: ${byteIdentical ? 'PASS' : 'FAIL'}`);

    // ─── Test E: Live Chunking Path ──────────────────────────────────────────
    console.log('\n[AUDIT E1-E5] Testing Live Chunking Endpoint (POST /:id/audio-chunk)...');

    // Reset status to recording
    await db.query(`UPDATE consultations SET status = 'recording' WHERE id = $1`, [testId]);

    // Send chunk 0
    const chunkForm0 = new FormData();
    chunkForm0.append('audio', new Blob([originalBytes], { type: 'audio/wav' }), 'chunk_0.wav');
    chunkForm0.append('chunkIndex', '0');
    chunkForm0.append('speakerRole', 'doctor');

    const chunk0Res = await fetch(`${API_BASE}/${testId}/audio-chunk`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
      body: chunkForm0,
    });

    const chunk0Data = await chunk0Res.json();
    console.log('Chunk 0 upload status:', chunk0Res.status, 'success:', chunk0Data.success);
    console.log('Chunk 0 segments created:', chunk0Data.data?.segmentsCreated);

    // E3: Send duplicate chunk 0 (Simulate duplicate / retransmitted chunk)
    console.log('\n[E3 Evidence] Testing Duplicate Chunk Retransmission (chunkIndex 0 again)...');
    const chunk0DupRes = await fetch(`${API_BASE}/${testId}/audio-chunk`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
      body: chunkForm0,
    });
    const chunk0DupData = await chunk0DupRes.json();
    console.log('Duplicate Chunk 0 status:', chunk0DupRes.status, 'success:', chunk0DupData.success);
    if (!chunk0DupData.success) {
      console.log('Duplicate Chunk 0 Error (as expected or crash):', chunk0DupData.error);
    } else {
      console.log('Duplicate Chunk 0 was accepted! Segments created:', chunk0DupData.data?.segmentsCreated);
    }

    // Check segments in DB
    const { rows: segRows } = await db.query(
      `SELECT sequence_number, text FROM transcript_segments WHERE consultation_id = $1 ORDER BY sequence_number`,
      [testId]
    );
    console.log('Total segments in DB after duplicate chunk:', segRows.length);
    for (const s of segRows) {
      console.log(`  Seq #${s.sequence_number}: "${s.text}"`);
    }

    // E5: Is live transcript replaced by a final pass on audio?
    // Check consultation_audio table for live chunks:
    const { rows: liveAudioRows } = await db.query(
      `SELECT count(*) FROM consultation_audio WHERE consultation_id = $1`,
      [testId]
    );
    console.log('\n[E5 Evidence] Audio stored in consultation_audio during live chunks:');
    console.log('Total audio rows:', liveAudioRows[0].count, '(Only 1 from previous upload-and-scribe)');

    // Cleanup test ID
    await db.query(`DELETE FROM transcript_segments WHERE consultation_id = $1`, [testId]);
    await db.query(`DELETE FROM consultation_audio WHERE consultation_id = $1`, [testId]);
    await db.query(`DELETE FROM consultations WHERE id = $1`, [testId]);

  } catch (err) {
    console.error('Storage & Live audit error:', err);
  } finally {
    process.exit(0);
  }
}

testStorageAndLive();
