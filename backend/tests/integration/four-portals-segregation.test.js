const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:5000';

describe('4-Portals Multi-Tenant Architecture & RBAC Tests', () => {

  let superAdminCookie = null;
  let clinicAdminCookie = null;
  let doctorCookie = null;
  let ownerToken = null;

  // 1. Super Admin Authentication
  test('Super Admin logs in and receives super_admin role', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@petpulse.com',
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.user.role, 'super_admin');
    assert.equal(data.data.user.clinicId, null);

    superAdminCookie = res.headers.get('set-cookie');
    assert.ok(superAdminCookie, 'Auth cookie must be issued');
  });

  // 2. Super Admin Telemetry Trends Access
  test('Super Admin accesses /api/v1/super-admin/trends successfully', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/super-admin/trends`, {
      headers: { cookie: superAdminCookie },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data.kpis);
    assert.ok(parseInt(data.data.kpis.total_clinics, 10) >= 1);
    assert.ok(Array.isArray(data.data.services));
  });

  // 3. Super Admin Hospital Master List
  test('Super Admin accesses /api/v1/super-admin/clinics successfully', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/super-admin/clinics`, {
      headers: { cookie: superAdminCookie },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 1);
    const first = data.data[0];
    assert.ok(first.name);
    assert.ok(first.doctor_count !== undefined);
  });

  // 4. Super Admin Global Patient Index
  test('Super Admin accesses /api/v1/super-admin/patients successfully', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/super-admin/patients`, {
      headers: { cookie: superAdminCookie },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    const patientsList = Array.isArray(data.data) ? data.data : data.data?.patients;
    assert.ok(Array.isArray(patientsList));
  });

  // 5. Clinic Admin RBAC Enforcement (Forbidden on Super Admin endpoints)
  test('Clinic Admin is strictly FORBIDDEN (403) from accessing super-admin endpoints', async () => {
    // Login as clinic admin
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@centralvalleyvet.com',
        password: 'Password123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    clinicAdminCookie = loginRes.headers.get('set-cookie');

    // Attempt access to super-admin trends
    const breachRes = await fetch(`${BASE_URL}/api/v1/super-admin/trends`, {
      headers: { cookie: clinicAdminCookie },
    });

    assert.equal(breachRes.status, 403);
    const data = await breachRes.json();
    assert.equal(data.success, false);
    assert.equal(data.code, 'FORBIDDEN');
  });

  // 6. Doctor RBAC Enforcement (Forbidden on Super Admin endpoints)
  test('Doctor is strictly FORBIDDEN (403) from accessing super-admin endpoints', async () => {
    // Login as doctor
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mouni@gmail.com',
        password: 'Password123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    doctorCookie = loginRes.headers.get('set-cookie');

    const breachRes = await fetch(`${BASE_URL}/api/v1/super-admin/trends`, {
      headers: { cookie: doctorCookie },
    });

    assert.equal(breachRes.status, 403);
    const data = await breachRes.json();
    assert.equal(data.success, false);
    assert.equal(data.code, 'FORBIDDEN');
  });

  // 7. Unauthenticated User Blocked (401)
  test('Unauthenticated user is strictly REJECTED (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/super-admin/trends`);
    assert.equal(res.status, 401);
  });

  // 8. Pet Owner Authentication (Passwordless OTP)
  test('Pet Guardian receives OTP and signs into consumer portal', async () => {
    const sendRes = await fetch(`${BASE_URL}/api/v1/owner-auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'athavanvelmurugan@gmail.com' }),
    });
    assert.equal(sendRes.status, 200);

    const verifyRes = await fetch(`${BASE_URL}/api/v1/owner-auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'athavanvelmurugan@gmail.com', code: '123456' }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.success, true);
    assert.ok(verifyData.data.token);
    ownerToken = verifyData.data.token;
  });

  // 9. Pet Owner Hospital Discovery Step
  test('Pet Guardian retrieves active hospital directory', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/hospitals`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 1);
    assert.ok(data.data[0].doctor_count !== undefined);
  });

  // 10. Pet Owner Doctor Discovery Step
  test('Pet Guardian selects Hospital 1 and retrieves its attending veterinarians', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/hospitals/1/doctors`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 1);
    const doctor = data.data[0];
    assert.ok(doctor.name);
    assert.equal(doctor.role, 'doctor');
  });

  // 11. Pet Owner Slot Availability
  test('Pet Guardian checks real-time available appointment slots', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const res = await fetch(`${BASE_URL}/api/v1/owner-portal/available-slots?date=${dateStr}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
  });

});

