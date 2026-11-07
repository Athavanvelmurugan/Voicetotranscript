const test = require('node:test');
const assert = require('node:assert/strict');
const whisperClient = require('../../src/modules/transcription/whisper.client');
const clinicalExtractor = require('../../src/modules/clinical-ai/clinical.extractor');
const db = require('../../src/db/connection');

test('BUG 1 Regression Test: Silent Mock Fallback on ASR/LLM Error', async (t) => {
  const originalTranscribeLive = whisperClient._transcribeLive;
  const originalCallGroq = clinicalExtractor.callGroqLLM;

  t.after(async () => {
    await db.pool.end();
  });

  await t.test('1. WhisperClient.transcribe must FAIL LOUDLY on API 500 / network error (no mock fabrication)', async () => {
    // MOCK: force whisperClient._transcribeLive to throw 500 error
    whisperClient._transcribeLive = async () => {
      const err = new Error('Groq Whisper API returned 500 Internal Server Error');
      err.status = 500;
      throw err;
    };

    try {
      // Must throw or reject — must NOT return mock text!
      let result = null;
      let threw = false;
      try {
        result = await whisperClient.transcribe({ buffer: Buffer.from('dummy') });
      } catch (err) {
        threw = true;
      }

      assert.strictEqual(threw, true, 'WhisperClient.transcribe MUST throw on 500 error instead of falling back to mock');
      if (result) {
        const fullText = result.fullText || '';
        assert.ok(!fullText.includes('Bella'), 'Mock Bella phrase must NOT be returned');
        assert.ok(!fullText.includes('auscultation'), 'Mock auscultation phrase must NOT be returned');
        assert.ok(!fullText.includes('Doxycycline'), 'Mock Doxycycline phrase must NOT be returned');
      }
    } finally {
      whisperClient._transcribeLive = originalTranscribeLive;
    }
  });

  await t.test('2. WhisperClient.transcribe must FAIL LOUDLY on API timeout / 504', async () => {
    // MOCK: force whisperClient._transcribeLive to throw timeout error
    whisperClient._transcribeLive = async () => {
      const err = new Error('Connection timed out');
      err.code = 'ETIMEDOUT';
      throw err;
    };

    try {
      let threw = false;
      try {
        await whisperClient.transcribe({ buffer: Buffer.from('dummy') });
      } catch (err) {
        threw = true;
      }

      assert.strictEqual(threw, true, 'WhisperClient.transcribe MUST throw on timeout instead of returning mock text');
    } finally {
      whisperClient._transcribeLive = originalTranscribeLive;
    }
  });

  await t.test('3. ClinicalExtractor must NOT return fabricated medications/symptoms on LLM failure / 429', async () => {
    // MOCK: force Groq LLM to throw 429
    clinicalExtractor.callGroqLLM = async () => {
      const err = new Error('Rate limit reached for model (TPM 429)');
      err.status = 429;
      throw err;
    };

    // Use consultation 1 which exists in DB
    const consultation = { id: 1, pet_name: 'Milo', pet_species: 'Canine' };
    const transcriptText = 'Doctor checking patient. Vomiting twice.';

    try {
      const extraction = await clinicalExtractor.extractAndValidate(consultation, transcriptText);

      // Must NOT contain fabricated Doxycycline or Hycodan or Kennel Cough
      const meds = extraction.medications || [];
      const hasDoxy = meds.some(m => String(m.medicine_name).toLowerCase().includes('doxycycline'));
      const hasHycodan = meds.some(m => String(m.medicine_name).toLowerCase().includes('hycodan'));

      assert.strictEqual(hasDoxy, false, 'ClinicalExtractor must NOT fabricate Doxycycline on LLM failure');
      assert.strictEqual(hasHycodan, false, 'ClinicalExtractor must NOT fabricate Hycodan on LLM failure');
      assert.strictEqual(extraction.status, 'needs_review', 'Extraction status must be needs_review or extraction_unavailable');
    } finally {
      clinicalExtractor.callGroqLLM = originalCallGroq;
    }
  });
});
