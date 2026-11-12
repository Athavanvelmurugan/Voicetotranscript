const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const audioController = require('../../src/modules/audio/audio.controller');
const db = require('../../src/db/connection');

describe('Unified Audio Upload & Clinical Scribe Pipeline Unit Tests', { timeout: 60000 }, () => {
  after(async () => {
    await db.pool.end();
  });
  const sourceAudioPath = path.resolve(__dirname, '../../../frontend/test-assets/test audio.wav');
  const tempTestAudioPath = path.resolve(__dirname, '../../../frontend/test-assets/test_audio_copy.wav');

  function createMockRes() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
  }

  it('1. should return 400 Bad Request if no audio file is provided', async () => {
    const req = {
      file: null,
      body: {},
      headers: {},
      params: {},
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = (err) => { nextCalled = !!err; };

    await audioController.uploadAndScribe(req, res, next);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.match(res.body?.error, /No audio file received/i);
    assert.strictEqual(nextCalled, false);
  });

  it('2. should ingest test audio.wav and return transcript, summary, prescription, and lab tests in one response', async () => {
    assert.strictEqual(fs.existsSync(sourceAudioPath), true, 'Source test audio.wav must exist');

    // Create a temporary copy so cleanup doesn't delete the permanent test asset
    fs.copyFileSync(sourceAudioPath, tempTestAudioPath);

    const req = {
      file: {
        path: tempTestAudioPath,
        originalname: 'test audio.wav',
        mimetype: 'audio/wav',
        size: fs.statSync(tempTestAudioPath).size,
      },
      body: {
        language: 'en',
        petName: 'Milo',
        petSpecies: 'Canine (Dog)',
        petBreed: 'Golden Retriever',
        ownerName: 'Mark',
        doctorName: 'Dr. Sarah',
      },
      headers: {
        'x-doctor-id': '5',
      },
      params: {},
    };

    const res = createMockRes();
    let nextError = null;
    const next = (err) => { nextError = err; };

    await audioController.uploadAndScribe(req, res, next);

    if (nextError) {
      assert.fail(`uploadAndScribe failed with error: ${nextError.message}`);
    }

    assert.strictEqual(res.statusCode, 200, 'Should respond with 200 OK');
    assert.strictEqual(res.body?.success, true, 'Response body should indicate success');

    const data = res.body?.data;
    assert.ok(data, 'Response data must be populated');

    // ─── A. Verify Transcript ───
    const transcript = data.transcript;
    assert.ok(transcript, 'Transcript object must exist');
    assert.match(transcript.detectedLanguage, /^(en|english)$/i, 'Detected language should be English');
    assert.ok(transcript.fullText.length > 300, 'Transcript text must be comprehensive');
    assert.ok(transcript.segments.length >= 5, 'Transcript should contain parsed segments');

    const fullText = transcript.fullText;
    assert.match(fullText, /milo/i, 'Transcript must identify pet Milo');
    assert.match(fullText, /vomit/i, 'Transcript must capture vomiting symptom');
    assert.match(fullText, /letharg/i, 'Transcript must capture lethargy');
    assert.match(fullText, /sock/i, 'Transcript must capture swallowed sock');
    assert.match(fullText, /(cerenia|serenia|maropitant)/i, 'Transcript must capture Cerenia medication');
    assert.match(fullText, /(x[-‑]ray|radiograph)/i, 'Transcript must capture X-ray imaging');

    // ─── B. Verify Clinical Summary Document ───
    const summaryDoc = data.documents?.summary;
    assert.ok(summaryDoc, 'Summary document must be synthesized');
    assert.strictEqual(summaryDoc.doc_type, 'summary');
    assert.strictEqual(summaryDoc.patient.name, 'Milo');
    assert.strictEqual(summaryDoc.patient.breed, 'Golden Retriever');
    assert.ok(
      (summaryDoc.overview && summaryDoc.overview.length > 50) || 
      (summaryDoc.clinical_narrative && summaryDoc.clinical_narrative.length > 50),
      'Clinical summary narrative must be populated'
    );

    // ─── C. Verify Prescription Document ───
    const prescriptionDoc = data.documents?.prescription;
    assert.ok(prescriptionDoc, 'Prescription document must be synthesized');
    assert.strictEqual(prescriptionDoc.doc_type, 'prescription');
    assert.strictEqual(prescriptionDoc.patient.name, 'Milo');
    assert.ok(prescriptionDoc.items.length >= 1, 'Prescription items must be generated');
    assert.ok(
      prescriptionDoc.items.some(item => /cerenia|serenia|maropitant|fluids/i.test(item.medicine_name)),
      'Prescription must include Cerenia or supportive fluids'
    );

    // ─── D. Verify Lab Tests & Biomarker Document ───
    const labDoc = data.documents?.lab_tests;
    assert.ok(labDoc, 'Lab tests document must be synthesized');
    assert.strictEqual(labDoc.doc_type, 'lab_tests');
    assert.strictEqual(labDoc.patient.name, 'Milo');
    assert.ok(labDoc.tests.length >= 1, 'Lab/imaging tests must be generated');
    assert.ok(
      labDoc.tests.some(t => /x[-‑]ray|radiograph|ultrasound/i.test(t.test_name)),
      'Lab test document must include Abdominal Radiographs/X-Ray or Ultrasound'
    );

    // ─── E. Verify Temp File Cleanup ───
    assert.strictEqual(
      fs.existsSync(tempTestAudioPath),
      false,
      'Temporary audio file must be cleaned up from disk'
    );
  });
});

