const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, server } = require('../../src/server');

describe('Consultation REST API & Full Lifecycle Integration', () => {
  let testPort = 5055;
  let baseUrl;
  let consultationId;

  before(async () => {
    await new Promise((resolve) => server.listen(testPort, resolve));
    baseUrl = `http://localhost:${testPort}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('1. POST /api/v1/consultations should create consultation with integer ID', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-doctor-id': '1' },
      body: JSON.stringify({
        petId: 1,
        appointmentId: 1,
        language: 'en',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(typeof json.data.id, 'number'); // Integer ID, NOT UUID!
    assert.equal(json.data.status, 'scheduled');
    assert.equal(json.data.pet_name, 'Bella');
    consultationId = json.data.id;
  });

  it('2. POST /api/v1/consultations/:id/start should fail if consent is not granted', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/start`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
    });

    const json = await res.json();
    assert.equal(res.status, 403);
    assert.equal(json.success, false);
    assert.ok(json.error.includes('consent must be granted'));
  });

  it('3. POST /api/v1/consultations/:id/consent should record owner recording consent', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-doctor-id': '1' },
      body: JSON.stringify({ givenBy: 'Sarah Jenkins' }),
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.consultation.consent_given, true);
  });

  it('4. POST /api/v1/consultations/:id/start should succeed after consent is granted', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/start`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.data.status, 'recording');
  });

  it('5. POST /api/v1/consultations/:id/pause and /resume should toggle recording state', async () => {
    const pauseRes = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/pause`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
    });
    const pauseJson = await pauseRes.json();
    assert.equal(pauseJson.data.status, 'paused');

    const resumeRes = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/resume`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
    });
    const resumeJson = await resumeRes.json();
    assert.equal(resumeJson.data.status, 'recording');
  });

  it('6. POST /api/v1/consultations/:id/stop should finish consultation audio capture', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-doctor-id': '1' },
      body: JSON.stringify({ audioDurationSeconds: 420 }),
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.data.status, 'processing');
  });

  it('7. POST /api/v1/consultations/:id/generate should create all 5 clinical documents', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/generate`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.documents.length, 5);

    const docTypes = json.data.documents.map(d => d.doc_type);
    assert.ok(docTypes.includes('prescription'));
    assert.ok(docTypes.includes('lab_tests'));
    assert.ok(docTypes.includes('soap_notes'));
    assert.ok(docTypes.includes('follow_up'));
    assert.ok(docTypes.includes('summary'));
  });

  it('8. GET /api/v1/consultations/:id/audit should return immutable audit logs with before/after state', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/audit`, {
      headers: { 'x-doctor-id': '1' },
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 5); // creation, consent, start, pause, resume, stop, docs
    assert.ok(json.data.some(log => log.action === 'recording_consent_granted'));
    assert.ok(json.data.some(log => log.action === 'recording_started'));
  });

  it('9. POST /api/v1/consultations/:id/complete should formally complete consultation and log audit', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/complete`, {
      method: 'POST',
      headers: { 'x-doctor-id': '1' },
    });

    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'completed');

    const auditRes = await fetch(`${baseUrl}/api/v1/consultations/${consultationId}/audit`, {
      headers: { 'x-doctor-id': '1' },
    });
    const auditJson = await auditRes.json();
    assert.ok(auditJson.data.some(log => log.action === 'consultation_completed'));
  });
});

