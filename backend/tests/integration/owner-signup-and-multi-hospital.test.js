const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:5000';

describe('Pet Guardian Dual Auth & Multi-Hospital Network Tests', async () => {
  const timestamp = Date.now();
  const testEmail = `guardian_${timestamp}@petparent.org`;
  const testPhone = `+1555${timestamp.toString().slice(-6)}`;
  let guardianToken = null;
  let guardianId = null;
  let newPetId = null;
  let selectedDateStr = null;
  let selectedSlot = null;

  // 1. Sign Up New Pet Guardian with First Pet
  test('1. POST /api/v1/owner-auth/signup creates new guardian & registers first pet', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sarah Jenkins',
        email: testEmail,
        phone: testPhone,
        petName: 'Rusty',
        species: 'Dog',
        breed: 'Golden Retriever',
        clinicId: 1,
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.ownerId);
    guardianId = data.ownerId;
    assert.equal(data.demoCode, '123456');
  });

  // 2. Reject Duplicate Signup
  test('2. POST /api/v1/owner-auth/signup rejects duplicate email with 409', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sarah Duplicate',
        email: testEmail,
        phone: '+15550009999',
      }),
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.match(data.error, /already exists/i);
  });

  // 3. Verify OTP and authenticate guardian
  test('3. POST /api/v1/owner-auth/verify-otp completes signup verification and returns JWT', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        code: '123456',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.token);
    assert.equal(data.data.owner.email, testEmail);
    guardianToken = data.data.token;
  });

  // 4. Verify Registered Pet exists in Guardian Profile
  test('4. GET /api/v1/owner-portal/pets returns registered first pet "Rusty"', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/pets`, {
      headers: { Authorization: `Bearer ${guardianToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 1);
    const pet = data.data.find((p) => p.name === 'Rusty');
    assert.ok(pet, 'Expected to find pet named Rusty');
    assert.equal(pet.species, 'Dog');
    assert.equal(pet.breed, 'Golden Retriever');
    newPetId = pet.id;
  });

  // 5. Discover Multi-Hospital Network (At least 4 hospitals)
  test('5. GET /api/v1/owner-portal/hospitals returns network of accredited hospitals with specialties', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/hospitals`, {
      headers: { Authorization: `Bearer ${guardianToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.length >= 4, 'Expected at least 4 hospitals in directory');

    const centralValley = data.data.find((h) => h.id === 1);
    const starlight = data.data.find((h) => h.id === 200);
    const sunset = data.data.find((h) => h.id === 204);
    const pacific = data.data.find((h) => h.id === 207);

    assert.ok(centralValley, 'Expected Central Valley Animal Hospital');
    assert.ok(starlight, 'Expected Starlight 24/7 Emergency Hospital');
    assert.ok(sunset, 'Expected Sunset Animal Specialty');
    assert.ok(pacific, 'Expected Pacific Paws');

    assert.equal(starlight.is_emergency, true, 'Starlight should be marked 24/7 Emergency');
    assert.ok(Number(centralValley.doctor_count) >= 2, 'Central Valley should have at least 2 doctors');
  });

  // 6. Inspect Doctors in Selected Hospital (Multiple doctors with distinct specialties)
  test('6. GET /api/v1/owner-portal/hospitals/1/doctors returns attending veterinarians with specialties', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/hospitals/1/doctors`, {
      headers: { Authorization: `Bearer ${guardianToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.length >= 2, 'Expected multiple doctors in Hospital 1');

    const surgeon = data.data.find((d) => d.name.includes('Emily Chen'));
    assert.ok(surgeon, 'Expected Dr. Emily Chen');
    assert.match(surgeon.specialty, /Surgeon/i);
  });

  // 7. Check Real-Time Slots for Chosen Doctor
  test('7. GET /api/v1/owner-portal/available-slots returns 15-minute booking slots', async () => {
    const targetDay = new Date();
    targetDay.setDate(targetDay.getDate() + 1);
    const dateStr = targetDay.toISOString().split('T')[0];

    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/available-slots?clinicId=1&doctorId=1&date=${dateStr}`, {
      headers: { Authorization: `Bearer ${guardianToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length > 0, 'Expected slots to be generated');
    selectedDateStr = dateStr;
    selectedSlot = data.data.find((s) => s.available);
    assert.ok(selectedSlot, 'Expected at least one available slot');
  });

  // 8. Book Appointment for Pet at Selected Hospital & Doctor
  test('8. POST /api/v1/owner-portal/book-appointment successfully creates appointment', async () => {
    const startTime = selectedSlot.startTime.slice(11, 16);
    const endTime = selectedSlot.endTime.slice(11, 16);

    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/book-appointment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guardianToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clinicId: 1,
        petId: newPetId,
        doctorId: 1,
        appointmentDate: selectedDateStr,
        startTime,
        endTime,
        reason: 'First Wellness Exam & Vaccination',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.id);
  });

  // 9. Verify Hospital Affiliations in Profile
  test('9. GET /api/v1/owner-portal/me returns affiliated_clinics containing booked hospital', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/me`, {
      headers: { Authorization: `Bearer ${guardianToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data.affiliated_clinics));
    const clinic1 = data.data.affiliated_clinics.find((c) => c.id === 1);
    assert.ok(clinic1, 'Expected Hospital 1 in affiliated clinics');
  });
});

