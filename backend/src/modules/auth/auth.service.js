const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../db/connection');
const { hashPassword, verifyPassword } = require('../../utils/password');
const { loadUserContext } = require('./userContext.helper');
const { logAuditEvent } = require('../audit-viewer/audit.event.logger');

class AuthService {
  hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  generateTokens(user) {
    const payload = {
      sub: user.id,
      clinicId: user.clinicId ?? user.clinic_id ?? null,
      activePracticeId: user.practiceId ?? user.practice_id ?? null,
      role: user.role,
      roles: user.roles || [],
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

  async _slugifyUnique(client, baseName) {
    const base = String(baseName || 'practice')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'practice';

    let candidate = base;
    let attempt = 0;
    while (attempt < 10) {
      const existing = await client.query(
        `SELECT 1 FROM clinics WHERE slug = $1 UNION SELECT 1 FROM practices WHERE slug = $1 LIMIT 1;`,
        [candidate]
      );
      if (existing.rows.length === 0) return candidate;
      attempt += 1;
      candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`;
    }
    return `${base}-${Date.now()}`;
  }

  async _issueOtp(target, purpose) {
    const cleanTarget = String(target).trim().toLowerCase();
    const rawCode = String(crypto.randomInt(100000, 999999));
    const codeHash = this.hashToken(rawCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      `INSERT INTO otp_codes (target, purpose, code_hash, expires_at)
       VALUES ($1, $2, $3, $4);`,
      [cleanTarget, purpose, codeHash, expiresAt]
    );

    if (config.nodeEnv !== 'production') {
      console.log(`[AuthVerification] OTP for ${cleanTarget} (${purpose}): ${rawCode} (staging fallback: ${config.auth.stagingHardcodedOtp})`);
    }

    return {
      rawCode,
      stagingDemoCode: config.nodeEnv !== 'production' ? config.auth.stagingHardcodedOtp : undefined,
    };
  }

  async _verifyOtp(target, purpose, rawCode) {
    const cleanTarget = String(target || '').trim().toLowerCase();
    const cleanCode = String(rawCode || '').trim();
    if (!cleanTarget || !cleanCode) {
      const err = new Error('Target identifier and verification code are required.');
      err.statusCode = 400;
      throw err;
    }

    const otpRes = await db.query(
      `SELECT * FROM otp_codes
       WHERE target = $1 AND purpose = $2 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1;`,
      [cleanTarget, purpose]
    );

    const isStagingOverride =
      config.nodeEnv !== 'production' && cleanCode === config.auth.stagingHardcodedOtp;

    if (otpRes.rows.length === 0 && !isStagingOverride) {
      const err = new Error('No pending verification code found. Please request a new code.');
      err.statusCode = 400;
      throw err;
    }

    const record = otpRes.rows[0];
    if (record) {
      if (new Date(record.expires_at) < new Date() && !isStagingOverride) {
        const err = new Error('Verification code has expired. Please request a new code.');
        err.statusCode = 410;
        throw err;
      }

      const providedHash = this.hashToken(cleanCode);
      if (providedHash !== record.code_hash && !isStagingOverride) {
        await db.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1;`, [record.id]);
        const err = new Error('Invalid verification code.');
        err.statusCode = 400;
        throw err;
      }

      await db.query(`UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1;`, [record.id]);
    }
    return true;
  }

  async _createSessionTokens(userContext, { deviceInfo = '', ip = '' } = {}) {
    const { accessToken, rawRefreshToken, refreshTokenHash } = this.generateTokens(userContext);
    const expiresAt = new Date(Date.now() + config.auth.refreshTokenDays * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [userContext.id, refreshTokenHash, deviceInfo, ip, expiresAt]
    );

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /**
   * Legacy backward-compatible endpoint (`POST /api/v1/auth/register-clinic`)
   * Kept active for existing Phase 1 tests while `/register/hospital` enforces full approval flow.
   */
  async registerClinic({ clinicName, clinicSlug, adminName, email, password, phone }) {
    const slug = clinicSlug.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    const existingClinic = await db.query(
      'SELECT id FROM clinics WHERE slug = $1 UNION SELECT id FROM practices WHERE slug = $1 LIMIT 1;',
      [slug]
    );
    if (existingClinic.rows.length > 0) {
      const err = new Error(`Clinic slug "${slug}" is already registered. Please choose another.`);
      err.statusCode = 409;
      throw err;
    }

    const existingUser = await db.query('SELECT id FROM users WHERE LOWER(email) = $1;', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      const err = new Error(`An account with email "${cleanEmail}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    const { hash: passwordHash, algo } = await hashPassword(password);

    const client = await db.getClient();
    let userId;
    try {
      await client.query('BEGIN');

      const clinicRes = await client.query(
        `INSERT INTO clinics (name, slug, status, timezone, locale, phone)
         VALUES ($1, $2, 'active', 'Asia/Kolkata', 'en', $3)
         RETURNING *;`,
        [clinicName.trim(), slug, phone ? phone.trim() : null]
      );
      const clinic = clinicRes.rows[0];

      const userRes = await client.query(
        `INSERT INTO users (name, email, role, clinic_id, phone, status, email_verified_at, phone_verified_at)
         VALUES ($1, $2, 'clinic_admin', $3, $4, 'active', NOW(), NOW())
         RETURNING *;`,
        [adminName.trim(), cleanEmail, clinic.id, phone ? phone.trim() : null]
      );
      const user = userRes.rows[0];
      userId = user.id;

      await client.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'HOSPITAL_ADMIN') ON CONFLICT DO NOTHING;`,
        [user.id]
      );

      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ($1, $2, $3);`,
        [user.id, passwordHash, algo]
      );

      const practiceRes = await client.query(
        `INSERT INTO practices (clinic_id, practice_type, name, slug, owner_user_id, status, email, phone)
         VALUES ($1, 'HOSPITAL', $2, $3, $4, 'ACTIVE', $5, $6)
         RETURNING *;`,
        [clinic.id, clinic.name, slug, user.id, cleanEmail, phone ? phone.trim() : null]
      );
      const practice = practiceRes.rows[0];

      await client.query(
        `INSERT INTO hospital_profiles (practice_id, hospital_name, hospital_email, contact_number, registration_number, admin_name, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [practice.id, clinic.name, cleanEmail, phone ? phone.trim() : 'Not Provided', `LIC-${clinic.id}`, adminName.trim()]
      );

      await client.query(
        `INSERT INTO practice_members (practice_id, user_id, role, status, is_primary, joined_at, approved_at)
         VALUES ($1, $2, 'OWNER', 'ACTIVE', TRUE, NOW(), NOW());`,
        [practice.id, user.id]
      );

      await client.query(
        `INSERT INTO clinic_settings (clinic_id, phone) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [clinic.id, phone ? phone.trim() : null]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const userContext = await loadUserContext(userId);
    const tokens = await this._createSessionTokens(userContext);
    return { user: userContext, tokens };
  }

  /**
   * 2A. Hospital Self-Registration (`POST /api/v1/auth/register/hospital`)
   * Does NOT activate the hospital automatically; transitions PENDING_VERIFICATION -> PENDING_APPROVAL.
   */
  async registerHospital({
    hospitalName,
    hospitalEmail,
    contactNumber,
    address,
    city,
    state,
    pinCode,
    registrationNumber,
    adminName,
    password,
    ip = null,
    userAgent = null,
  }) {
    const cleanEmail = hospitalEmail.toLowerCase().trim();

    const existingUser = await db.query('SELECT id FROM users WHERE LOWER(email) = $1;', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      const err = new Error(`An account with email "${cleanEmail}" is already registered.`);
      err.statusCode = 409;
      throw err;
    }

    const { hash: passwordHash, algo } = await hashPassword(password);
    const client = await db.getClient();
    let userId;
    let clinicId;
    let practiceId;

    try {
      await client.query('BEGIN');

      const slug = await this._slugifyUnique(client, hospitalName);
      const fullAddress = `${address.trim()}, ${city.trim()}, ${state.trim()} ${pinCode.trim()}`;

      const clinicRes = await client.query(
        `INSERT INTO clinics (name, slug, status, timezone, locale, address, phone)
         VALUES ($1, $2, 'pending_verification', 'Asia/Kolkata', 'en', $3, $4)
         RETURNING *;`,
        [hospitalName.trim(), slug, fullAddress, contactNumber.trim()]
      );
      const clinic = clinicRes.rows[0];
      clinicId = clinic.id;

      // Do NOT set a mandatory clinic_id on users table
      const userRes = await client.query(
        `INSERT INTO users (name, email, role, clinic_id, phone, status)
         VALUES ($1, $2, 'clinic_admin', NULL, $3, 'PENDING_VERIFICATION')
         RETURNING *;`,
        [adminName.trim(), cleanEmail, contactNumber.trim()]
      );
      const user = userRes.rows[0];
      userId = user.id;

      await client.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'HOSPITAL_ADMIN');`,
        [userId]
      );

      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ($1, $2, $3);`,
        [userId, passwordHash, algo]
      );

      const practiceRes = await client.query(
        `INSERT INTO practices (
           clinic_id, practice_type, name, slug, owner_user_id, status,
           email, phone, address, city, state, pin_code, is_discoverable
         )
         VALUES ($1, 'HOSPITAL', $2, $3, $4, 'PENDING_VERIFICATION', $5, $6, $7, $8, $9, $10, TRUE)
         RETURNING *;`,
        [
          clinicId,
          hospitalName.trim(),
          slug,
          userId,
          cleanEmail,
          contactNumber.trim(),
          address.trim(),
          city.trim(),
          state.trim(),
          pinCode.trim(),
        ]
      );
      practiceId = practiceRes.rows[0].id;

      await client.query(
        `INSERT INTO hospital_profiles (
           practice_id, hospital_name, hospital_email, contact_number,
           address, city, state, pin_code, registration_number, admin_name
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          practiceId,
          hospitalName.trim(),
          cleanEmail,
          contactNumber.trim(),
          address.trim(),
          city.trim(),
          state.trim(),
          pinCode.trim(),
          registrationNumber.trim(),
          adminName.trim(),
        ]
      );

      await client.query(
        `INSERT INTO practice_members (practice_id, user_id, role, status, is_primary)
         VALUES ($1, $2, 'OWNER', 'PENDING_VERIFICATION', TRUE);`,
        [practiceId, userId]
      );

      await client.query(
        `INSERT INTO clinic_settings (clinic_id, address, phone) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
        [clinicId, fullAddress, contactNumber.trim()]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const otp = await this._issueOtp(cleanEmail, 'verify_email');
    await logAuditEvent({
      clinicId,
      practiceId,
      actorUserId: userId,
      action: 'hospital_self_registered',
      targetType: 'practice',
      targetId: practiceId,
      metadata: { hospitalName, registrationNumber },
      ip,
      userAgent,
    });

    return {
      userId,
      practiceId,
      email: cleanEmail,
      mobileNumber: contactNumber.trim(),
      status: 'PENDING_VERIFICATION',
      verificationRequired: true,
      demoCode: otp.stagingDemoCode,
    };
  }

  /**
   * 2B. Doctor Self-Registration (`POST /api/v1/auth/register/doctor`)
   * Supports BOTH Independent Practice (auto-provisioned workspace) and Hospital-Affiliated request.
   */
  async registerDoctor({
    fullName,
    email,
    mobileNumber,
    password,
    qualification,
    registrationNumber,
    specialization,
    yearsOfExperience = 0,
    photoKey = null,
    practiceMode, // 'INDEPENDENT' | 'HOSPITAL_AFFILIATED'
    practiceName = null,
    hospitalPracticeId = null,
    joinMessage = null,
    ip = null,
    userAgent = null,
  }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobileNumber.trim();
    const mode = String(practiceMode || '').toUpperCase();

    if (!['INDEPENDENT', 'HOSPITAL_AFFILIATED'].includes(mode)) {
      const err = new Error("practiceMode must be either 'INDEPENDENT' or 'HOSPITAL_AFFILIATED'.");
      err.statusCode = 400;
      throw err;
    }

    const existingUser = await db.query('SELECT id FROM users WHERE LOWER(email) = $1;', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      const err = new Error(`An account with email "${cleanEmail}" is already registered.`);
      err.statusCode = 409;
      throw err;
    }

    let targetHospital = null;
    if (mode === 'HOSPITAL_AFFILIATED' && hospitalPracticeId) {
      const hospRes = await db.query(
        `SELECT id, clinic_id, name, practice_type, status
         FROM practices WHERE id = $1 AND practice_type = 'HOSPITAL' AND status = 'ACTIVE';`,
        [parseInt(hospitalPracticeId, 10)]
      );
      if (hospRes.rows.length === 0) {
        const err = new Error('Selected hospital practice was not found or is not currently active.');
        err.statusCode = 404;
        throw err;
      }
      targetHospital = hospRes.rows[0];
    }

    const { hash: passwordHash, algo } = await hashPassword(password);
    const client = await db.getClient();
    let userId;
    let independentPracticeId = null;
    let independentClinicId = null;
    let joinRequestId = null;

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `INSERT INTO users (
           name, email, role, clinic_id, phone, status,
           license_number, specialty, profile_photo_key
         )
         VALUES ($1, $2, 'doctor', NULL, $3, 'PENDING_VERIFICATION', $4, $5, $6)
         RETURNING *;`,
        [
          fullName.trim(),
          cleanEmail,
          cleanMobile,
          registrationNumber.trim(),
          specialization ? specialization.trim() : null,
          photoKey,
        ]
      );
      userId = userRes.rows[0].id;

      await client.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'DOCTOR');`,
        [userId]
      );

      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ($1, $2, $3);`,
        [userId, passwordHash, algo]
      );

      if (mode === 'INDEPENDENT') {
        const indName = (practiceName && practiceName.trim())
          ? practiceName.trim()
          : `${fullName.trim().startsWith('Dr.') ? fullName.trim() : `Dr. ${fullName.trim()}`} Veterinary Practice`;
        const slug = await this._slugifyUnique(client, indName);

        const clinicRes = await client.query(
          `INSERT INTO clinics (name, slug, status, timezone, locale, phone)
           VALUES ($1, $2, 'pending_verification', 'Asia/Kolkata', 'en', $3)
           RETURNING *;`,
          [indName, slug, cleanMobile]
        );
        independentClinicId = clinicRes.rows[0].id;

        const pracRes = await client.query(
          `INSERT INTO practices (
             clinic_id, practice_type, name, slug, owner_user_id, status,
             email, phone, specialization, is_discoverable
           )
           VALUES ($1, 'INDEPENDENT', $2, $3, $4, 'PENDING_VERIFICATION', $5, $6, $7, TRUE)
           RETURNING *;`,
          [
            independentClinicId,
            indName,
            slug,
            userId,
            cleanEmail,
            cleanMobile,
            specialization ? specialization.trim() : null,
          ]
        );
        independentPracticeId = pracRes.rows[0].id;

        await client.query(
          `INSERT INTO practice_members (practice_id, user_id, role, status, is_primary)
           VALUES ($1, $2, 'OWNER', 'PENDING_VERIFICATION', TRUE);`,
          [independentPracticeId, userId]
        );

        await client.query(
          `INSERT INTO clinic_settings (clinic_id, phone) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [independentClinicId, cleanMobile]
        );
      } else if (targetHospital) {
        const jrRes = await client.query(
          `INSERT INTO hospital_join_requests (practice_id, doctor_user_id, message, status)
           VALUES ($1, $2, $3, 'PENDING')
           RETURNING id;`,
          [targetHospital.id, userId, joinMessage || null]
        );
        joinRequestId = jrRes.rows[0].id;

        await client.query(
          `INSERT INTO practice_members (practice_id, user_id, role, status, is_primary)
           VALUES ($1, $2, 'DOCTOR', 'PENDING_APPROVAL', TRUE);`,
          [targetHospital.id, userId]
        );
      }

      await client.query(
        `INSERT INTO doctor_profiles (
           user_id, qualification, registration_number, specialization,
           years_of_experience, photo_key, independent_practice_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          userId,
          qualification.trim(),
          registrationNumber.trim(),
          specialization ? specialization.trim() : null,
          Math.max(0, parseInt(yearsOfExperience || 0, 10)),
          photoKey,
          independentPracticeId,
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const otp = await this._issueOtp(cleanEmail, 'verify_email');
    await logAuditEvent({
      clinicId: independentClinicId || targetHospital?.clinic_id || null,
      practiceId: independentPracticeId || targetHospital?.id || null,
      actorUserId: userId,
      action: mode === 'INDEPENDENT' ? 'doctor_registered_independent' : 'doctor_registered_hospital_affiliated',
      targetType: 'user',
      targetId: userId,
      metadata: { practiceMode: mode, independentPracticeId, targetHospitalId: targetHospital?.id || null, joinRequestId },
      ip,
      userAgent,
    });

    return {
      userId,
      email: cleanEmail,
      practiceMode: mode,
      independentPracticeId,
      joinRequestId,
      status: 'PENDING_VERIFICATION',
      verificationRequired: true,
      demoCode: otp.stagingDemoCode,
    };
  }

  /**
   * 2C. Pet Owner Self-Registration (`POST /api/v1/auth/register/pet-owner`)
   * Independent of any hospital.
   */
  async registerPetOwner({ fullName, email, mobileNumber, password, ip = null, userAgent = null }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobileNumber.trim();

    const existingUser = await db.query('SELECT id FROM users WHERE LOWER(email) = $1;', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      const err = new Error(`An account with email "${cleanEmail}" is already registered.`);
      err.statusCode = 409;
      throw err;
    }

    const { hash: passwordHash, algo } = await hashPassword(password);
    const client = await db.getClient();
    let userId;
    let legacyOwnerId;

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `INSERT INTO users (name, email, role, clinic_id, phone, status)
         VALUES ($1, $2, 'pet_owner', NULL, $3, 'PENDING_VERIFICATION')
         RETURNING *;`,
        [fullName.trim(), cleanEmail, cleanMobile]
      );
      userId = userRes.rows[0].id;

      await client.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'PET_OWNER');`,
        [userId]
      );

      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ($1, $2, $3);`,
        [userId, passwordHash, algo]
      );

      // Sync or create legacy `owners` record without any mandatory clinic_id
      const existingOwner = await client.query(
        `SELECT id FROM owners WHERE LOWER(email) = $1 AND user_id IS NULL LIMIT 1;`,
        [cleanEmail]
      );

      if (existingOwner.rows.length > 0) {
        legacyOwnerId = existingOwner.rows[0].id;
        await client.query(
          `UPDATE owners SET user_id = $1, name = $2, phone = $3 WHERE id = $4;`,
          [userId, fullName.trim(), cleanMobile, legacyOwnerId]
        );
      } else {
        const ownerRes = await client.query(
          `INSERT INTO owners (clinic_id, name, phone, email, user_id)
           VALUES (NULL, $1, $2, $3, $4)
           RETURNING id;`,
          [fullName.trim(), cleanMobile, cleanEmail, userId]
        );
        legacyOwnerId = ownerRes.rows[0].id;
      }

      await client.query(
        `INSERT INTO notification_preferences (owner_id, email_enabled)
         VALUES ($1, TRUE) ON CONFLICT (owner_id) DO NOTHING;`,
        [legacyOwnerId]
      );

      await client.query(
        `INSERT INTO pet_owner_profiles (user_id, full_name, email, phone, legacy_owner_id)
         VALUES ($1, $2, $3, $4, $5);`,
        [userId, fullName.trim(), cleanEmail, cleanMobile, legacyOwnerId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const otp = await this._issueOtp(cleanEmail, 'verify_email');
    await logAuditEvent({
      clinicId: null,
      actorUserId: userId,
      action: 'pet_owner_self_registered',
      targetType: 'user',
      targetId: userId,
      metadata: { legacyOwnerId },
      ip,
      userAgent,
    });

    return {
      userId,
      legacyOwnerId,
      email: cleanEmail,
      mobileNumber: cleanMobile,
      status: 'PENDING_VERIFICATION',
      verificationRequired: true,
      demoCode: otp.stagingDemoCode,
    };
  }

  /**
   * Verify email or mobile OTP and transition account & owned practice status
   */
  async verifyContact({ channel = 'email', identifier, code, deviceInfo = '', ip = '', userAgent = null }) {
    const cleanId = String(identifier || '').trim().toLowerCase();
    const purpose = channel === 'mobile' ? 'verify_mobile' : 'verify_email';

    const userRes = await db.query(
      channel === 'mobile'
        ? `SELECT id, email, phone, role, status FROM users WHERE phone = $1 LIMIT 1;`
        : `SELECT id, email, phone, role, status FROM users WHERE LOWER(email) = $1 LIMIT 1;`,
      [channel === 'mobile' ? String(identifier).trim() : cleanId]
    );

    if (userRes.rows.length === 0) {
      const err = new Error('Account not found for verification.');
      err.statusCode = 404;
      throw err;
    }

    const u = userRes.rows[0];
    // Verify OTP against stored code (check either email or mobile target)
    await this._verifyOtp(cleanId, purpose, code);

    const client = await db.getClient();
    let finalAccountStatus = u.status;

    try {
      await client.query('BEGIN');

      if (channel === 'mobile') {
        await client.query(`UPDATE users SET phone_verified_at = NOW(), updated_at = NOW() WHERE id = $1;`, [u.id]);
      } else {
        await client.query(`UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1;`, [u.id]);
      }

      // Check owned practices
      const ownedPractices = await client.query(
        `SELECT id, clinic_id, practice_type, status FROM practices WHERE owner_user_id = $1;`,
        [u.id]
      );

      const ownedHospital = ownedPractices.rows.find((p) => p.practice_type === 'HOSPITAL');
      const ownedIndependent = ownedPractices.rows.find((p) => p.practice_type === 'INDEPENDENT');

      if (ownedHospital && ownedHospital.status === 'PENDING_VERIFICATION') {
        // Hospital must wait for Super Admin approval
        finalAccountStatus = 'PENDING_APPROVAL';
        await client.query(`UPDATE users SET status = 'PENDING_APPROVAL', updated_at = NOW() WHERE id = $1;`, [u.id]);
        await client.query(`UPDATE practices SET status = 'PENDING_APPROVAL', updated_at = NOW() WHERE id = $1;`, [ownedHospital.id]);
        await client.query(`UPDATE clinics SET status = 'pending_approval' WHERE id = $1;`, [ownedHospital.clinic_id]);
        await client.query(
          `UPDATE practice_members SET status = 'ACTIVE', joined_at = COALESCE(joined_at, NOW()), updated_at = NOW()
           WHERE practice_id = $1 AND user_id = $2;`,
          [ownedHospital.id, u.id]
        );
      } else {
        // Pet owner, Independent Doctor, or Hospital-Affiliated Doctor identity becomes ACTIVE
        finalAccountStatus = 'ACTIVE';
        await client.query(`UPDATE users SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1;`, [u.id]);

        if (ownedIndependent && ownedIndependent.status === 'PENDING_VERIFICATION') {
          await client.query(`UPDATE practices SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1;`, [ownedIndependent.id]);
          await client.query(`UPDATE clinics SET status = 'active' WHERE id = $1;`, [ownedIndependent.clinic_id]);
          await client.query(
            `UPDATE practice_members SET status = 'ACTIVE', joined_at = NOW(), approved_at = NOW(), updated_at = NOW()
             WHERE practice_id = $1 AND user_id = $2;`,
            [ownedIndependent.id, u.id]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAuditEvent({
      actorUserId: u.id,
      action: channel === 'mobile' ? 'mobile_verified' : 'email_verified',
      targetType: 'user',
      targetId: u.id,
      metadata: { finalAccountStatus },
      ip,
      userAgent,
    });

    const userContext = await loadUserContext(u.id);
    const tokens = await this._createSessionTokens(userContext, { deviceInfo, ip });

    return {
      verified: true,
      accountStatus: finalAccountStatus,
      user: userContext,
      tokens,
    };
  }

  async resendVerification({ channel = 'email', identifier }) {
    const cleanTarget = String(identifier || '').trim().toLowerCase();
    const purpose = channel === 'mobile' ? 'verify_mobile' : 'verify_email';
    const otp = await this._issueOtp(cleanTarget, purpose);
    return {
      sent: true,
      target: cleanTarget,
      channel,
      demoCode: otp.stagingDemoCode,
    };
  }

  /**
   * User login (Email + Password)
   */
  async login({ email, password, deviceInfo = '', ip = '', userAgent = null }) {
    const cleanEmail = email.toLowerCase().trim();

    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.status,
              uc.password_hash, uc.password_algo, uc.failed_attempts, uc.locked_until,
              ms.enabled_at AS mfa_enabled_at
       FROM users u
       LEFT JOIN user_credentials uc ON uc.user_id = u.id
       LEFT JOIN mfa_secrets ms ON ms.user_id = u.id AND ms.enabled_at IS NOT NULL
       WHERE LOWER(u.email) = $1;`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    const user = userRes.rows[0];

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

    const { valid, needsRehash } = await verifyPassword(password, user.password_hash);
    if (!valid) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      const lockSql =
        newAttempts >= 5
          ? `UPDATE user_credentials SET failed_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE user_id = $2;`
          : `UPDATE user_credentials SET failed_attempts = $1 WHERE user_id = $2;`;
      await db.query(lockSql, [newAttempts, user.id]);

      await logAuditEvent({
        clinicId: user.clinic_id || null,
        actorUserId: user.id,
        action: 'auth_login_failed',
        targetType: 'user',
        targetId: user.id,
        metadata: { attempts: newAttempts },
        ip,
        userAgent,
      });

      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    // Reset failed attempts & lazily upgrade legacy bcrypt hash -> Argon2id
    if (needsRehash) {
      const { hash, algo } = await hashPassword(password);
      await db.query(
        `UPDATE user_credentials SET password_hash = $1, password_algo = $2, failed_attempts = 0, locked_until = NULL WHERE user_id = $3;`,
        [hash, algo, user.id]
      );
    } else {
      await db.query(
        `UPDATE user_credentials SET failed_attempts = 0, locked_until = NULL WHERE user_id = $1;`,
        [user.id]
      );
    }

    const upperStatus = String(user.status || '').toUpperCase();
    if (['SUSPENDED', 'DEACTIVATED', 'INACTIVE'].includes(upperStatus)) {
      const err = new Error(`Account is ${user.status}. Please contact support or an administrator.`);
      err.statusCode = 403;
      err.code = 'ACCOUNT_SUSPENDED';
      throw err;
    }

    await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1;`, [user.id]);

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

    const userContext = await loadUserContext(user.id);
    const tokens = await this._createSessionTokens(userContext, { deviceInfo, ip });

    await logAuditEvent({
      clinicId: userContext.clinicId || null,
      practiceId: userContext.practiceId || null,
      actorUserId: user.id,
      action: 'auth_login_success',
      targetType: 'user',
      targetId: user.id,
      metadata: { role: userContext.role, activePracticeId: userContext.practiceId },
      ip,
      userAgent,
    });

    return {
      mfaRequired: false,
      user: userContext,
      tokens,
    };
  }

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
    if (sanitizedCode !== config.auth.stagingHardcodedOtp) {
      const err = new Error('Invalid MFA verification code. For staging, enter: 123456');
      err.statusCode = 401;
      throw err;
    }

    const userContext = await loadUserContext(userId);
    if (!userContext) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const tokens = await this._createSessionTokens(userContext, { deviceInfo, ip });
    return { user: userContext, tokens };
  }

  async rotateRefreshToken(rawRefreshToken, { deviceInfo = '', ip = '' } = {}) {
    if (!rawRefreshToken) {
      const err = new Error('Refresh token is required.');
      err.statusCode = 401;
      throw err;
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const tokenRes = await db.query(
      `SELECT rt.id, rt.user_id, rt.token_family, rt.expires_at, rt.revoked_at
       FROM refresh_tokens rt
       WHERE rt.token_hash = $1;`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      const err = new Error('Invalid refresh token.');
      err.statusCode = 401;
      throw err;
    }

    const tokenRecord = tokenRes.rows[0];

    if (tokenRecord.revoked_at) {
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_family = $1;`,
        [tokenRecord.token_family]
      );
      const err = new Error('Security alert: Refresh token reuse detected. All sessions revoked.');
      err.statusCode = 401;
      throw err;
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      const err = new Error('Refresh token expired. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1;`, [tokenRecord.id]);

    const userContext = await loadUserContext(tokenRecord.user_id);
    if (!userContext) {
      const err = new Error('User account not found.');
      err.statusCode = 401;
      throw err;
    }

    const { accessToken, rawRefreshToken: newRawRefreshToken, refreshTokenHash: newHash } = this.generateTokens(userContext);
    const newExpiresAt = new Date(Date.now() + config.auth.refreshTokenDays * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_family, token_hash, device_info, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [userContext.id, tokenRecord.token_family, newHash, deviceInfo, ip, newExpiresAt]
    );

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: userContext,
    };
  }

  /**
   * Switch active workspace practice (verifies backend membership)
   */
  async switchPractice(userId, practiceId, { ip = null, userAgent = null } = {}) {
    const userContext = await loadUserContext(userId, {
      requestedPracticeId: practiceId,
      strictPracticeCheck: true,
    });

    if (!userContext || userContext.unauthorizedPracticeAccess) {
      const err = new Error('You do not have an active membership in the selected practice.');
      err.statusCode = 403;
      err.code = 'UNAUTHORIZED_PRACTICE_ACCESS';
      throw err;
    }

    const { accessToken } = this.generateTokens(userContext);

    await logAuditEvent({
      clinicId: userContext.clinicId || null,
      practiceId: userContext.practiceId || null,
      actorUserId: userId,
      action: 'practice_workspace_switched',
      targetType: 'practice',
      targetId: practiceId,
      metadata: { practiceName: userContext.practiceName, practiceType: userContext.practiceType },
      ip,
      userAgent,
    });

    return { user: userContext, accessToken };
  }

  async forgotPassword({ email, ip = null, userAgent = null }) {
    const cleanEmail = String(email || '').toLowerCase().trim();
    const userRes = await db.query(`SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);

    if (userRes.rows.length === 0) {
      return { sent: true }; // Do not enumerate accounts
    }

    const user = userRes.rows[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3);`,
      [user.id, tokenHash, expiresAt]
    );

    if (config.nodeEnv !== 'production') {
      console.log(`[AuthReset] Password reset token for ${cleanEmail}: ${rawToken}`);
    }

    await logAuditEvent({
      actorUserId: user.id,
      action: 'password_reset_requested',
      targetType: 'user',
      targetId: user.id,
      ip,
      userAgent,
    });

    return {
      sent: true,
      resetToken: config.nodeEnv !== 'production' ? rawToken : undefined,
    };
  }

  async resetPassword({ token, newPassword, ip = null, userAgent = null }) {
    const tokenHash = this.hashToken(token);
    const resetRes = await db.query(
      `SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1 LIMIT 1;`,
      [tokenHash]
    );

    if (resetRes.rows.length === 0) {
      const err = new Error('Invalid password reset token.');
      err.statusCode = 400;
      throw err;
    }

    const record = resetRes.rows[0];
    if (record.used_at) {
      const err = new Error('This password reset token has already been used.');
      err.statusCode = 410;
      throw err;
    }
    if (new Date(record.expires_at) < new Date()) {
      const err = new Error('Password reset token has expired.');
      err.statusCode = 410;
      throw err;
    }

    const { hash, algo } = await hashPassword(newPassword);

    await db.query(
      `UPDATE user_credentials SET password_hash = $1, password_algo = $2, password_changed_at = NOW(), failed_attempts = 0, locked_until = NULL WHERE user_id = $3;`,
      [hash, algo, record.user_id]
    );
    await db.query(`UPDATE password_resets SET used_at = NOW() WHERE id = $1;`, [record.id]);
    await this.logoutAll(record.user_id);

    await logAuditEvent({
      actorUserId: record.user_id,
      action: 'password_reset_completed',
      targetType: 'user',
      targetId: record.user_id,
      ip,
      userAgent,
    });

    return { reset: true };
  }

  async logout(rawRefreshToken) {
    if (rawRefreshToken) {
      const hash = this.hashToken(rawRefreshToken);
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1;`,
        [hash]
      );
    }
  }

  async logoutAll(userId) {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL;`,
      [userId]
    );
  }
}

module.exports = new AuthService();
