const test = require('node:test');
const assert = require('node:assert/strict');
const whisperClient = require('../../src/modules/transcription/whisper.client');
const transcriptAccumulator = require('../../src/modules/transcription/transcript.accumulator');
const db = require('../../src/db/connection');

test('Part B.4 Segment Metadata & Low-Confidence Vet Review Flags', async (t) => {
  let testConsultId;

  t.before(async () => {
    const res = await db.query(
      `INSERT INTO consultations (doctor_id, pet_id, status, language, consent_given)
       VALUES (1, 1, 'recording', 'en', true)
       RETURNING id`
    );
    testConsultId = res.rows[0].id;
  });

  t.after(async () => {
    if (testConsultId) {
      await db.query('DELETE FROM consultations WHERE id = $1', [testConsultId]).catch(() => {});
    }
    await db.pool.end();
  });

  await t.test('1. Low confidence (avg_logprob < -1.0) with drug/dose token flags needs_vet_review: true', () => {
    const mockVerboseJson = {
      text: 'Give Doxycycline 100 mg twice daily.',
      language: 'en',
      segments: [
        {
          id: 0,
          text: 'Give Doxycycline 100 mg twice daily.',
          start: 0.0,
          end: 2.5,
          avg_logprob: -1.25, // < -1.0 low confidence
          no_speech_prob: 0.02,
        },
      ],
    };

    const parsed = whisperClient._parseWhisperResponse(mockVerboseJson, 'doctor', 0, 0);
    assert.strictEqual(parsed.status, 'success');
    const seg = parsed.segments[0];
    assert.strictEqual(seg.avg_logprob, -1.25);
    assert.strictEqual(seg.low_confidence, true, 'Must flag low_confidence: true for avg_logprob < -1.0');
    assert.strictEqual(seg.needs_vet_review, true, 'Drug/dose token in low confidence segment must flag needs_vet_review: true');
  });

  await t.test('2. Low confidence conversational text without drug tokens does NOT flag needs_vet_review', () => {
    const mockVerboseJson = {
      text: 'She is sleeping on the couch.',
      language: 'en',
      segments: [
        {
          id: 0,
          text: 'She is sleeping on the couch.',
          start: 0.0,
          end: 2.0,
          avg_logprob: -1.15, // < -1.0 low confidence
          no_speech_prob: 0.05,
        },
      ],
    };

    const parsed = whisperClient._parseWhisperResponse(mockVerboseJson, 'owner', 0, 0);
    assert.strictEqual(parsed.status, 'success');
    const seg = parsed.segments[0];
    assert.strictEqual(seg.low_confidence, true);
    assert.strictEqual(seg.needs_vet_review, false, 'Conversational text without drugs/units must NOT flag needs_vet_review');
  });

  await t.test('3. High confidence with drug tokens does NOT flag needs_vet_review', () => {
    const mockVerboseJson = {
      text: 'Administer Metronidazole 250 mg tablet.',
      language: 'en',
      segments: [
        {
          id: 0,
          text: 'Administer Metronidazole 250 mg tablet.',
          start: 0.0,
          end: 3.0,
          avg_logprob: -0.22, // High confidence
          no_speech_prob: 0.01,
        },
      ],
    };

    const parsed = whisperClient._parseWhisperResponse(mockVerboseJson, 'doctor', 0, 0);
    assert.strictEqual(parsed.status, 'success');
    const seg = parsed.segments[0];
    assert.strictEqual(seg.low_confidence, false);
    assert.strictEqual(seg.needs_vet_review, false, 'High confidence drug mention does NOT require review flag');
  });

  await t.test('4. Full metadata is persisted into transcript_segments table', async () => {
    const saved = await transcriptAccumulator.addSegment({
      consultationId: testConsultId,
      sequenceNumber: 1,
      text: 'Low confidence drug mention: Amoxicillin 250 mg',
      speakerRole: 'doctor',
      languageDetected: 'en',
      confidence: 0.75,
      startMs: 1000,
      endMs: 3500,
      source: 'whisper-1',
      passNumber: 1,
      isFinalPass: true,
      model: 'whisper-large-v3',
      provider: 'groq',
      promptVersion: 'v1_vet_clinical',
      params: { temperature: 0.0 },
      avgLogprob: -1.35,
      noSpeechProb: 0.05,
      needsVetReview: true,
    });

    assert.ok(saved.id);

    // Verify row in database
    const dbRowRes = await db.query(
      `SELECT model, provider, prompt_version, params, avg_logprob, no_speech_prob, needs_vet_review
       FROM transcript_segments WHERE id = $1`,
      [saved.id]
    );

    const row = dbRowRes.rows[0];
    assert.strictEqual(row.model, 'whisper-large-v3');
    assert.strictEqual(row.provider, 'groq');
    assert.strictEqual(row.prompt_version, 'v1_vet_clinical');
    assert.deepStrictEqual(row.params, { temperature: 0.0 });
    assert.strictEqual(parseFloat(row.avg_logprob), -1.35);
    assert.strictEqual(parseFloat(row.no_speech_prob), 0.05);
    assert.strictEqual(row.needs_vet_review, true);
  });
});

