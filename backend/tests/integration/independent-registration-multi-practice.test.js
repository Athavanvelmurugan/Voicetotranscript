const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

function extractCookieHeader(res) {
  const setCookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  return setCookies
    .map((c) => c.split(';')[0])
    .join('; ');
}

describe('Independent Self-Registration, Multi-Practice Onboarding & Tenant Isolation', async () => {
  const ts = Date.now();

  // Actors
  const hospitalEmail = `hosp_${ts}@vetnetwork.org`;
  const hospPass = 'HospitalPass#2026!';
  let hospitalPracticeId = null;
  let hospitalCookie = null;

  const indDocEmail = `ind_doc_${ts}@solo.vet`;
  const indDocPass = 'IndepDoctor#2026!';
  let indDocCookie = null;
  let indPracticeId = null;
  let indPetId = null;

  const affDocEmail = `aff_doc_${ts}@hospital.vet`;
  const affDocPass = 'AffDoctor#2026!';
  let affDocCookie = null;
  let joinReqId = null;

  const ownerEmail = `owner_${ts}@petparent.net`;
  const ownerPass = 'PetOwnerPass#2026!';
  let ownerCookie = null;
  let ownerPet1Id = null;
  let ownerPet2Id = null;

  let superAdminCookie = null;

  test('0. Super Admin signs in', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@petpulse.com', password: 'Password123!' }),
    });
    assert.equal(res.status, 200);
    superAdminCookie = extractCookieHeader(res);
    assert.ok(superAdminCookie.includes('petcare_at='));
  });

  test('1. Hospital self-registers in PENDING_VERIFICATION and does NOT auto-activate', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register/hospital`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospitalName: `Apex Pet Hospital ${ts}`,
        hospitalEmail,
        contactNumber: '+919800112233',
        address: '42 Veterinary Square',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001',
        registrationNumber: `REG-KA-${ts}`,
        adminName: 'Dr. Kavita Rao',
        password: hospPass,
        confirmPassword: hospPass,
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'PENDING_VERIFICATION');
    assert.equal(body.data.verificationRequired, true);
    hospitalPracticeId = body.data.practiceId;
  });

  test('2. Hospital verifies email -> moves to PENDING_APPROVAL and dashboard clinical APIs remain blocked (403)', async () => {
    const verRes = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: hospitalEmail, code: '123456' }),
    });
    assert.equal(verRes.status, 200);
    const verBody = await verRes.json();
    assert.equal(verBody.data.accountStatus, 'PENDING_APPROVAL');
    hospitalCookie = extractCookieHeader(verRes);

    // Must NOT access protected clinic endpoints before Super Admin approval
    const petsRes = await fetch(`${BASE_URL}/api/v1/pets`, {
      headers: { cookie: hospitalCookie },
    });
    assert.equal(petsRes.status, 403);
    const petsBody = await petsRes.json();
    assert.equal(petsBody.code, 'PRACTICE_PENDING_APPROVAL');
  });

  test('3. Super Admin sees pending hospital and approves it -> Hospital Admin gains active workspace access', async () => {
    const listRes = await fetch(`${BASE_URL}/api/v1/admin/hospitals/pending`, {
      headers: { cookie: superAdminCookie },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.data.some((h) => h.practice_id === hospitalPracticeId));

    const appRes = await fetch(`${BASE_URL}/api/v1/admin/hospitals/${hospitalPracticeId}/approve`, {
      method: 'PATCH',
      headers: { cookie: superAdminCookie },
    });
    assert.equal(appRes.status, 200);

    // Re-login hospital admin & confirm clinical API works now
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: hospitalEmail, password: hospPass }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.equal(loginBody.data.user.practiceId, hospitalPracticeId);
    assert.equal(loginBody.data.user.clinicStatus, 'ACTIVE');
    hospitalCookie = extractCookieHeader(loginRes);

    const petsRes = await fetch(`${BASE_URL}/api/v1/pets`, {
      headers: { cookie: hospitalCookie },
    });
    assert.equal(petsRes.status, 200);
  });

  test('4. Independent Doctor self-registers without hospital & verifies -> gets active INDEPENDENT workspace', async () => {
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register/doctor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Dr. Arjun Solo ${ts}`,
        email: indDocEmail,
        mobileNumber: '+919811223344',
        password: indDocPass,
        confirmPassword: indDocPass,
        qualification: 'MVSc Surgery',
        registrationNumber: `VET-SOLO-${ts}`,
        specialization: 'Small Animal Surgery',
        yearsOfExperience: 7,
        practiceMode: 'INDEPENDENT',
        practiceName: `Arjun Solo Pet Care ${ts}`,
      }),
    });
    assert.equal(regRes.status, 201);
    const regBody = await regRes.json();
    assert.equal(regBody.data.practiceMode, 'INDEPENDENT');
    indPracticeId = regBody.data.independentPracticeId;
    assert.ok(indPracticeId);

    const verRes = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: indDocEmail, code: '123456' }),
    });
    assert.equal(verRes.status, 200);
    const verBody = await verRes.json();
    assert.equal(verBody.data.accountStatus, 'ACTIVE');
    assert.equal(verBody.data.user.practiceType, 'INDEPENDENT');
    assert.equal(verBody.data.user.practiceRole, 'OWNER');
    indDocCookie = extractCookieHeader(verRes);
  });

  test('5. Independent Doctor registers pet, schedules appointment & creates consultation in isolated workspace', async () => {
    const petRes = await fetch(`${BASE_URL}/api/v1/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: indDocCookie },
      body: JSON.stringify({
        name: `SoloMilo_${ts}`,
        species: 'Dog',
        breed: 'Beagle',
        owner_name: 'Vikram Mehta',
        owner_phone: '+919900001122',
      }),
    });
    assert.equal(petRes.status, 201);
    const petBody = await petRes.json();
    indPetId = petBody.data.id;
    assert.ok(indPetId);

    const consRes = await fetch(`${BASE_URL}/api/v1/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: indDocCookie },
      body: JSON.stringify({ petId: indPetId, doctorId: petBody.data.doctor_id || undefined }),
    });
    assert.equal(consRes.status, 201);
    const consBody = await consRes.json();
    assert.equal(consBody.data.pet_id, indPetId);

    // Approved Hospital MUST NOT see Independent Doctor's pet
    const hospPetFetch = await fetch(`${BASE_URL}/api/v1/pets/${indPetId}`, {
      headers: { cookie: hospitalCookie },
    });
    assert.equal(hospPetFetch.status, 404);
  });

  test('6. Dual-Mode Doctor: Independent Doctor joins Hospital AND preserves independent records + switches workspaces cleanly', async () => {
    const jrRes = await fetch(`${BASE_URL}/api/v1/practices/${hospitalPracticeId}/join-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: indDocCookie },
      body: JSON.stringify({ message: 'Joining as visiting orthopedic consultant.' }),
    });
    assert.equal(jrRes.status, 201);
    const jrBody = await jrRes.json();
    const docJoinReqId = jrBody.data.id;

    // Before approval, spoofing X-Practice-Id for hospital MUST fail 403
    const spoofRes = await fetch(`${BASE_URL}/api/v1/pets`, {
      headers: { cookie: indDocCookie, 'x-practice-id': String(hospitalPracticeId) },
    });
    assert.equal(spoofRes.status, 403);

    // Hospital Admin inspects & approves join request
    const hospListRes = await fetch(`${BASE_URL}/api/v1/practices/${hospitalPracticeId}/join-requests`, {
      headers: { cookie: hospitalCookie },
    });
    assert.equal(hospListRes.status, 200);
    const hospList = await hospListRes.json();
    assert.ok(hospList.data.some((r) => r.id === docJoinReqId));

    const approveRes = await fetch(
      `${BASE_URL}/api/v1/practices/${hospitalPracticeId}/join-requests/${docJoinReqId}/approve`,
      { method: 'PATCH', headers: { cookie: hospitalCookie } }
    );
    assert.equal(approveRes.status, 200);

    // Now doctor switches active workspace to Hospital
    const switchToHosp = await fetch(`${BASE_URL}/api/v1/auth/switch-practice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: indDocCookie },
      body: JSON.stringify({ practiceId: hospitalPracticeId }),
    });
    assert.equal(switchToHosp.status, 200);
    const swBody = await switchToHosp.json();
    assert.equal(swBody.data.user.practiceId, hospitalPracticeId);
    assert.equal(swBody.data.user.practiceType, 'HOSPITAL');

    // Inside Hospital workspace, doctor does NOT leak their private Independent pet `SoloMilo`
    const hospDocCookie = extractCookieHeader(switchToHosp);
    const hospPets = await fetch(`${BASE_URL}/api/v1/pets`, {
      headers: { cookie: hospDocCookie },
    });
    const hospPetsBody = await hospPets.json();
    assert.equal(hospPetsBody.data.some((p) => p.id === indPetId), false);

    // Switch back to Independent practice -> `SoloMilo` is still preserved & owned by Independent practice
    const switchBack = await fetch(`${BASE_URL}/api/v1/auth/switch-practice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: hospDocCookie },
      body: JSON.stringify({ practiceId: indPracticeId }),
    });
    assert.equal(switchBack.status, 200);
    const backCookie = extractCookieHeader(switchBack);
    const indPetCheck = await fetch(`${BASE_URL}/api/v1/pets/${indPetId}`, {
      headers: { cookie: backCookie },
    });
    assert.equal(indPetCheck.status, 200);
  });

  test('7. Hospital-Affiliated Doctor waits for approval -> cannot access hospital until approved', async () => {
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register/doctor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Dr. Priya Affil ${ts}`,
        email: affDocEmail,
        mobileNumber: '+919822334455',
        password: affDocPass,
        confirmPassword: affDocPass,
        qualification: 'BVSc & AH',
        registrationNumber: `VET-AFF-${ts}`,
        specialization: 'Dermatology',
        yearsOfExperience: 4,
        practiceMode: 'HOSPITAL_AFFILIATED',
        hospitalPracticeId,
      }),
    });
    assert.equal(regRes.status, 201);
    const regBody = await regRes.json();
    joinReqId = regBody.data.joinRequestId;

    const verRes = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: affDocEmail, code: '123456' }),
    });
    assert.equal(verRes.status, 200);
    affDocCookie = extractCookieHeader(verRes);

    // Before Hospital Admin approval -> 403 MEMBERSHIP_PENDING_APPROVAL
    const blockedRes = await fetch(`${BASE_URL}/api/v1/pets`, {
      headers: { cookie: affDocCookie },
    });
    assert.equal(blockedRes.status, 403);
    const blockedBody = await blockedRes.json();
    assert.equal(blockedBody.code, 'MEMBERSHIP_PENDING_APPROVAL');

    // Approve request
    const approveRes = await fetch(
      `${BASE_URL}/api/v1/practices/${hospitalPracticeId}/join-requests/${joinReqId}/approve`,
      { method: 'PATCH', headers: { cookie: hospitalCookie } }
    );
    assert.equal(approveRes.status, 200);

    // Refresh or fetch pets -> now allowed!
    const allowedRes = await fetch(`${BASE_URL}/api/v1/pets`, {
      headers: { cookie: affDocCookie },
    });
    assert.equal(allowedRes.status, 200);
  });

  test('8. Pet Owner self-registers without hospital, adds multiple pets & books across Independent Doctor and Hospital', async () => {
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register/pet-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: `Neha Parent ${ts}`,
        email: ownerEmail,
        mobileNumber: '+919877665544',
        password: ownerPass,
        confirmPassword: ownerPass,
      }),
    });
    assert.equal(regRes.status, 201);

    const verRes = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, code: '123456' }),
    });
    assert.equal(verRes.status, 200);
    const verBody = await verRes.json();
    assert.equal(verBody.data.user.role, 'pet_owner');
    ownerCookie = extractCookieHeader(verRes);

    // Create 2 pets without any hospital affiliation first
    const p1 = await fetch(`${BASE_URL}/api/v1/owner-portal/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ name: 'Simba', species: 'Cat', breed: 'Siamese' }),
    });
    assert.equal(p1.status, 201);
    ownerPet1Id = (await p1.json()).data.id;

    const p2 = await fetch(`${BASE_URL}/api/v1/owner-portal/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ name: 'Rocky', species: 'Dog', breed: 'Labrador' }),
    });
    assert.equal(p2.status, 201);
    ownerPet2Id = (await p2.json()).data.id;

    // Discover BOTH Hospital and Independent practice
    const discRes = await fetch(`${BASE_URL}/api/v1/practices/discover`);
    assert.equal(discRes.status, 200);
    const discBody = await discRes.json();
    assert.ok(discBody.data.some((p) => p.id === hospitalPracticeId && p.practice_type === 'HOSPITAL'));
    assert.ok(discBody.data.some((p) => p.id === indPracticeId && p.practice_type === 'INDEPENDENT'));

    // Book with Independent Practice AND Hospital with same Pet Owner account
    const b1 = await fetch(`${BASE_URL}/api/v1/owner-portal/book-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({
        practiceId: indPracticeId,
        petId: ownerPet1Id,
        appointmentDate: '2026-12-01',
        startTime: '10:00',
        reason: 'Independent checkup',
      }),
    });
    assert.equal(b1.status, 201);

    const b2 = await fetch(`${BASE_URL}/api/v1/owner-portal/book-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({
        practiceId: hospitalPracticeId,
        petId: ownerPet2Id,
        appointmentDate: '2026-12-02',
        startTime: '11:00',
        reason: 'Hospital dermatology consult',
      }),
    });
    assert.equal(b2.status, 201);
  });

  test('9. Password Reset flow invalidates old password & works with new password', async () => {
    const forgotRes = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail }),
    });
    assert.equal(forgotRes.status, 200);
    const forgotBody = await forgotRes.json();
    const token = forgotBody.data.resetToken;
    assert.ok(token);

    const newPass = 'ResetNewPass#2026!';
    const resetRes = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: newPass, confirmPassword: newPass }),
    });
    assert.equal(resetRes.status, 200);

    const oldLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPass }),
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: newPass }),
    });
    assert.equal(newLogin.status, 200);
  });
});

