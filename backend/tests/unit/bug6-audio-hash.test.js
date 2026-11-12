const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const db = require('../../src/db/connection');
const audioController = require('../../src/modules/audio/audio.controller');

// Helper to create a valid minimal WAV buffer
function createWavBuffer(durationSeconds = 1.0, sampleRate = 16000) {
  const byteRate = sampleRate * 2;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // Fill sample data
  buffer.fill(0x55, 44);
  return buffer;
}

test('BUG 6 Regression Test: Cryptographic Audio Hash & Byte-Identity Verification', async (t) => {
  const cRes = await db.query(
    `INSERT INTO consultations (clinic_id, doctor_id, pet_id, status, language, consent_given)
     VALUES (1, 1, 1, 'recording', 'en', true)
     RETURNING id`
  );
  const consultId = cRes.rows[0].id;

  t.after(async () => {
    await db.query('DELETE FROM consultation_audio WHERE consultation_id = $1', [consultId]).catch(() => {});
    await db.query('DELETE FROM consultations WHERE id = $1', [consultId]).catch(() => {});
    await db.pool.end();
  });

  const testAudio = createWavBuffer(1.0);
  const expectedHash = crypto.createHash('sha256').update(testAudio).digest('hex');

  // Insert consultation audio directly with expected hash
  const insertRes = await db.query(
    `INSERT INTO consultation_audio (consultation_id, clinic_id, audio_data, mime_type, file_name, file_size_bytes, audio_hash)
     VALUES ($1, 1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [consultId, testAudio, 'audio/wav', 'hash_test.wav', testAudio.length, expectedHash]
  );
  const audioId = insertRes.rows[0].id;

  await t.test('1. Audio stored has audio_hash matching independently computed SHA-256', async () => {
    const row = await db.query('SELECT audio_data, audio_hash FROM consultation_audio WHERE id = $1', [audioId]);
    assert.strictEqual(row.rows.length, 1);
    const storedHash = row.rows[0].audio_hash;
    const computedHash = crypto.createHash('sha256').update(row.rows[0].audio_data).digest('hex');
    assert.strictEqual(storedHash, expectedHash);
    assert.strictEqual(computedHash, expectedHash);
  });

  await t.test('2. GET /audio sets ETag and X-Audio-SHA256 headers matching hash', async () => {
    let headers = {};
    const req = { params: { id: consultId } };
    const res = {
      setHeader(name, value) {
        headers[name] = value;
        return this;
      },
      status(code) { return this; },
      send() { return this; },
    };

    await audioController.getAudioByConsultation(req, res, () => {});
    assert.strictEqual(headers['X-Audio-SHA256'], expectedHash, 'X-Audio-SHA256 header must equal SHA-256 hash');
    assert.strictEqual(headers['ETag'], `"${expectedHash}"`, 'ETag must be quoted SHA-256 hash');
  });

  await t.test('3. Verification endpoint detects byte corruption', async () => {
    // Verify untampered first
    let verifyStatus = null;
    let verifyBody = null;
    const req = { params: { id: consultId } };
    const res = {
      status(code) { verifyStatus = code; return this; },
      json(data) { verifyBody = data; return this; },
    };

    await audioController.verifyAudioHash(req, res, () => {});
    assert.strictEqual(verifyStatus, 200);
    assert.strictEqual(verifyBody.verified, true, 'Original audio must be verified');

    // Corrupt 1 byte in the database
    const corruptedAudio = Buffer.from(testAudio);
    corruptedAudio[45] = corruptedAudio[45] ^ 0xFF; // flip bits

    await db.query('UPDATE consultation_audio SET audio_data = $1 WHERE id = $2', [corruptedAudio, audioId]);

    // Verify again — must detect mismatch
    await audioController.verifyAudioHash(req, res, () => {});
    assert.strictEqual(verifyBody.verified, false, 'Tampered audio must fail verification');
    assert.notStrictEqual(verifyBody.storedHash, verifyBody.computedHash, 'Hashes must not match');

    // Clean up test row
    await db.query('DELETE FROM consultation_audio WHERE id = $1', [audioId]);
  });
});

