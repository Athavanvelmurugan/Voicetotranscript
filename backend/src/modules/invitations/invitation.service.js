const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../db/connection');
const authService = require('../auth/auth.service');

class InvitationService {
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create an invitation for a doctor or staff member
   */
  async createInvitation({ clinicId, email, role, invitedBy }) {
    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1;', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      const err = new Error(`A user with email "${cleanEmail}" already exists in the system.`);
      err.statusCode = 409;
      throw err;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const query = `
      INSERT INTO invitations (clinic_id, email, role, token_hash, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, clinic_id, email, role, expires_at, created_at;
    `;
    const { rows } = await db.query(query, [clinicId, cleanEmail, role, tokenHash, invitedBy, expiresAt]);
    const invitation = rows[0];

    // For staging: return direct link and rawToken so it can be copied immediately in UI
    const inviteUrl = `/invite/${rawToken}`;

    return {
      invitation,
      rawToken,
      inviteUrl,
    };
  }

  /**
   * Verify an invitation token
   */
  async verifyInvitation(rawToken) {
    if (!rawToken) {
      const err = new Error('Invitation token is required.');
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = this.hashToken(rawToken);

    const query = `
      SELECT i.id, i.clinic_id, i.email, i.role, i.expires_at, i.accepted_at,
             c.name AS clinic_name, c.slug AS clinic_slug
      FROM invitations i
      JOIN clinics c ON c.id = i.clinic_id
      WHERE i.token_hash = $1;
    `;
    const { rows } = await db.query(query, [tokenHash]);

    if (rows.length === 0) {
      const err = new Error('Invalid invitation link or token.');
      err.statusCode = 404;
      throw err;
    }

    const invite = rows[0];

    if (invite.accepted_at) {
      const err = new Error('This invitation has already been accepted.');
      err.statusCode = 410;
      throw err;
    }

    if (new Date(invite.expires_at) < new Date()) {
      const err = new Error('This invitation has expired. Please ask the clinic admin for a new invite.');
      err.statusCode = 410;
      throw err;
    }

    return invite;
  }

  /**
   * Accept invitation, set password, and create active user
   */
  async acceptInvitation({ rawToken, name, password, phone = '', licenseNumber = '' }) {
    const invite = await this.verifyInvitation(rawToken);
    const tokenHash = this.hashToken(rawToken);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const userRes = await client.query(
        `INSERT INTO users (name, email, role, clinic_id, phone, license_number, status, email_verified_at, phone_verified_at, license_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW(), NOW())
         RETURNING *;`,
        [name.trim(), invite.email, invite.role, invite.clinic_id, phone ? phone.trim() : null, licenseNumber ? licenseNumber.trim() : null]
      );
      const user = userRes.rows[0];

      // Store credentials
      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash)
         VALUES ($1, $2);`,
        [user.id, passwordHash]
      );

      // Mark invitation accepted
      await client.query(
        `UPDATE invitations SET accepted_at = NOW() WHERE token_hash = $1;`,
        [tokenHash]
      );

      // Generate session tokens
      const { accessToken, rawRefreshToken, refreshTokenHash } = authService.generateTokens(user);
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

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
          clinicId: invite.clinic_id,
          clinicName: invite.clinic_name,
          clinicSlug: invite.clinic_slug,
          licenseNumber: user.license_number,
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
   * List invitations for a clinic
   */
  async listClinicInvitations(clinicId) {
    const query = `
      SELECT id, email, role, expires_at, accepted_at, created_at
      FROM invitations
      WHERE clinic_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await db.query(query, [clinicId]);
    return rows;
  }
}

module.exports = new InvitationService();

