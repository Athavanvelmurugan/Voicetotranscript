const test = require('node:test');
const assert = require('node:assert/strict');
const audioController = require('../../src/modules/audio/audio.controller');
const whisperClient = require('../../src/modules/transcription/whisper.client');
const audioStorage = require('../../src/modules/audio/audio.storage');
const db = require('../../src/db/connection');
const fs = require('fs');
const path = require('path');
const os = require('os');

function createDummyWav(durationSec = 1.0) {
  const sampleRate = 16000;
  const numChannels = 1;
  const dataSize = Math.floor(durationSec * sampleRate * 2);
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * 2, 28);
  buf.writeUInt16LE(numChannels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // Add some signal
  for (let i = 0; i < dataSize / 2; i++) {
    buf.writeInt16LE(Math.round(4000 * Math.sin(i / 10)), 44 + i * 2);
  }
  return buf;
}

function createMockReqRes({ consultationId, chunkIndex, filePath }) {
  const req = {
    params: { id: String(consultationId) },
    body: { chunkIndex: String(chunkIndex), speakerRole: 'doctor', language: 'en' },
    headers: { 'x-doctor-id': '1' },
    file: { path: filePath, mimetype: 'audio/wav', size: fs.statSync(filePath).size },
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  return { req, res };
}

test('Part B.2 Chunk Idempotency, Concurrency & Advisory Lock Tests', async (t) => {
  let testConsultId;
  const tempFiles = [];

  t.before(async () => {
    // Create consultation in recording state
    const res = await db.query(
      `INSERT INTO consultations (doctor_id, pet_id, status, language, consent_given)
       VALUES (1, 1, 'recording', 'en', true)
       RETURNING id`
    );
    testConsultId = res.rows[0].id;
  });

  t.after(async () => {
    // Cleanup temp files
    for (const f of tempFiles) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
    // Cleanup DB
    if (testConsultId) {
      await db.query(`DELETE FROM consultations WHERE id = $1;`, [testConsultId]).catch(() => {});
    }
    await db.pool.end();
  });

  // Mock Whisper to be deterministic
  const origTranscribe = whisperClient.transcribe;
  whisperClient.transcribe = async ({ chunkIndex, baseSequence }) => ({
    status: 'success',
    detectedLanguage: 'en',
    segments: [
      {
        sequenceOffset: baseSequence + 1,
        text: `Consultation chunk content for chunk #${chunkIndex}`,
        startMs: 0,
        endMs: 1000,
        confidence: 0.98,
        speakerRole: 'doctor',
      },
    ],
  });

  try {
    await t.test('1. Same chunk uploaded twice returns identical response and creates exactly one segment', async () => {
      const wavBuf = createDummyWav(1.0);
      const filePath1 = path.join(os.tmpdir(), `test_chunk_idem_1_${Date.now()}.wav`);
      const filePath2 = path.join(os.tmpdir(), `test_chunk_idem_2_${Date.now()}.wav`);
      fs.writeFileSync(filePath1, wavBuf);
      fs.writeFileSync(filePath2, wavBuf);
      tempFiles.push(filePath1, filePath2);

      const { req: req1, res: res1 } = createMockReqRes({ consultationId: testConsultId, chunkIndex: 1, filePath: filePath1 });
      await audioController.uploadChunk(req1, res1);

      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res1.body.success, true);
      const firstPayload = res1.body;

      // Second identical request for chunk 1
      const { req: req2, res: res2 } = createMockReqRes({ consultationId: testConsultId, chunkIndex: 1, filePath: filePath2 });
      await audioController.uploadChunk(req2, res2);

      assert.strictEqual(res2.statusCode, 200);
      assert.deepStrictEqual(res2.body, JSON.parse(JSON.stringify(firstPayload)), 'Subsequent upload must return identical cached response');

      // Check DB segment count for chunk 1
      const segs = await db.query(
        `SELECT COUNT(*) FROM transcript_segments WHERE consultation_id = $1 AND text LIKE '%chunk #1%'`,
        [testConsultId]
      );
      assert.strictEqual(parseInt(segs.rows[0].count, 10), 1, 'Exactly one segment must exist in DB for chunk 1');
    });

    await t.test('2. Out of order chunks (order 0, 2, 1) and gap handling', async () => {
      const chunks = [0, 2, 1]; // Out-of-order sequence
      for (const idx of chunks) {
        const wavBuf = createDummyWav(1.0);
        const fPath = path.join(os.tmpdir(), `test_ooo_${idx}_${Date.now()}.wav`);
        fs.writeFileSync(fPath, wavBuf);
        tempFiles.push(fPath);

        const { req, res } = createMockReqRes({ consultationId: testConsultId, chunkIndex: idx, filePath: fPath });
        await audioController.uploadChunk(req, res);
        assert.strictEqual(res.statusCode, 200);
      }

      // Check all 3 chunks are recorded in receipts
      const receipts = await db.query(
        `SELECT chunk_index FROM consultation_chunk_receipts WHERE consultation_id = $1 ORDER BY chunk_index ASC`,
        [testConsultId]
      );
      const indices = receipts.rows.map(r => r.chunk_index);
      assert.ok(indices.includes(0), 'Chunk 0 receipt recorded');
      assert.ok(indices.includes(1), 'Chunk 1 receipt recorded');
      assert.ok(indices.includes(2), 'Chunk 2 receipt recorded');
    });

    await t.test('3. 20 parallel chunk requests serialized safely with advisory lock without duplicates', async () => {
      // Send 20 parallel requests for chunks 10 to 29
      const promises = [];
      for (let i = 10; i < 30; i++) {
        const wavBuf = createDummyWav(0.5);
        const fPath = path.join(os.tmpdir(), `test_parallel_${i}_${Date.now()}.wav`);
        fs.writeFileSync(fPath, wavBuf);
        tempFiles.push(fPath);

        const { req, res } = createMockReqRes({ consultationId: testConsultId, chunkIndex: i, filePath: fPath });
        promises.push(audioController.uploadChunk(req, res).then(() => res));
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        assert.strictEqual(res.statusCode, 200, `Every parallel chunk must succeed with 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        assert.strictEqual(res.body.success, true);
      }

      // Verify all 20 distinct receipts exist
      const countRes = await db.query(
        `SELECT COUNT(*) FROM consultation_chunk_receipts WHERE consultation_id = $1 AND chunk_index >= 10 AND chunk_index < 30`,
        [testConsultId]
      );
      assert.strictEqual(parseInt(countRes.rows[0].count, 10), 20, 'All 20 parallel chunks must have unique receipts without race conditions');
    });
  } finally {
    whisperClient.transcribe = origTranscribe;
  }
});
