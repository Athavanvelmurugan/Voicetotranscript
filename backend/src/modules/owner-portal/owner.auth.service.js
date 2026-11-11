const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../../db/connection');
const config = require('../../config');
const notificationService = require('../notifications/notification.service');

class OwnerAuthService {
  /**
   * Register a new pet guardian and their first pet (optional)
   */
  async registerOwner({ name, email, phone, petName, species = 'Dog', breed = 'Mixed Breed', clinicId = 1 }) {
    if (!name || !name.trim()) {
      const err = new Error('Guardian full name is required');
      err.statusCode = 400;
      throw err;
    }
    if (!email && !phone) {
      const err = new Error('Either email address or mobile phone is required for registration');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanPhone = phone ? phone.trim() : null;
    const target = cleanEmail || cleanPhone;

    // Check if an owner already exists with this email or phone
    const existing = await db.query(
      `SELECT id, name, email, phone FROM owners 
       WHERE (LOWER(email) = $1 AND $1 IS NOT NULL) 
          OR (phone = $2 AND $2 IS NOT NULL) 
       LIMIT 1;`,
      [cleanEmail, cleanPhone]
    );

    if (existing.rows.length > 0) {
      const err = new Error('An account with this email or phone number already exists. Please sign in instead.');
      err.statusCode = 409;
      throw err;
    }

    // Insert new owner (SERIAL PRIMARY KEY, NO UUIDs)
    const ownerRes = await db.query(
      `INSERT INTO owners (clinic_id, name, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [clinicId || 1, name.trim(), cleanEmail, cleanPhone || 'Unspecified']
    );
    const owner = ownerRes.rows[0];

    // Default notification preferences (email enabled)
    await db.query(
      `INSERT INTO notification_preferences (owner_id, email_enabled)
       VALUES ($1, TRUE)
       ON CONFLICT (owner_id) DO NOTHING;`,
      [owner.id]
    );

    // If pet details provided, register pet and link in pet_owners
    if (petName && petName.trim()) {
      const petRes = await db.query(
        `INSERT INTO pets (clinic_id, name, species, breed, sex, owner_name, owner_contact)
         VALUES ($1, $2, $3, $4, 'Unknown', $5, $6)
         RETURNING *;`,
        [clinicId || 1, petName.trim(), species.trim(), breed ? breed.trim() : 'Mixed Breed', owner.name, owner.phone || owner.email]
      );
      const pet = petRes.rows[0];

      await db.query(
        `INSERT INTO pet_owners (pet_id, owner_id, is_primary)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (pet_id, owner_id) DO NOTHING;`,
        [pet.id, owner.id]
      );
    }

    // Generate and dispatch verification OTP
    const otpResult = await this.sendOtp({ identifier: target, clinicId: clinicId || 1 });

    return {
      success: true,
      message: `Account created for ${owner.name}. Please enter the verification code to complete sign in.`,
      target,
      ownerId: owner.id,
      demoCode: otpResult.demoCode,
    };
  }

  /**
   * Request OTP code for pet guardian login (phone or email)
   */
  async sendOtp({ identifier, clinicId = 1 }) {
    if (!identifier || typeof identifier !== 'string') {
      const err = new Error('Phone number or email address is required');
      err.statusCode = 400;
      throw err;
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const isEmail = cleanIdentifier.includes('@');

    // Staging fixed OTP: 123456
    const code = '123456';
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous active OTPs for this target
    await db.query(
      `UPDATE otp_codes SET consumed_at = NOW()
       WHERE target = $1 AND purpose = 'owner_auth' AND consumed_at IS NULL;`,
      [cleanIdentifier]
    );

    // Save OTP
    await db.query(
      `INSERT INTO otp_codes (target, purpose, code_hash, attempts, expires_at)
       VALUES ($1, 'owner_auth', $2, 0, $3);`,
      [cleanIdentifier, codeHash, expiresAt]
    );

    // Send email dispatch if identifier is an email address
    if (isEmail) {
      await notificationService.sendEmail({
        clinicId,
        recipient: cleanIdentifier,
        subject: 'Your PetPulse Pet Guardian Portal Login Code',
        template: 'owner_login_otp',
        payload: {
          code,
          expiresInMinutes: 10,
        },
      });
    }

    console.log(`[OwnerAuth] Generated OTP ${code} for target: ${cleanIdentifier}`);

    return {
      success: true,
      message: `Verification code sent to ${cleanIdentifier}. In staging/demo environment, use 123456.`,
      target: cleanIdentifier,
      isEmail,
      demoCode: '123456',
    };
  }

  /**
   * Verify OTP and issue JWT session for pet guardian
   */
  async verifyOtp({ identifier, code, clinicId = 1 }) {
    if (!identifier || !code) {
      const err = new Error('Identifier and verification code are required');
      err.statusCode = 400;
      throw err;
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanCode = code.toString().trim();
    const isEmail = cleanIdentifier.includes('@');

    // Staging bypass: accept 123456 directly or verify against DB hash
    const isValidStagingCode = cleanCode === '123456';
    const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

    const otpRes = await db.query(
      `SELECT * FROM otp_codes
       WHERE target = $1 AND purpose = 'owner_auth' AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1;`,
      [cleanIdentifier]
    );

    let codeMatches = isValidStagingCode;
    if (otpRes.rows.length > 0) {
      const stored = otpRes.rows[0];
      if (stored.code_hash === inputHash || isValidStagingCode) {
        codeMatches = true;
        await db.query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1', [stored.id]);
      }
    }

    if (!codeMatches) {
      const err = new Error('Invalid or expired verification code');
      err.statusCode = 401;
      throw err;
    }

    // Resolve or create owner in owners table (SERIAL ID)
    let ownerQuery = isEmail
      ? `SELECT * FROM owners WHERE LOWER(email) = $1 LIMIT 1;`
      : `SELECT * FROM owners WHERE phone = $1 LIMIT 1;`;
    let ownerRes = await db.query(ownerQuery, [cleanIdentifier]);

    let owner;
    if (ownerRes.rows.length > 0) {
      owner = ownerRes.rows[0];
    } else {
      // Auto-register new owner for this clinic
      const insertOwner = `
        INSERT INTO owners (clinic_id, name, email, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const name = isEmail ? cleanIdentifier.split('@')[0] : `Guardian ${cleanIdentifier.slice(-4)}`;
      const email = isEmail ? cleanIdentifier : null;
      const phone = !isEmail ? cleanIdentifier : 'Unspecified';

      const created = await db.query(insertOwner, [clinicId, name, email, phone]);
      owner = created.rows[0];

      // Default notification preference (Email enabled)
      await db.query(
        `INSERT INTO notification_preferences (owner_id, email_enabled)
         VALUES ($1, TRUE)
         ON CONFLICT (owner_id) DO NOTHING;`,
        [owner.id]
      );
    }

    // Generate JWT access token
    const token = jwt.sign(
      {
        sub: owner.id,
        role: 'owner',
        clinicId: owner.clinic_id || clinicId,
        name: owner.name,
      },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      token,
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        clinicId: owner.clinic_id || clinicId,
        role: 'owner',
      },
    };
  }
}

module.exports = new OwnerAuthService();
