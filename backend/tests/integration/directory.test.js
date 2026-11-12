const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../../src/server');
const db = require('../../src/db/connection');
const authService = require('../../src/modules/auth/auth.service');
const { loadUserContext } = require('../../src/modules/auth/userContext.helper');

describe('Doctor & PetCare Directory Management API', () => {
  const testPort = 5056;
  let baseUrl;
  let createdDoctorId = null;
  let createdPetId = null;
  let authToken;

  before(async () => {
    const ctx = await loadUserContext(1);
    authToken = authService.generateTokens(ctx).accessToken;
    await new Promise((resolve) => server.listen(testPort, resolve));
    baseUrl = `http://localhost:${testPort}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.pool.end();
  });

  // ─── DOCTORS ────────────────────────────────────────────────────────────────
  it('1. GET /api/v1/directory/doctors should list seeded doctors', async () => {
    const res = await fetch(`${baseUrl}/api/v1/directory/doctors`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1);
  });

  it('2. POST /api/v1/directory/doctors should dynamically add a new doctor', async () => {
    const uniqueEmail = `test.vet.${Date.now()}@petcare.vet`;
    const res = await fetch(`${baseUrl}/api/v1/directory/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        name: 'Dr. Gregory House, DVM',
        email: uniqueEmail,
        role: 'veterinarian',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Dr. Gregory House, DVM');
    assert.equal(json.data.email, uniqueEmail);
    assert.ok(json.data.id);
    createdDoctorId = json.data.id;
  });

  it('3. POST /api/v1/directory/doctors should reject duplicate email', async () => {
    const res = await fetch(`${baseUrl}/api/v1/directory/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        name: 'Duplicate Doctor',
        email: 'alex.morgan@petcare.vet',
        role: 'veterinarian',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 409);
    assert.equal(json.success, false);
  });

  it('4. DELETE /api/v1/directory/doctors/:id should delete doctor without consultations', async () => {
    assert.ok(createdDoctorId);
    const res = await fetch(`${baseUrl}/api/v1/directory/doctors/${createdDoctorId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.id, createdDoctorId);
  });

  it('5. DELETE /api/v1/directory/doctors/:id should prevent deleting doctor with active consultations', async () => {
    // Doctor #1 has seeded appointments / consultations
    const res = await fetch(`${baseUrl}/api/v1/directory/doctors/1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.match(json.error, /assigned consultation/i);
  });

  // ─── PETS ───────────────────────────────────────────────────────────────────
  it('6. GET /api/v1/directory/pets should list seeded pets', async () => {
    const res = await fetch(`${baseUrl}/api/v1/directory/pets`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1);
  });

  it('7. POST /api/v1/directory/pets should dynamically add a new pet', async () => {
    const res = await fetch(`${baseUrl}/api/v1/directory/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        name: 'Milo',
        species: 'Canine (Dog)',
        breed: 'Beagle',
        age_years: 2.5,
        weight_kg: 10.2,
        owner_name: 'David Miller',
        owner_contact: '+1-555-0899',
      }),
    });

    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'Milo');
    assert.equal(json.data.owner_name, 'David Miller');
    assert.ok(json.data.id);
    createdPetId = json.data.id;
  });

  it('8. DELETE /api/v1/directory/pets/:id should delete pet', async () => {
    assert.ok(createdPetId);
    const res = await fetch(`${baseUrl}/api/v1/directory/pets/${createdPetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.id, createdPetId);
  });
});
