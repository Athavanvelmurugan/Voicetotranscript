const argon2 = require('argon2');
const bcrypt = require('bcryptjs');

/**
 * Hash a plaintext password using Argon2id (OWASP recommended parameters).
 */
async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }
  const hash = await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 19456, // ~19 MiB
    timeCost: 2,
    parallelism: 1,
  });
  return { hash, algo: 'argon2id' };
}

/**
 * Verify plaintext password against stored Argon2id or legacy bcrypt hash.
 * Returns { valid: boolean, needsRehash: boolean }.
 */
async function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  if (storedHash.startsWith('$argon2')) {
    const valid = await argon2.verify(storedHash, plainPassword);
    return { valid, needsRehash: false };
  }

  // Legacy bcryptjs hash ($2a$ / $2b$ / $2y$)
  const valid = await bcrypt.compare(plainPassword, storedHash);
  return { valid, needsRehash: valid };
}

module.exports = { hashPassword, verifyPassword };

