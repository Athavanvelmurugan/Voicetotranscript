const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../../src/utils/password');

describe('Password Hashing (Argon2id + Legacy Bcrypt Compatibility)', () => {
  test('hashes passwords with Argon2id and verifies match cleanly', async () => {
    const { hash, algo } = await hashPassword('StrongVetPass#2026!');
    assert.equal(algo, 'argon2id');
    assert.ok(hash.startsWith('$argon2id$'));

    const resValid = await verifyPassword('StrongVetPass#2026!', hash);
    assert.equal(resValid.valid, true);
    assert.equal(resValid.needsRehash, false);

    const resWrong = await verifyPassword('WrongPass', hash);
    assert.equal(resWrong.valid, false);
  });

  test('verifies legacy bcrypt hashes and flags needsRehash = true', async () => {
    const bcrypt = require('bcryptjs');
    const legacyHash = await bcrypt.hash('LegacyPass123!', 4);
    const res = await verifyPassword('LegacyPass123!', legacyHash);
    assert.equal(res.valid, true);
    assert.equal(res.needsRehash, true);
  });
});

