const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../src/db/connection');
const dualPassService = require('../../src/modules/transcription/dual-pass.service');
const whisperClient = require('../../src/modules/transcription/whisper.client');

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
  buffer.fill(0x33, 44);
  return buffer;
}

test('BUG 4 Regression Test: Dual-Pass Final Pass & Superseded Segments', async (t) => {
  t.after(async () => {
    // Clean up test data on consultation 1
    await db.query('DELETE FROM consultation_audio_chunks WHERE consultation_id = 1');
    await db.query('DELETE FROM transcript_segments WHERE consultation_id = 1 AND pass_number = 2');
    await db.pool.end();
  });

  const consultId = 1;

  // Insert 3 mock live chunks into consultation_audio_chunks
  const wavChunk = createWavBuffer(1.0);
  await db.query('DELETE FROM consultation_audio_chunks WHERE consultation_id = $1', [consultId]);
  await db.query(
    'INSERT INTO consultation_audio_chunks (consultation_id, chunk_index, audio_data, mime_type) VALUES ($1, $2, $3, $4)',
    [consultId, 0, wavChunk, 'audio/wav']
  );
  await db.query(
    'INSERT INTO consultation_audio_chunks (consultation_id, chunk_index, audio_data, mime_type) VALUES ($1, $2, $3, $4)',
    [consultId, 1, wavChunk, 'audio/wav']
  );
  await db.query(
    'INSERT INTO consultation_audio_chunks (consultation_id, chunk_index, audio_data, mime_type) VALUES ($1, $2, $3, $4)',
    [consultId, 2, wavChunk, 'audio/wav']
  );

  // Insert mock live Pass 1 segments
  await db.query('DELETE FROM transcript_segments WHERE consultation_id = $1', [consultId]);
  await db.query(
    `INSERT INTO transcript_segments 
      (consultation_id, sequence_number, text, pass_number, is_final_pass)
     VALUES 
      ($1, 1, 'Patient Bella vomiting twice', 1, true),
      ($1, 2, 'Administered Cerenia injection', 1, true)`,
    [consultId]
  );

  await t.test('1. dualPassService.stitchConsultationAudio concatenates chunks into continuous binary with hash', async () => {
    const stitched = await dualPassService.stitchConsultationAudio(consultId);
    assert.ok(stitched.buffer, 'Stitched buffer must be generated');
    assert.ok(stitched.audioHash, 'SHA-256 hash must be computed');
    assert.strictEqual(stitched.audioHash.length, 64, 'Hash must be 64-char hex string');

    // Stitched WAV data size should reflect all 3 PCM payloads
    const wavDataSize = stitched.buffer.readUInt32LE(40);
    const singleChunkDataSize = wavChunk.readUInt32LE(40);
    assert.strictEqual(wavDataSize, singleChunkDataSize * 3, 'WAV data size must equal sum of 3 chunk payloads');
  });

  await t.test('2. dualPassService.runFinalPass supersedes Pass 1 segments and inserts Pass 2 segments', async () => {
    // MOCK WhisperClient.transcribe to return high quality pass 2 text
    const originalTranscribe = whisperClient.transcribe;
    whisperClient.transcribe = async () => {
      return {
        status: 'success',
        detectedLanguage: 'en',
        fullText: 'Patient Bella vomiting twice. Administered Cerenia 10mg subcutaneous injection.',
        segments: [
          {
            text: 'Patient Bella vomiting twice.',
            speakerRole: 'doctor',
            startMs: 0,
            endMs: 2000,
            confidence: 0.99,
          },
          {
            text: 'Administered Cerenia 10mg subcutaneous injection.',
            speakerRole: 'doctor',
            startMs: 2000,
            endMs: 4000,
            confidence: 0.99,
          },
        ],
      };
    };

    try {
      const result = await dualPassService.runFinalPass(consultId, 1);
      assert.ok(result, 'Final pass must complete successfully');
      assert.strictEqual(result.passNumber, 2);
      assert.strictEqual(result.segments.length, 2);

      // Verify Pass 1 segments are marked superseded
      const pass1 = await db.query(
        'SELECT is_final_pass, replaced_by_pass FROM transcript_segments WHERE consultation_id = $1 AND pass_number = 1',
        [consultId]
      );
      assert.strictEqual(pass1.rows.length, 2);
      assert.ok(pass1.rows.every(r => r.is_final_pass === false), 'Pass 1 segments must have is_final_pass = false');
      assert.ok(pass1.rows.every(r => r.replaced_by_pass === 2), 'Pass 1 segments must have replaced_by_pass = 2');

      // Verify Pass 2 segments exist with is_final_pass = true
      const pass2 = await db.query(
        'SELECT is_final_pass FROM transcript_segments WHERE consultation_id = $1 AND pass_number = 2',
        [consultId]
      );
      assert.strictEqual(pass2.rows.length, 2);
      assert.ok(pass2.rows.every(r => r.is_final_pass === true), 'Pass 2 segments must have is_final_pass = true');
    } finally {
      whisperClient.transcribe = originalTranscribe;
    }
  });
});

