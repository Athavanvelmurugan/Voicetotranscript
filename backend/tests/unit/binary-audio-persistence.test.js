const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const db = require('../../src/db/connection');
const whisperClient = require('../../src/modules/transcription/whisper.client');
const consultationRepo = require('../../src/modules/consultations/consultation.repository');

describe('Binary Audio PostgreSQL Persistence (BYTEA) Unit Tests', () => {
  let testConsultationId;
  const dummyAudioBuffer = Buffer.from('RIFF....WAVEfmt ....data....test audio content for bytea', 'utf-8');

  before(async () => {
    // 1. Ensure a consultation exists in PostgreSQL
    const consultations = await consultationRepo.findAll();
    if (consultations && consultations.length > 0) {
      testConsultationId = consultations[0].id;
    } else {
      const created = await consultationRepo.create({
        petId: 1,
        doctorId: 1,
        language: 'en',
        consentGiven: true,
      });
      testConsultationId = created.id;
    }
  });

  after(async () => {
    // Clean up test consultation audio row
    if (testConsultationId) {
      await db.query('DELETE FROM consultation_audio WHERE consultation_id = $1', [testConsultationId]);
    }
    await db.pool.end();
  });

  it('1. should insert and retrieve raw audio binary (BYTEA) directly in PostgreSQL without disk files', async () => {
    const fileName = 'test_in_memory.wav';
    const mimeType = 'audio/wav';

    // Insert BYTEA
    const insertRes = await db.query(`
      INSERT INTO consultation_audio (consultation_id, clinic_id, audio_data, mime_type, file_name, file_size_bytes)
      VALUES ($1, 1, $2, $3, $4, $5)
      RETURNING id, consultation_id, mime_type, file_name, file_size_bytes, created_at
    `, [testConsultationId, dummyAudioBuffer, mimeType, fileName, dummyAudioBuffer.length]);

    assert.ok(insertRes.rows.length === 1, 'Audio record should be inserted');
    const insertedId = insertRes.rows[0].id;
    assert.strictEqual(Number(insertRes.rows[0].file_size_bytes), dummyAudioBuffer.length);

    // Retrieve BYTEA
    const fetchRes = await db.query(
      'SELECT id, audio_data, mime_type, file_name, file_size_bytes FROM consultation_audio WHERE id = $1',
      [insertedId]
    );

    assert.ok(fetchRes.rows.length === 1, 'Audio record should be retrieved');
    const fetchedRecord = fetchRes.rows[0];
    assert.ok(Buffer.isBuffer(fetchedRecord.audio_data), 'Retrieved audio_data must be a Node.js Buffer');
    assert.strictEqual(fetchedRecord.audio_data.length, dummyAudioBuffer.length);
    assert.strictEqual(fetchedRecord.audio_data.toString('utf-8'), dummyAudioBuffer.toString('utf-8'));
    assert.strictEqual(fetchedRecord.mime_type, 'audio/wav');
  });

  it('2. should support in-memory Buffer directly in whisperClient.transcribe without reading from disk', async () => {
    // Load real WAV audio directly into an in-memory Buffer (no filePath passed to whisperClient)
    const wavPath = path.resolve(__dirname, '../../../frontend/test-assets/test audio.wav');
    const inMemoryWav = fs.readFileSync(wavPath);

    // Stub live transport locally so test verifies in-memory Buffer handling deterministically
    const origClient = whisperClient.client;
    whisperClient.client = {
      audio: {
        transcriptions: {
          create: async () => ({
            text: 'Patient Milo is doing better after treatment.',
            language: 'en',
            segments: [{ id: 0, text: 'Patient Milo is doing better after treatment.', start: 0, end: 2.0, avg_logprob: -0.2, no_speech_prob: 0.01 }],
          }),
        },
      },
    };
    try {
      const result = await whisperClient.transcribe({
        buffer: inMemoryWav,
        fileName: 'virtual_buffer.wav',
        language: 'en',
        speakerRole: 'doctor',
        chunkIndex: 0,
        baseSequence: 0,
      });

      assert.ok(result, 'Whisper transcription result must be defined');
      assert.ok(typeof result.fullText === 'string' && result.fullText.length > 0, 'fullText must be populated');
      assert.ok(Array.isArray(result.segments) && result.segments.length >= 1, 'segments must be populated');
    } finally {
      whisperClient.client = origClient;
    }
  });
});

