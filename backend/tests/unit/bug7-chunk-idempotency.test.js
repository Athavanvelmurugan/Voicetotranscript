const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const db = require('../../src/db/connection');
const audioController = require('../../src/modules/audio/audio.controller');
const audioStorage = require('../../src/modules/audio/audio.storage');

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
  buffer.fill(0xAA, 44);
  return buffer;
}

test('BUG 7 Regression Test: Chunk Retransmission Idempotency', async (t) => {
  t.after(async () => {
    // Clean up receipts and test segments
    await db.query('DELETE FROM consultation_chunk_receipts WHERE consultation_id = 1');
    await db.query('DELETE FROM transcript_segments WHERE consultation_id = 1 AND source = \'idempotency_test\'');
    await db.pool.end();
  });

  const testWav = createWavBuffer(1.0);
  const tempPath = audioStorage.getTempPath(1, 0);
  fs.writeFileSync(tempPath, testWav);

  // Clean initial state for chunk 0 on consultation 1
  await db.query('DELETE FROM consultation_chunk_receipts WHERE consultation_id = 1 AND chunk_index = 0');
  await db.query('UPDATE consultations SET status = \'recording\' WHERE id = 1');

  await t.test('1. First transmission of chunk 0 processes and records receipt', async () => {
    const req1 = {
      params: { id: 1 },
      body: { chunkIndex: '0', speakerRole: 'doctor', language: 'en' },
      file: { path: tempPath, mimetype: 'audio/wav', originalname: 'chunk_0.wav' },
      headers: { 'x-doctor-id': '1' },
    };

    let res1Status = null;
    let res1Data = null;
    const res1 = {
      status(code) { res1Status = code; return this; },
      json(payload) { res1Data = payload; return this; },
    };

    // Keep temp file for second call
    fs.writeFileSync(tempPath, testWav);
    await audioController.uploadChunk(req1, res1, () => {});

    assert.strictEqual(res1Status, 200);
    assert.strictEqual(res1Data.success, true);
    assert.strictEqual(res1Data.chunkIndex, 0);

    // Count segments created
    const countRes = await db.query(
      'SELECT COUNT(*) as count FROM transcript_segments WHERE consultation_id = 1'
    );
    const countAfterFirst = parseInt(countRes.rows[0].count, 10);

    // Now re-send chunk 0 (simulating network retry)
    fs.writeFileSync(tempPath, testWav);
    let res2Status = null;
    let res2Data = null;
    const res2 = {
      status(code) { res2Status = code; return this; },
      json(payload) { res2Data = payload; return this; },
    };

    await audioController.uploadChunk(req1, res2, () => {});

    assert.strictEqual(res2Status, 200, 'Retransmitted chunk must return 200 OK');
    assert.strictEqual(res2Data.success, true);
    assert.strictEqual(res2Data.chunkIndex, 0);

    // Segment count in DB must NOT double!
    const countRes2 = await db.query(
      'SELECT COUNT(*) as count FROM transcript_segments WHERE consultation_id = 1'
    );
    const countAfterSecond = parseInt(countRes2.rows[0].count, 10);

    assert.strictEqual(
      countAfterSecond,
      countAfterFirst,
      `Segment count must remain identical on retransmission (${countAfterFirst} vs ${countAfterSecond})`
    );
  });
});

