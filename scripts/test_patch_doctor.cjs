async function testPatch() {
  // First, let's login as doctor or admin to get the auth cookie
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mouni@gmail.com', password: 'Password123!' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login cookie:', cookie ? cookie.split(';')[0] : 'None');

  // Now test PATCH /api/v1/consultations/71/doctor
  console.log('Testing PATCH /api/v1/consultations/71/doctor with doctorId = 3 ...');
  const patchRes = await fetch('http://localhost:5000/api/v1/consultations/71/doctor', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie || '',
    },
    body: JSON.stringify({ doctorId: 3 })
  });
  console.log('Status:', patchRes.status);
  const data = await patchRes.json();
  console.log('Response:', data);
}

testPatch().catch(console.error);

