const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const { app } = require('../../src/server');
const db = require('../../src/db/connection');

describe('Phase 3 — Owner Portal, Documents & Notifications Test Suite', () => {
  let server;
  let baseUrl;
  let doctorCookie;
  let doctorId;
  let clinicId;
  let petId;
  let consultationId;
  let documentId;
  let generatedLedgerHash;
  let ownerCookie;
  let ownerToken;
  let ownerId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // 1. Register Clinic & Admin
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register-clinic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: 'Valley Crest Animal Clinic',
        clinicSlug: 'valley-crest-' + Date.now(),
        adminName: 'Dr. Valley Admin',
        email: `admin-valley-${Date.now()}@valley.vet`,
        password: 'Password123!',
        phone: '9555123456',
      }),
    });
    const regData = await regRes.json();
    assert.strictEqual(regRes.status, 201);
    clinicId = regData.data.user.clinicId;
    doctorId = regData.data.user.id;
    doctorCookie = regRes.headers.get('set-cookie');

    // 2. Register Owner and Pet
    const ownerRes = await fetch(`${baseUrl}/api/v1/owners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': doctorCookie,
      },
      body: JSON.stringify({
        name: 'Michael Guardian',
        phone: '555-0192',
        email: `michael-${Date.now()}@guardian.com`,
      }),
    });
    const ownerData = await ownerRes.json();
    assert.strictEqual(ownerRes.status, 201);
    ownerId = ownerData.data.id;
    assert.strictEqual(typeof ownerId, 'number'); // SERIAL PK

    const petRes = await fetch(`${baseUrl}/api/v1/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': doctorCookie,
      },
      body: JSON.stringify({
        name: 'Jasper',
        species: 'Feline',
        breed: 'Siamese',
        ownerId,
        allergies: 'None',
      }),
    });
    const petData = await petRes.json();
    assert.strictEqual(petRes.status, 201);
    petId = petData.data.id;
    assert.strictEqual(typeof petId, 'number'); // SERIAL PK

    // 3. Create consultation & approved prescription document
    const consultRes = await db.query(
      `INSERT INTO consultations (clinic_id, doctor_id, pet_id, status)
       VALUES ($1, $2, $3, 'recording')
       RETURNING id;`,
      [clinicId, doctorId, petId]
    );
    consultationId = consultRes.rows[0].id;

    const docRes = await db.query(
      `INSERT INTO consultation_documents (clinic_id, consultation_id, doc_type, current_version, status, content)
       VALUES ($1, $2, 'prescription', 1, 'approved', $3)
       RETURNING id;`,
      [
        clinicId,
        consultationId,
        JSON.stringify({
          title: 'Prescription Order: Antibiotic Course',
          medications: [
            {
              name: 'Clavamox Drops',
              dosage: '62.5mg/mL',
              frequency: '1mL twice daily',
              duration: '10 days',
              specialInstructions: 'Shake well and keep refrigerated',
            },
          ],
        }),
      ]
    );
    documentId = docRes.rows[0].id;
  });

  after(async () => {
    if (consultationId) {
      await db.query('DELETE FROM generated_files WHERE consultation_id = $1;', [consultationId]);
      await db.query('DELETE FROM share_links WHERE doc_id = $1;', [documentId]);
      await db.query('DELETE FROM consultation_documents WHERE consultation_id = $1;', [consultationId]);
      await db.query('DELETE FROM consultations WHERE id = $1;', [consultationId]);
    }
    await new Promise((resolve) => server.close(resolve));
    await db.pool.end();
  });

  it('1. Generates signed vector PDF with QR verification & RFC 8785 audit ledger hash', async () => {
    const res = await fetch(`${baseUrl}/api/v1/documents/${documentId}/pdf`, {
      method: 'POST',
      headers: { 'Cookie': doctorCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(typeof data.data.fileRecord.id, 'number'); // SERIAL ID (NO UUID)
    assert.strictEqual(data.data.fileRecord.type, 'prescription_pdf');
    assert.match(data.data.sha256, /^[a-f0-9]{64}$/);
    assert.match(data.data.ledgerHash, /^[a-f0-9]{64}$/);

    // Verify PDF file exists on filesystem
    assert.strictEqual(fs.existsSync(data.data.fileRecord.storage_path), true);
    generatedLedgerHash = data.data.ledgerHash;
  });

  it('2. Public QR code endpoint validates cryptographic proof with zero medical PHI leak', async () => {
    const res = await fetch(`${baseUrl}/api/v1/verify/${generatedLedgerHash}`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.verified, true);
    assert.strictEqual(data.patientName, 'Jasper');
    assert.strictEqual(data.patientSpecies, 'Feline');
    assert.match(data.fileSha256, /^[a-f0-9]{64}$/);

    // ZERO MEDICAL PHI LEAK CHECK
    assert.strictEqual(data.medications, undefined);
    assert.strictEqual(data.dosage, undefined);
    assert.strictEqual(data.soapNotes, undefined);
  });

  it('3. Doctor dispatches approved document to owner via EMAIL ONLY', async () => {
    const res = await fetch(`${baseUrl}/api/v1/documents/${documentId}/send-to-owner`, {
      method: 'POST',
      headers: { 'Cookie': doctorCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    // Verify notification record in database: channel = 'email' ONLY, SERIAL PK
    const notifRes = await db.query(
      'SELECT * FROM notifications ORDER BY id DESC LIMIT 1;'
    );
    assert.strictEqual(notifRes.rows.length, 1);
    const notif = notifRes.rows[0];
    assert.strictEqual(typeof notif.id, 'number'); // SERIAL PK (NO UUID)
    assert.strictEqual(notif.channel, 'email');   // Email only!
    assert.strictEqual(notif.status, 'sent');

    // Verify share_links record uses SERIAL PK
    const shareRes = await db.query(
      'SELECT * FROM share_links WHERE doc_id = $1;',
      [documentId]
    );
    assert.strictEqual(shareRes.rows.length > 0, true);
    assert.strictEqual(typeof shareRes.rows[0].id, 'number'); // SERIAL PK
  });

  it('4. Owner Portal: OTP request and verification with staging code 123456', async () => {
    const sendRes = await fetch(`${baseUrl}/api/v1/owner-auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'jasper.owner@example.com', clinicId }),
    });
    const sendData = await sendRes.json();
    assert.strictEqual(sendRes.status, 200);
    assert.strictEqual(sendData.demoCode, '123456');

    // Verify OTP with staging code
    const verifyRes = await fetch(`${baseUrl}/api/v1/owner-auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'jasper.owner@example.com', code: '123456', clinicId }),
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyData.success, true);
    assert.strictEqual(typeof verifyData.data.owner.id, 'number'); // SERIAL PK (NO UUID)
    assert.strictEqual(verifyData.data.owner.role, 'owner');
    ownerCookie = verifyRes.headers.get('set-cookie');
    ownerToken = verifyData.data.token;
  });

  it('5. Owner Portal: Guardian registers pet with SERIAL ID', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner-portal/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Milo',
        species: 'Canine',
        breed: 'Border Collie',
        ageYears: 2,
        weightKg: 18.2,
        gender: 'male_neutered',
        allergies: 'Grain sensitivity',
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.name, 'Milo');
    assert.strictEqual(typeof data.data.id, 'number'); // SERIAL PK (NO UUID)
  });

  it('6. Owner Portal: Guardian submits digital recording consent', async () => {
    // Resolve owner's ID
    const meRes = await fetch(`${baseUrl}/api/v1/owner-portal/me`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
    });
    const meData = await meRes.json();
    const portalOwnerId = meData.data.id;

    // Link patient to this owner
    await db.query(
      `INSERT INTO pet_owners (pet_id, owner_id, is_primary)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (pet_id, owner_id) DO NOTHING;`,
      [petId, portalOwnerId]
    );

    const consentRes = await fetch(`${baseUrl}/api/v1/owner-portal/consent/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        consultationId,
        templateId: 1,
        signatureType: 'typed_name',
        signatureData: 'Typed Legal Signature: Jasper Owner',
      }),
    });
    const consentData = await consentRes.json();
    assert.strictEqual(consentRes.status, 200);
    assert.strictEqual(consentData.success, true);
    assert.strictEqual(consentData.data.signed_at !== null, true);
    assert.strictEqual(typeof consentData.data.id, 'number'); // SERIAL PK (NO UUID)
    assert.strictEqual(consentData.data.signed_by_owner_id, portalOwnerId);
  });

  it('7. Owner Portal: Guardian manages email notification preference', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner-portal/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ emailEnabled: true }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.email_enabled, true);
  });
});
