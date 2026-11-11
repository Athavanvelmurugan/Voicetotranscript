const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { app } = require('../../src/server');
const db = require('../../src/db/connection');

describe('Phase 2 — Clinic Admin, Patient Registry & Scheduling Engine Test Suite', () => {
  let server;
  let baseUrl;
  let adminCookie;
  let clinicId;
  let doctorId;
  let doctorCookie;
  let ownerId;
  let petId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // 1. Register Clinic Admin
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register-clinic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: 'Starlight Animal Hospital',
        clinicSlug: 'starlight-vet-' + Date.now(),
        adminName: 'Admin Director',
        email: `director-${Date.now()}@starlight.vet`,
        password: 'Password123!',
        phone: '9123456780',
      }),
    });
    const regData = await regRes.json();
    assert.strictEqual(regRes.status, 201);
    clinicId = regData.data.user.clinicId;
    adminCookie = regRes.headers.get('set-cookie');

    // 2. Invite a Doctor
    const docEmail = `doctor-${Date.now()}@starlight.vet`;
    const inviteRes = await fetch(`${baseUrl}/api/v1/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        email: docEmail,
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
        name: 'Dr. Gregory House',
        password: 'Password123!',
        phone: '9123456789',
        licenseNumber: 'VET-STAR-99',
      }),
    });
    assert.strictEqual(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    doctorId = acceptData.data.user.id;
    doctorCookie = acceptRes.headers.get('set-cookie');
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.pool.end();
  });

  it('1. Staff Management: Clinic Admin can list staff and approve doctor license', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/staff`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(Array.isArray(listData.data));
    const doctorMember = listData.data.find((m) => m.id === doctorId);
    assert.ok(doctorMember);
    assert.strictEqual(doctorMember.license_number, 'VET-STAR-99');

    // Approve license
    const approveRes = await fetch(`${baseUrl}/api/v1/staff/${doctorId}/approve-license`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.ok(approveData.data.license_verified_at);
    assert.strictEqual(approveData.data.status, 'active');
  });

  it('2. Patient Registry: Register Owner and Pet with allergies and chronic conditions', async () => {
    // Create Owner
    const ownerRes = await fetch(`${baseUrl}/api/v1/owners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Alice Cooper',
        phone: '555-0199',
        email: 'alice@example.com',
        address: '42 Rock Rd, Star City',
      }),
    });
    assert.strictEqual(ownerRes.status, 201);
    const ownerData = await ownerRes.json();
    ownerId = ownerData.data.id;
    assert.strictEqual(ownerData.data.name, 'Alice Cooper');

    // Create Pet linked to Owner with allergies
    const petRes = await fetch(`${baseUrl}/api/v1/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Barnaby',
        species: 'Canine',
        breed: 'Golden Retriever',
        sex: 'Male Neutered',
        age_years: 3.5,
        weight_kg: 28.4,
        microchip_no: '985141002345678',
        allergies: ['Penicillin', 'Chicken Protein'],
        chronic_conditions: ['Hip Dysplasia Grade 1'],
        owner_id: ownerId,
      }),
    });
    assert.strictEqual(petRes.status, 201);
    const petData = await petRes.json();
    petId = petData.data.id;
    assert.strictEqual(petData.data.name, 'Barnaby');
    assert.deepStrictEqual(petData.data.allergies, ['Penicillin', 'Chicken Protein']);
    assert.strictEqual(petData.data.owner_name, 'Alice Cooper');
  });

  it('3. Scheduling Engine: Doctor availability and double-booking conflict prevention (409)', async () => {
    // 1. Set doctor availability for Wednesday (day 3) 09:00 - 13:00
    const availRes = await fetch(`${baseUrl}/api/v1/scheduling/availability/${doctorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        blocks: [
          { weekday: 3, start_time: '09:00:00', end_time: '13:00:00', slot_minutes: 15 },
        ],
      }),
    });
    assert.strictEqual(availRes.status, 200);

    // 2. Schedule Appointment A at 2026-11-18 10:00 UTC (15 mins)
    const aptARes = await fetch(`${baseUrl}/api/v1/scheduling`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        pet_id: petId,
        doctor_id: doctorId,
        scheduled_at: '2026-11-18T10:00:00.000Z',
        duration_min: 15,
        type: 'general_checkup',
        reason: 'Annual vaccination & wellness check',
      }),
    });
    assert.strictEqual(aptARes.status, 201);

    // 3. Attempt to schedule overlapping Appointment B at 2026-11-18 10:10 UTC (overlaps 10:00-10:15)
    const aptBRes = await fetch(`${baseUrl}/api/v1/scheduling`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        pet_id: petId,
        doctor_id: doctorId,
        scheduled_at: '2026-11-18T10:10:00.000Z',
        duration_min: 15,
        type: 'urgent',
        reason: 'Ear infection check',
      }),
    });
    assert.strictEqual(aptBRes.status, 409);
    const errData = await aptBRes.json();
    assert.match(errData.error, /Time slot conflict/);

    // 4. Query available slots on 2026-11-18
    const slotsRes = await fetch(`${baseUrl}/api/v1/scheduling/slots?doctorId=${doctorId}&date=2026-11-18`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(slotsRes.status, 200);
    const slotsData = await slotsRes.json();
    assert.ok(Array.isArray(slotsData.data));
    const bookedSlot = slotsData.data.find((s) => s.startTime.includes('10:00:00'));
    assert.ok(bookedSlot);
    assert.strictEqual(bookedSlot.available, false);
  });

  it('4. Doctor Queue: Doctor can fetch today’s queue with patient safety metadata', async () => {
    // Schedule an appointment for today
    const now = new Date();
    const todayAptTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    const todayAptRes = await fetch(`${baseUrl}/api/v1/scheduling`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        pet_id: petId,
        doctor_id: doctorId,
        scheduled_at: todayAptTime,
        duration_min: 30,
        type: 'dental_exam',
        reason: 'Tartar buildup and gingivitis evaluation',
      }),
    });
    assert.strictEqual(todayAptRes.status, 201);

    // Doctor checks today's queue
    const queueRes = await fetch(`${baseUrl}/api/v1/scheduling/today-queue`, {
      headers: { Cookie: doctorCookie },
    });
    assert.strictEqual(queueRes.status, 200);
    const queueData = await queueRes.json();
    assert.ok(Array.isArray(queueData.data));
    const queueItem = queueData.data.find((q) => q.pet_id === petId);
    assert.ok(queueItem);
    assert.strictEqual(queueItem.pet_name, 'Barnaby');
    assert.deepStrictEqual(queueItem.pet_allergies, ['Penicillin', 'Chicken Protein']);
    assert.deepStrictEqual(queueItem.pet_chronic_conditions, ['Hip Dysplasia Grade 1']);
  });

  it('5. Audit Viewer: Clinic Admin can view operational events and export CSV', async () => {
    const auditRes = await fetch(`${baseUrl}/api/v1/audit-viewer?limit=20`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(auditRes.status, 200);
    const auditData = await auditRes.json();
    assert.ok(Array.isArray(auditData.data));
    assert.ok(auditData.total >= 4);

    const actions = auditData.data.map((e) => e.action);
    assert.ok(actions.includes('patient_created') || actions.includes('appointment_scheduled'));

    // Test CSV export
    const csvRes = await fetch(`${baseUrl}/api/v1/audit-viewer/export`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(csvRes.status, 200);
    assert.match(csvRes.headers.get('content-type'), /text\/csv/);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('Timestamp,Action,Target Type'));
    assert.ok(csvText.includes('patient_created') || csvText.includes('appointment_scheduled'));
  });
});
