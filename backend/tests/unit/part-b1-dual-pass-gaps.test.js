const test = require('node:test');
const assert = require('node:assert/strict');
const dualPassService = require('../../src/modules/transcription/dual-pass.service');
const consultationService = require('../../src/modules/consultations/consultation.service');
const whisperClient = require('../../src/modules/transcription/whisper.client');
const clinicalExtractor = require('../../src/modules/clinical-ai/clinical.extractor');
const documentService = require('../../src/modules/documents/document.service');
const db = require('../../src/db/connection');

test('Part B.1 Dual Pass Gap Tests', async (t) => {
  let consultId;

  t.before(async () => {
    const res = await db.query(
      `INSERT INTO consultations (doctor_id, pet_id, status, language, consent_given)
       VALUES (1, 1, 'recording', 'en', true)
       RETURNING id`
    );
    consultId = res.rows[0].id;
  });

  t.after(async () => {
    if (consultId) {
      await db.query(`DELETE FROM consultations WHERE id = $1;`, [consultId]).catch(() => {});
    }
    await db.pool.end();
  });

  await t.test('1. ALWAYS re-runs clinical extraction after final pass regardless of diff percent', async () => {
    // Mock stitchConsultationAudio to return audio
    const origStitch = dualPassService.stitchConsultationAudio;
    const origWhisper = whisperClient.transcribe;
    const origExtract = clinicalExtractor.extractAndValidate;
    const origDocGen = documentService.generateAllDocuments;

    let extractionCalled = false;
    let documentsGenerated = false;

    try {
      dualPassService.stitchConsultationAudio = async () => ({
        buffer: Buffer.from('RIFF....WAVEfmt ....data....'),
        mimeType: 'audio/wav',
        audioHash: 'fakehash123',
      });

      whisperClient.transcribe = async () => ({
        status: 'success',
        detectedLanguage: 'en',
        segments: [{ sequenceOffset: 1, text: 'Bella is coughing.', startMs: 0, endMs: 2000, confidence: 0.99 }],
      });

      clinicalExtractor.extractAndValidate = async () => {
        extractionCalled = true;
        return { status: 'completed' };
      };

      documentService.generateAllDocuments = async () => {
        documentsGenerated = true;
      };

      // Ensure diff will be 0% by pre-inserting identical live segment
      await db.query(`
        INSERT INTO transcript_segments (consultation_id, sequence_number, text, pass_number, is_final_pass)
        VALUES ($1, 100, 'Bella is coughing.', 1, true)
        ON CONFLICT (consultation_id, pass_number, sequence_number, is_partial) DO UPDATE SET text = EXCLUDED.text;
      `, [consultId]);

      const result = await dualPassService.runFinalPass(consultId, 1);

      assert.strictEqual(extractionCalled, true, 'Clinical extraction MUST always be re-run on final pass even if diff is 0%');
      assert.strictEqual(documentsGenerated, true, 'Documents MUST always be regenerated on final pass');
      assert.strictEqual(result.documentsUpdated, true);
    } finally {
      dualPassService.stitchConsultationAudio = origStitch;
      whisperClient.transcribe = origWhisper;
      clinicalExtractor.extractAndValidate = origExtract;
      documentService.generateAllDocuments = origDocGen;
    }
  });

  await t.test('2. Final pass failure flags draft_only_unverified and blocks doctor sign-off', async () => {
    const origStitch = dualPassService.stitchConsultationAudio;
    const origWhisper = whisperClient.transcribe;

    try {
      dualPassService.stitchConsultationAudio = async () => ({
        buffer: Buffer.from('RIFF....WAVEfmt ....data....'),
        mimeType: 'audio/wav',
        audioHash: 'fakehash123',
      });

      // Force Whisper failure during final pass
      whisperClient.transcribe = async () => {
        const err = new Error('Whisper final pass upstream 500 error');
        err.status = 502;
        throw err;
      };

      await assert.rejects(
        async () => {
          await dualPassService.runFinalPass(consultId, 1);
        },
        /Whisper final pass upstream/
      );

      // Verify consultation record is flagged draft_only_unverified
      const checkRes = await db.query('SELECT status, draft_only_unverified FROM consultations WHERE id = $1;', [consultId]);
      assert.strictEqual(checkRes.rows[0].status, 'draft_only_unverified', 'Consultation status must be draft_only_unverified');
      assert.strictEqual(checkRes.rows[0].draft_only_unverified, true, 'Consultation draft_only_unverified flag must be true');

      // Verify completeConsultation blocks sign-off
      await assert.rejects(
        async () => {
          await consultationService.completeConsultation(consultId, 1);
        },
        (err) => {
          assert.ok(err.message.includes('draft_only_unverified'), 'Error message must cite draft_only_unverified block');
          assert.strictEqual(err.statusCode, 422, 'Status code must be 422 Unprocessable Entity');
          return true;
        }
      );
    } finally {
      dualPassService.stitchConsultationAudio = origStitch;
      whisperClient.transcribe = origWhisper;
      // Reset status
      await db.query("UPDATE consultations SET status = 'completed', draft_only_unverified = false WHERE id = $1;", [consultId]);
    }
  });

  await t.test('3. Stitched audio exceeding 25MB provider limit splits and merges successfully', async () => {
    const origStitch = dualPassService.stitchConsultationAudio;
    const origWhisper = whisperClient.transcribe;
    const origExtract = clinicalExtractor.extractAndValidate;
    const origDocGen = documentService.generateAllDocuments;

    const subChunkSizes = [];
    const timestampsReceived = [];

    try {
      // Create a 26 MB synthetic PCM WAV buffer
      const sampleRate = 16000;
      const numChannels = 1;
      const dataSize = 26 * 1024 * 1024; // 26 MB data
      const bigWav = Buffer.alloc(44 + dataSize);
      bigWav.write('RIFF', 0);
      bigWav.writeUInt32LE(36 + dataSize, 4);
      bigWav.write('WAVE', 8);
      bigWav.write('fmt ', 12);
      bigWav.writeUInt32LE(16, 16);
      bigWav.writeUInt16LE(1, 20); // PCM
      bigWav.writeUInt16LE(numChannels, 22);
      bigWav.writeUInt32LE(sampleRate, 24);
      bigWav.writeUInt32LE(sampleRate * numChannels * 2, 28);
      bigWav.writeUInt16LE(numChannels * 2, 32);
      bigWav.writeUInt16LE(16, 34);
      bigWav.write('data', 36);
      bigWav.writeUInt32LE(dataSize, 40);

      dualPassService.stitchConsultationAudio = async () => ({
        buffer: bigWav,
        mimeType: 'audio/wav',
        audioHash: 'bigwavhash',
      });

      whisperClient.transcribe = async ({ buffer }) => {
        subChunkSizes.push(buffer.length);
        // Return dummy segment for each subchunk
        return {
          status: 'success',
          detectedLanguage: 'en',
          segments: [
            { sequenceOffset: 1, text: `Chunk text ${subChunkSizes.length}`, startMs: 0, endMs: 5000, confidence: 0.99 },
          ],
        };
      };

      clinicalExtractor.extractAndValidate = async () => ({ status: 'completed' });
      documentService.generateAllDocuments = async () => {};

      const result = await dualPassService.runFinalPass(consultId, 1);

      assert.ok(subChunkSizes.length >= 2, `Expected >25MB audio to be split into at least 2 subchunks, got ${subChunkSizes.length}`);
      for (const sz of subChunkSizes) {
        assert.ok(sz <= 25 * 1024 * 1024, `Each subchunk size (${sz} bytes) must be <= 25MB`);
      }
      assert.strictEqual(result.segments.length, subChunkSizes.length, 'All segments from split subchunks must be merged');
    } finally {
      dualPassService.stitchConsultationAudio = origStitch;
      whisperClient.transcribe = origWhisper;
      clinicalExtractor.extractAndValidate = origExtract;
      documentService.generateAllDocuments = origDocGen;
    }
  });
});

