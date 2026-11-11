const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../db/connection');

class AuthService {
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateTokens(user) {
    const payload = {
      sub: user.id,
      clinicId: user.clinic_id,
      role: user.role,
      name: user.name,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: config.auth.accessTokenExpiry,
    });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashToken(rawRefreshToken);

    return { accessToken, rawRefreshToken, refreshTokenHash };
  }

  generateMfaTempToken(user) {
    return jwt.sign(
      { sub: user.id, isMfaPending: true },
      config.auth.jwtSecret,
      { expiresIn: '5m' }
    );
  }

  /**
   * Register a new clinic and its primary clinic_admin
   */
  async registerClinic({ clinicName, clinicSlug, adminName, email, password, phone }) {
    const slug = clinicSlug.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Check existing slug
    const existingClinic = await db.query('SELECT id FROM clinics WHERE slug = $1;', [slug]);
    if (existingClinic.rows.length > 0) {
      const err = new Error(`Clinic slug "${slug}" is already registered. Please choose another.`);
      err.statusCode = 409;
      throw err;
    }

    // Check existing email
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1;', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      const err = new Error(`An account with email "${cleanEmail}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Create clinic
      const clinicRes = await client.query(
        `INSERT INTO clinics (name, slug, status, timezone, locale)
         VALUES ($1, $2, 'active', 'Asia/Kolkata', 'en')
         RETURNING *;`,
        [clinicName.trim(), slug]
      );
      const clinic = clinicRes.rows[0];

      // 2. Create clinic_admin user (Auto-verified in staging)
      const userRes = await client.query(
        `INSERT INTO users (name, email, role, clinic_id, phone, status, email_verified_at, phone_verified_at)
         VALUES ($1, $2, 'clinic_admin', $3, $4, 'active', NOW(), NOW())
         RETURNING *;`,
        [adminName.trim(), cleanEmail, clinic.id, phone ? phone.trim() : null]
      );
      const user = userRes.rows[0];

      // 3. Store credentials
      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash)
         VALUES ($1, $2);`,
        [user.id, passwordHash]
      );

      // 4. Create initial refresh token session
      const { accessToken, rawRefreshToken, refreshTokenHash } = this.generateTokens(user);
      const expiresAt = new Date(Date.now() + config.auth.refreshTokenDays * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3);`,
        [user.id, refreshTokenHash, expiresAt]
      );

      await client.query('COMMIT');

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: clinic.id,
          clinicName: clinic.name,
          clinicSlug: clinic.slug,
        },
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * User login (Email + Password)
   */
  async login({ email, password, deviceInfo = '', ip = '' }) {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Fetch user + clinic
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.status, u.license_number,
              c.name AS clinic_name, c.slug AS clinic_slug, c.status AS clinic_status,
              uc.password_hash, uc.failed_attempts, uc.locked_until,
              ms.enabled_at AS mfa_enabled_at
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       LEFT JOIN user_credentials uc ON uc.user_id = u.id
       LEFT JOIN mfa_secrets ms ON ms.user_id = u.id AND ms.enabled_at IS NOT NULL
       WHERE u.email = $1;`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    const user = userRes.rows[0];

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const err = new Error('Account temporarily locked due to multiple failed attempts. Try again in 15 minutes.');
      err.statusCode = 423;
      throw err;
    }

    if (!user.password_hash) {
      const err = new Error('No password established for this account. Please use password reset or invite link.');
      err.statusCode = 401;
      throw err;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      // Increment failed attempts
      const newAttempts = (user.failed_attempts || 0) + 1;
      let lockSql = `UPDATE user_credentials SET failed_attempts = $1 WHERE user_id = $2;`;
      let lockParams = [newAttempts, user.id];

      if (newAttempts >= 5) {
        lockSql = `UPDATE user_credentials SET failed_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE user_id = $2;`;
      }
      await db.query(lockSql, lockParams);

      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    // Reset failed attempts on success
    await db.query(
      `UPDATE user_credentials SET failed_attempts = 0, locked_until = NULL WHERE user_id = $1;`,
      [user.id]
    );

    // Update last_login_at
    await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1;`, [user.id]);

    // Check MFA
    if (user.mfa_enabled_at) {
      const tempToken = this.generateMfaTempToken(user);
      return {
        mfaRequired: true,
        tempToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    }

    // Issue tokens
    const { accessToken, rawRefreshToken, refreshTokenHash } = this.generateTokens(user);
    const expiresAt = new Date(Date.now() + config.auth.refreshTokenDays * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [user.id, refreshTokenHash, deviceInfo, ip, expiresAt]
    );

    return {
      mfaRequired: false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinic_id,
        clinicName: user.clinic_name,
        clinicSlug: user.clinic_slug,
        licenseNumber: user.license_number,
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
      },
    };
  }

  /**
   * Verify MFA TOTP in staging (Accepts hardcoded 123456 or 1,2,3,4,5,6)
   */
  async verifyMfa({ tempToken, totpCode, deviceInfo = '', ip = '' }) {
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.auth.jwtSecret);
    } catch {
      const err = new Error('MFA challenge expired or invalid. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    const userId = decoded.sub;
    const sanitizedCode = String(totpCode || '').replace(/[\s,-]/g, '');

    // Staging hardcoded check
    const isStagingMatch = sanitizedCode === config.auth.stagingHardcodedOtp;

    if (!isStagingMatch) {
      const err = new Error('Invalid MFA verification code. For staging, enter: 123456');
      err.statusCode = 401;
      throw err;
    }

    // Fetch user
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.status, u.license_number,
              c.name AS clinic_name, c.slug AS clinic_slug
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE u.id = $1;`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const user = userRes.rows[0];
    const { accessToken, rawRefreshToken, refreshTokenHash } = this.generateTokens(user);
    const expiresAt = new Date(Date.now() + config.auth.refreshTokenDays * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [user.id, refreshTokenHash, deviceInfo, ip, expiresAt]
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinic_id,
        clinicName: user.clinic_name,
        clinicSlug: user.clinic_slug,
        licenseNumber: user.license_number,
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
      },
    };
  }

  /**
   * Refresh token rotation with reuse detection
   */
  async rotateRefreshToken(rawRefreshToken, { deviceInfo = '', ip = '' } = {}) {
    if (!rawRefreshToken) {
      const err = new Error('Refresh token is required.');
      err.statusCode = 401;
      throw err;
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const tokenRes = await db.query(
      `SELECT rt.id, rt.user_id, rt.token_family, rt.expires_at, rt.revoked_at,
              u.id AS user_id, u.name, u.email, u.role, u.clinic_id, u.status,
              c.name AS clinic_name, c.slug AS clinic_slug
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE rt.token_hash = $1;`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      const err = new Error('Invalid refresh token.');
      err.statusCode = 401;
      throw err;
    }

    const tokenRecord = tokenRes.rows[0];

    // REUSE DETECTION: If token has already been revoked, revoke entire token family!
    if (tokenRecord.revoked_at) {
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_family = $1;`,
        [tokenRecord.token_family]
      );
      const err = new Error('Security alert: Refresh token reuse detected. All sessions revoked.');
      err.statusCode = 401;
      throw err;
    }

    // Check expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
      const err = new Error('Refresh token expired. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    // Revoke old token
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1;`,
      [tokenRecord.id]
    );

    // Issue new tokens in same token family
    const user = {
      id: tokenRecord.user_id,
      clinic_id: tokenRecord.clinic_id,
      role: tokenRecord.role,
      name: tokenRecord.name,
      email: tokenRecord.email,
    };

    const { accessToken, rawRefreshToken: newRawRefreshToken, refreshTokenHash: newHash } = this.generateTokens(user);
    const newExpiresAt = new Date(Date.now() + config.auth.refreshTokenDays * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_family, token_hash, device_info, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [user.id, tokenRecord.token_family, newHash, deviceInfo, ip, newExpiresAt]
    );

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: {
        id: tokenRecord.user_id,
        name: tokenRecord.name,
        email: tokenRecord.email,
        role: tokenRecord.role,
        clinicId: tokenRecord.clinic_id,
        clinicName: tokenRecord.clinic_name,
        clinicSlug: tokenRecord.clinic_slug,
      },
    };
  }

  /**
   * Revoke current session
   */
  async logout(rawRefreshToken) {
    if (rawRefreshToken) {
      const hash = this.hashToken(rawRefreshToken);
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1;`,
        [hash]
      );
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async logoutAll(userId) {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL;`,
      [userId]
    );
  }
}

module.exports = new AuthService();

