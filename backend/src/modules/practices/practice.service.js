const crypto = require('crypto');
const db = require('../../db/connection');
const { logAuditEvent } = require('../audit-viewer/audit.event.logger');

class PracticeService {
  async _requirePracticeAdmin(practiceId, user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (user?.role === 'super_admin' || roles.includes('SUPER_ADMIN')) {
      const pRes = await db.query(`SELECT * FROM practices WHERE id = $1;`, [practiceId]);
      if (pRes.rows.length === 0) {
        const err = new Error('Practice not found.');
        err.statusCode = 404;
        throw err;
      }
      return pRes.rows[0];
    }

    const res = await db.query(
      `SELECT p.*, pm.role AS member_role, pm.status AS member_status
       FROM practices p
       JOIN practice_members pm ON pm.practice_id = p.id
       WHERE p.id = $1 AND pm.user_id = $2;`,
      [practiceId, user.id]
    );

    if (res.rows.length === 0) {
      const err = new Error('Access forbidden: You are not a member of this practice.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const row = res.rows[0];
    if (row.member_status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(row.member_role)) {
      const err = new Error('Access forbidden: Only an active Practice Owner or Admin can manage this practice.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (row.status !== 'ACTIVE') {
      const err = new Error('This practice is not currently active.');
      err.statusCode = 403;
      err.code = 'PRACTICE_NOT_ACTIVE';
      throw err;
    }

    return row;
  }

  async discoverPractices({ type = '', search = '', city = '', limit = 100, offset = 0 } = {}) {
    let whereClause = `WHERE p.status = 'ACTIVE' AND p.is_discoverable = TRUE`;
    const params = [];
    let idx = 1;

    if (type && ['HOSPITAL', 'INDEPENDENT'].includes(String(type).toUpperCase())) {
      whereClause += ` AND p.practice_type = $${idx++}`;
      params.push(String(type).toUpperCase());
    }

    if (search && search.trim()) {
      whereClause += ` AND (p.name ILIKE $${idx} OR p.specialization ILIKE $${idx} OR p.city ILIKE $${idx} OR u.name ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    if (city && city.trim()) {
      whereClause += ` AND p.city ILIKE $${idx++}`;
      params.push(`%${city.trim()}%`);
      idx++;
    }

    const query = `
      SELECT
        p.id, p.clinic_id, p.practice_type, p.name, p.slug, p.email, p.phone,
        p.address, p.city, p.state, p.pin_code, p.specialization, p.created_at,
        u.id AS owner_doctor_id, u.name AS owner_name,
        dp.qualification AS doctor_qualification, dp.specialization AS doctor_specialization,
        dp.years_of_experience AS doctor_experience,
        (SELECT COUNT(*)::int FROM practice_members pm WHERE pm.practice_id = p.id AND pm.status = 'ACTIVE' AND pm.role IN ('DOCTOR', 'OWNER')) AS doctor_count
      FROM practices p
      LEFT JOIN users u ON u.id = p.owner_user_id
      LEFT JOIN doctor_profiles dp ON dp.user_id = p.owner_user_id
      ${whereClause}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    return rows;
  }

  async getPracticeById(practiceId, user = null) {
    const res = await db.query(
      `SELECT p.*, hp.registration_number AS hospital_reg_no, hp.admin_name,
              dp.qualification AS owner_qualification, dp.specialization AS owner_specialization, dp.years_of_experience
       FROM practices p
       LEFT JOIN hospital_profiles hp ON hp.practice_id = p.id
       LEFT JOIN doctor_profiles dp ON dp.user_id = p.owner_user_id
       WHERE p.id = $1;`,
      [practiceId]
    );

    if (res.rows.length === 0) {
      const err = new Error('Practice not found.');
      err.statusCode = 404;
      throw err;
    }

    const practice = res.rows[0];
    const isSuperAdmin = user && (user.role === 'super_admin' || user.roles?.includes('SUPER_ADMIN'));
    let membership = null;

    if (user) {
      const mRes = await db.query(
        `SELECT id, role, status, is_primary, joined_at FROM practice_members WHERE practice_id = $1 AND user_id = $2;`,
        [practiceId, user.id]
      );
      membership = mRes.rows[0] || null;
    }

    if (practice.status !== 'ACTIVE' && !isSuperAdmin && !membership) {
      const err = new Error('Practice is not publicly available.');
      err.statusCode = 403;
      throw err;
    }

    const doctorsRes = await db.query(
      `SELECT u.id, u.name, u.email, u.specialty, u.license_number,
              dp.qualification, dp.specialization, dp.years_of_experience, pm.role AS practice_role
       FROM practice_members pm
       JOIN users u ON u.id = pm.user_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE pm.practice_id = $1 AND pm.status = 'ACTIVE' AND pm.role IN ('DOCTOR', 'OWNER')
       ORDER BY u.name ASC;`,
      [practiceId]
    );

    return {
      ...practice,
      membership,
      doctors: doctorsRes.rows,
    };
  }

  async createIndependentPractice(user, { practiceName, phone = '', address = '', city = '', state = '', pinCode = '', specialization = '' }, reqInfo = {}) {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (!roles.includes('DOCTOR') && user.role !== 'doctor') {
      const err = new Error('Only veterinarian doctor accounts can launch an independent practice.');
      err.statusCode = 403;
      throw err;
    }

    const existingInd = await db.query(
      `SELECT id FROM practices WHERE owner_user_id = $1 AND practice_type = 'INDEPENDENT';`,
      [user.id]
    );
    if (existingInd.rows.length > 0) {
      const err = new Error('You already own an independent practice workspace.');
      err.statusCode = 409;
      throw err;
    }

    const cleanName = (practiceName && practiceName.trim())
      ? practiceName.trim()
      : `${user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`} Veterinary Practice`;

    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'practice';
    const slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;

    const client = await db.getClient();
    let newPractice;
    try {
      await client.query('BEGIN');

      const clinicRes = await client.query(
        `INSERT INTO clinics (name, slug, status, timezone, locale, address, phone)
         VALUES ($1, $2, 'active', 'Asia/Kolkata', 'en', $3, $4)
         RETURNING *;`,
        [cleanName, slug, address || null, phone || user.phone || null]
      );
      const clinic = clinicRes.rows[0];

      const pracRes = await client.query(
        `INSERT INTO practices (
           clinic_id, practice_type, name, slug, owner_user_id, status,
           email, phone, address, city, state, pin_code, specialization, is_discoverable
         )
         VALUES ($1, 'INDEPENDENT', $2, $3, $4, 'ACTIVE', $5, $6, $7, $8, $9, $10, $11, TRUE)
         RETURNING *;`,
        [
          clinic.id, cleanName, slug, user.id,
          user.email, phone || user.phone || null,
          address || null, city || null, state || null, pinCode || null,
          specialization || user.specialty || null,
        ]
      );
      newPractice = pracRes.rows[0];

      await client.query(
        `INSERT INTO practice_members (practice_id, user_id, role, status, is_primary, joined_at, approved_at)
         VALUES ($1, $2, 'OWNER', 'ACTIVE', TRUE, NOW(), NOW());`,
        [newPractice.id, user.id]
      );

      await client.query(
        `INSERT INTO doctor_profiles (user_id, qualification, registration_number, specialization, independent_practice_id)
         VALUES ($1, 'BVSc / DVM', $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET independent_practice_id = EXCLUDED.independent_practice_id, updated_at = NOW();`,
        [user.id, user.licenseNumber || null, specialization || user.specialty || null, newPractice.id]
      );

      await client.query(
        `INSERT INTO clinic_settings (clinic_id, address, phone) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
        [clinic.id, address || null, phone || user.phone || null]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAuditEvent({
      clinicId: newPractice.clinic_id,
      practiceId: newPractice.id,
      actorUserId: user.id,
      action: 'independent_practice_created',
      targetType: 'practice',
      targetId: newPractice.id,
      metadata: { practiceName: newPractice.name },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return newPractice;
  }

  async inviteToPractice(practiceId, actorUser, { email, role = 'DOCTOR' }, reqInfo = {}) {
    const practice = await this._requirePracticeAdmin(practiceId, actorUser);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const targetRole = String(role || 'DOCTOR').toUpperCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      const err = new Error('Valid email address is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'STAFF'].includes(targetRole)) {
      const err = new Error('Invalid practice role.');
      err.statusCode = 400;
      throw err;
    }

    const existingUserRes = await db.query(`SELECT id, role FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
    const invitedUserId = existingUserRes.rows[0]?.id || null;

    if (invitedUserId) {
      const alreadyMember = await db.query(
        `SELECT status FROM practice_members WHERE practice_id = $1 AND user_id = $2;`,
        [practiceId, invitedUserId]
      );
      if (alreadyMember.rows.length > 0 && alreadyMember.rows[0].status === 'ACTIVE') {
        const err = new Error('This user is already an active member of this practice.');
        err.statusCode = 409;
        throw err;
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { rows } = await db.query(
      `INSERT INTO hospital_invitations (practice_id, clinic_id, email, invited_user_id, role, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, practice_id, email, invited_user_id, role, status, expires_at, created_at;`,
      [practice.id, practice.clinic_id, cleanEmail, invitedUserId, targetRole, tokenHash, actorUser.id, expiresAt]
    );

    await logAuditEvent({
      clinicId: practice.clinic_id,
      practiceId: practice.id,
      actorUserId: actorUser.id,
      action: 'practice_invitation_sent',
      targetType: 'hospital_invitation',
      targetId: rows[0].id,
      metadata: { email: cleanEmail, role: targetRole, existingUser: Boolean(invitedUserId) },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return {
      invitation: rows[0],
      rawToken,
      existingRegisteredDoctor: Boolean(invitedUserId),
    };
  }

  async listMyInvitations(user) {
    const { rows } = await db.query(
      `SELECT hi.*, p.name AS practice_name, p.practice_type, p.city, p.state, u.name AS invited_by_name
       FROM hospital_invitations hi
       JOIN practices p ON p.id = hi.practice_id
       LEFT JOIN users u ON u.id = hi.invited_by
       WHERE (hi.invited_user_id = $1 OR LOWER(hi.email) = LOWER($2))
         AND hi.status = 'PENDING'
         AND hi.expires_at > NOW()
       ORDER BY hi.created_at DESC;`,
      [user.id, user.email]
    );
    return rows;
  }

  async respondToInvitation(inviteId, user, { action }, reqInfo = {}) {
    const decision = String(action || '').toUpperCase();
    if (!['ACCEPT', 'DECLINE'].includes(decision)) {
      const err = new Error("action must be 'ACCEPT' or 'DECLINE'.");
      err.statusCode = 400;
      throw err;
    }

    const invRes = await db.query(
      `SELECT hi.*, p.clinic_id, p.name AS practice_name
       FROM hospital_invitations hi
       JOIN practices p ON p.id = hi.practice_id
       WHERE hi.id = $1;`,
      [inviteId]
    );

    if (invRes.rows.length === 0) {
      const err = new Error('Invitation not found.');
      err.statusCode = 404;
      throw err;
    }

    const invite = invRes.rows[0];
    if (invite.invited_user_id !== user.id && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      const err = new Error('This invitation does not belong to your account.');
      err.statusCode = 403;
      throw err;
    }
    if (invite.status !== 'PENDING') {
      const err = new Error(`Invitation has already been ${invite.status.toLowerCase()}.`);
      err.statusCode = 410;
      throw err;
    }
    if (new Date(invite.expires_at) < new Date()) {
      await db.query(`UPDATE hospital_invitations SET status = 'EXPIRED' WHERE id = $1;`, [inviteId]);
      const err = new Error('Invitation has expired.');
      err.statusCode = 410;
      throw err;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (decision === 'ACCEPT') {
        await client.query(
          `INSERT INTO practice_members (practice_id, user_id, role, status, invited_by, approved_by, approved_at, joined_at)
           VALUES ($1, $2, $3, 'ACTIVE', $4, $4, NOW(), NOW())
           ON CONFLICT (practice_id, user_id)
           DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', approved_at = NOW(), joined_at = COALESCE(practice_members.joined_at, NOW()), updated_at = NOW();`,
          [invite.practice_id, user.id, invite.role, invite.invited_by]
        );
        await client.query(
          `UPDATE hospital_invitations SET status = 'ACCEPTED', invited_user_id = $1, responded_at = NOW() WHERE id = $2;`,
          [user.id, inviteId]
        );
      } else {
        await client.query(
          `UPDATE hospital_invitations SET status = 'REJECTED', responded_at = NOW() WHERE id = $1;`,
          [inviteId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAuditEvent({
      clinicId: invite.clinic_id,
      practiceId: invite.practice_id,
      actorUserId: user.id,
      action: decision === 'ACCEPT' ? 'hospital_invitation_accepted' : 'hospital_invitation_declined',
      targetType: 'hospital_invitation',
      targetId: inviteId,
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return { status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', practiceId: invite.practice_id };
  }

  async submitJoinRequest(practiceId, user, { message = '' } = {}, reqInfo = {}) {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (!roles.includes('DOCTOR') && user.role !== 'doctor') {
      const err = new Error('Only doctors can submit hospital join requests.');
      err.statusCode = 403;
      throw err;
    }

    const pracRes = await db.query(
      `SELECT id, clinic_id, name, practice_type, status FROM practices WHERE id = $1;`,
      [practiceId]
    );
    if (pracRes.rows.length === 0) {
      const err = new Error('Hospital practice not found.');
      err.statusCode = 404;
      throw err;
    }

    const practice = pracRes.rows[0];
    if (practice.practice_type !== 'HOSPITAL' || practice.status !== 'ACTIVE') {
      const err = new Error('Join requests can only be sent to active Hospital practices.');
      err.statusCode = 400;
      throw err;
    }

    const existingMember = await db.query(
      `SELECT status FROM practice_members WHERE practice_id = $1 AND user_id = $2;`,
      [practiceId, user.id]
    );
    if (existingMember.rows.length > 0 && existingMember.rows[0].status === 'ACTIVE') {
      const err = new Error('You are already an active member of this hospital.');
      err.statusCode = 409;
      throw err;
    }

    const existingPending = await db.query(
      `SELECT id FROM hospital_join_requests WHERE practice_id = $1 AND doctor_user_id = $2 AND status = 'PENDING';`,
      [practiceId, user.id]
    );
    if (existingPending.rows.length > 0) {
      const err = new Error('You already have a pending join request for this hospital.');
      err.statusCode = 409;
      throw err;
    }

    const client = await db.getClient();
    let requestRow;
    try {
      await client.query('BEGIN');

      const jrRes = await client.query(
        `INSERT INTO hospital_join_requests (practice_id, doctor_user_id, message, status)
         VALUES ($1, $2, $3, 'PENDING')
         RETURNING *;`,
        [practiceId, user.id, message || null]
      );
      requestRow = jrRes.rows[0];

      await client.query(
        `INSERT INTO practice_members (practice_id, user_id, role, status, is_primary)
         VALUES ($1, $2, 'DOCTOR', 'PENDING_APPROVAL', FALSE)
         ON CONFLICT (practice_id, user_id)
         DO UPDATE SET status = 'PENDING_APPROVAL', updated_at = NOW();`,
        [practiceId, user.id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAuditEvent({
      clinicId: practice.clinic_id,
      practiceId,
      actorUserId: user.id,
      action: 'hospital_join_request_submitted',
      targetType: 'hospital_join_request',
      targetId: requestRow.id,
      metadata: { hospitalName: practice.name },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return requestRow;
  }

  async listMyJoinRequests(userId) {
    const { rows } = await db.query(
      `SELECT jr.*, p.name AS hospital_name, p.city, p.state, p.status AS practice_status
       FROM hospital_join_requests jr
       JOIN practices p ON p.id = jr.practice_id
       WHERE jr.doctor_user_id = $1
       ORDER BY jr.created_at DESC;`,
      [userId]
    );
    return rows;
  }

  async listPracticeJoinRequests(practiceId, actorUser, { status = '' } = {}) {
    await this._requirePracticeAdmin(practiceId, actorUser);

    let where = `WHERE jr.practice_id = $1`;
    const params = [practiceId];
    if (status && status !== 'ALL') {
      where += ` AND jr.status = $2`;
      params.push(String(status).toUpperCase());
    }

    const { rows } = await db.query(
      `SELECT jr.*, u.name AS doctor_name, u.email AS doctor_email, u.phone AS doctor_phone,
              dp.qualification, dp.registration_number, dp.specialization, dp.years_of_experience,
              EXISTS(SELECT 1 FROM practices ind WHERE ind.owner_user_id = u.id AND ind.practice_type = 'INDEPENDENT') AS has_independent_practice
       FROM hospital_join_requests jr
       JOIN users u ON u.id = jr.doctor_user_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       ${where}
       ORDER BY CASE WHEN jr.status = 'PENDING' THEN 0 ELSE 1 END, jr.created_at DESC;`,
      params
    );
    return rows;
  }

  async approveJoinRequest(practiceId, requestId, actorUser, reqInfo = {}) {
    const practice = await this._requirePracticeAdmin(practiceId, actorUser);

    const jrRes = await db.query(
      `SELECT * FROM hospital_join_requests WHERE id = $1 AND practice_id = $2;`,
      [requestId, practiceId]
    );
    if (jrRes.rows.length === 0) {
      const err = new Error('Join request not found.');
      err.statusCode = 404;
      throw err;
    }
    const jr = jrRes.rows[0];
    if (jr.status !== 'PENDING') {
      const err = new Error(`Join request has already been ${jr.status.toLowerCase()}.`);
      err.statusCode = 409;
      throw err;
    }

    const client = await db.getClient();
    let updated;
    try {
      await client.query('BEGIN');

      const updRes = await client.query(
        `UPDATE hospital_join_requests
         SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *;`,
        [actorUser.id, requestId]
      );
      updated = updRes.rows[0];

      await client.query(
        `INSERT INTO practice_members (practice_id, user_id, role, status, approved_by, approved_at, joined_at)
         VALUES ($1, $2, 'DOCTOR', 'ACTIVE', $3, NOW(), NOW())
         ON CONFLICT (practice_id, user_id)
         DO UPDATE SET status = 'ACTIVE', approved_by = EXCLUDED.approved_by, approved_at = NOW(), joined_at = COALESCE(practice_members.joined_at, NOW()), updated_at = NOW();`,
        [practiceId, jr.doctor_user_id, actorUser.id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAuditEvent({
      clinicId: practice.clinic_id,
      practiceId,
      actorUserId: actorUser.id,
      action: 'hospital_join_request_approved',
      targetType: 'hospital_join_request',
      targetId: requestId,
      metadata: { doctorUserId: jr.doctor_user_id },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async rejectJoinRequest(practiceId, requestId, actorUser, { reason = '' } = {}, reqInfo = {}) {
    const practice = await this._requirePracticeAdmin(practiceId, actorUser);

    const jrRes = await db.query(
      `SELECT * FROM hospital_join_requests WHERE id = $1 AND practice_id = $2;`,
      [requestId, practiceId]
    );
    if (jrRes.rows.length === 0) {
      const err = new Error('Join request not found.');
      err.statusCode = 404;
      throw err;
    }
    const jr = jrRes.rows[0];
    if (jr.status !== 'PENDING') {
      const err = new Error(`Join request has already been ${jr.status.toLowerCase()}.`);
      err.statusCode = 409;
      throw err;
    }

    const client = await db.getClient();
    let updated;
    try {
      await client.query('BEGIN');

      const updRes = await client.query(
        `UPDATE hospital_join_requests
         SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *;`,
        [actorUser.id, reason || 'Declined by Hospital Admin', requestId]
      );
      updated = updRes.rows[0];

      await client.query(
        `UPDATE practice_members SET status = 'REJECTED', updated_at = NOW() WHERE practice_id = $1 AND user_id = $2;`,
        [practiceId, jr.doctor_user_id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAuditEvent({
      clinicId: practice.clinic_id,
      practiceId,
      actorUserId: actorUser.id,
      action: 'hospital_join_request_rejected',
      targetType: 'hospital_join_request',
      targetId: requestId,
      metadata: { doctorUserId: jr.doctor_user_id, reason },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }
}

module.exports = new PracticeService();
