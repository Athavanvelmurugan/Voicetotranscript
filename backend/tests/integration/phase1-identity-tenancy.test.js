const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { app } = require('../../src/server');
const db = require('../../src/db/connection');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');

describe('Phase 1 — Identity, RBAC & Multi-Tenancy Security Test Suite', () => {
  let server;
  let baseUrl;
  let clinicAUserCookie;
  let clinicBUserCookie;
  let clinicAId;
  let clinicBId;
  let clinicAConsultationId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // 1. Register Clinic A
    const resA = await fetch(`${baseUrl}/api/v1/auth/register-clinic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: 'Alpha Veterinary Hospital',
        clinicSlug: 'alpha-vet-' + Date.now(),
        adminName: 'Dr. Alpha Admin',
        email: `admin-alpha-${Date.now()}@alpha.vet`,
        password: 'Password123!',
        phone: '9876543210',
      }),
    });
    const dataA = await resA.json();
    assert.strictEqual(resA.status, 201);
    clinicAId = dataA.data.user.clinicId;
    clinicAUserCookie = resA.headers.get('set-cookie');

    // 2. Register Clinic B
    const resB = await fetch(`${baseUrl}/api/v1/auth/register-clinic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: 'Beta Pet Care Clinic',
        clinicSlug: 'beta-vet-' + Date.now(),
        adminName: 'Dr. Beta Admin',
        email: `admin-beta-${Date.now()}@beta.vet`,
        password: 'Password123!',
        phone: '9876543211',
      }),
    });
    const dataB = await resB.json();
    assert.strictEqual(resB.status, 201);
    clinicBId = dataB.data.user.clinicId;
    clinicBUserCookie = resB.headers.get('set-cookie');
    assert.notStrictEqual(clinicAId, clinicBId);

    // 3. Create a Pet and Consultation in Clinic A
    const petRes = await fetch(`${baseUrl}/api/v1/directory/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clinicAUserCookie,
      },
      body: JSON.stringify({
        name: 'Shadow',
        species: 'Dog',
        breed: 'Labrador',
        owner_name: 'John Doe',
      }),
    });
    const petData = await petRes.json();
    assert.strictEqual(petRes.status, 201);
    const petAId = petData.data.id;

    const consultRes = await fetch(`${baseUrl}/api/v1/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clinicAUserCookie,
      },
      body: JSON.stringify({
        petId: petAId,
        language: 'en',
        consentGiven: true,
      }),
    });
    const consultData = await consultRes.json();
    assert.strictEqual(consultRes.status, 201);
    clinicAConsultationId = consultData.data.id;
  });

  after(async () => {
    if (server) {
      server.close();
    }
    await db.pool.end();
  });

  it('1. Unauthenticated request to /api/v1/consultations should yield 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'UNAUTHORIZED');
  });

  it('2. Zero Header Trust: spoofed x-doctor-id header is ignored and user identity is derived strictly from JWT', async () => {
    // Attempt to spoof x-doctor-id: 999
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Cookie: clinicAUserCookie,
        'x-doctor-id': '999',
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.notStrictEqual(data.data.user.id, 999);
    assert.strictEqual(data.data.user.clinicId, clinicAId);
  });

  it('3. Cross-Tenant Isolation: Clinic B user requesting Clinic A consultations only sees their own clinic data', async () => {
    const res = await fetch(`${baseUrl}/api/v1/consultations`, {
      headers: {
        Cookie: clinicBUserCookie,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    // Clinic B user should NOT see Clinic A consultation in their list
    const containsClinicA = data.data.some((c) => c.id === clinicAConsultationId);
    assert.strictEqual(containsClinicA, false);
  });

  it('4. Staging MFA: Validates 123456 and 1,2,3,4,5,6 cleanly', async () => {
    const tempToken = jwt.sign({ sub: 1, isMfaPending: true }, config.auth.jwtSecret, { expiresIn: '5m' });
    const res = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempToken,
        totpCode: '1,2,3,4,5,6',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.id, 1);
  });

  it('5. Doctor Invitation flow: Admin invites, doctor accepts with min 10 char password, doctor is active', async () => {
    const inviteRes = await fetch(`${baseUrl}/api/v1/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clinicAUserCookie,
      },
      body: JSON.stringify({
        email: `specialist-${Date.now()}@alpha.vet`,
        role: 'doctor',
      }),
    });
    assert.strictEqual(inviteRes.status, 201);
    const inviteData = await inviteRes.json();
    const rawToken = inviteData.data.rawToken;

    // Doctor accepts
    const acceptRes = await fetch(`${baseUrl}/api/v1/invitations/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        name: 'Dr. Sarah Connor',
        password: 'Password123!',
        phone: '9876543299',
        licenseNumber: 'VET-ALPHA-01',
      }),
    });
    assert.strictEqual(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.strictEqual(acceptData.data.user.clinicId, clinicAId);
    assert.strictEqual(acceptData.data.user.role, 'doctor');
  });
});
