const db = require('../../db/connection');

class StaffRepository {
  async getStaff(clinicId, { page = 1, limit = 10, offset = 0, search = '', role = '' } = {}) {
    let whereClause = 'WHERE u.clinic_id = $1';
    const params = [clinicId];
    let idx = 2;

    if (search) {
      whereClause += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.license_number ILIKE $${idx} OR u.specialty ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    if (role && role !== 'all') {
      whereClause += ` AND u.role = $${idx}`;
      params.push(role);
      idx++;
    }

    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.phone,
        u.status,
        u.license_number,
        u.license_verified_at,
        u.specialty,
        u.created_at,
        u.last_login_at,
        COUNT(c.id)::int AS consultation_count,
        COUNT(*) OVER() AS full_count
      FROM users u
      LEFT JOIN consultations c ON c.doctor_id = u.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    const totalCount = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;
    return { staff: rows, totalCount };
  }

  /**
   * Privacy-Preserving Doctor's Assigned Patients List
   * Shows patient medical demographics, conceals legal consents & signature tokens
   */
  async getDoctorPatients(clinicId, doctorId, { page = 1, limit = 10, offset = 0, search = '' } = {}) {
    let whereClause = 'WHERE c.clinic_id = $1 AND c.doctor_id = $2';
    const params = [clinicId, doctorId];
    let idx = 3;

    if (search) {
      whereClause += ` AND (p.name ILIKE $${idx} OR p.species ILIKE $${idx} OR p.breed ILIKE $${idx} OR p.owner_name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const query = `
      SELECT 
        p.id,
        p.name,
        p.species,
        p.breed,
        p.age_years,
        p.weight_kg,
        p.owner_name,
        p.owner_contact,
        MAX(c.created_at) AS last_consultation_at,
        COUNT(c.id)::int AS consultation_count,
        COUNT(*) OVER() AS full_count
      FROM consultations c
      JOIN pets p ON p.id = c.pet_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY last_consultation_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    const totalCount = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;
    return { patients: rows, totalCount };
  }

  async findStaffById(clinicId, staffId) {
    const query = `
      SELECT id, name, email, role, phone, status, license_number, license_verified_at, created_at, last_login_at
      FROM users
      WHERE clinic_id = $1 AND id = $2;
    `;
    const { rows } = await db.query(query, [clinicId, staffId]);
    return rows[0] || null;
  }

  async updateRole(clinicId, staffId, newRole) {
    const query = `
      UPDATE users
      SET role = $3
      WHERE clinic_id = $1 AND id = $2
      RETURNING id, name, email, role, status;
    `;
    const { rows } = await db.query(query, [clinicId, staffId, newRole]);
    return rows[0] || null;
  }

  async setStatus(clinicId, staffId, status) {
    const query = `
      UPDATE users
      SET status = $3
      WHERE clinic_id = $1 AND id = $2
      RETURNING id, name, email, role, status;
    `;
    const { rows } = await db.query(query, [clinicId, staffId, status]);
    return rows[0] || null;
  }

  async approveLicense(clinicId, staffId) {
    const query = `
      UPDATE users
      SET license_verified_at = NOW(), status = 'active'
      WHERE clinic_id = $1 AND id = $2
      RETURNING id, name, email, role, license_number, license_verified_at, status;
    `;
    const { rows } = await db.query(query, [clinicId, staffId]);
    return rows[0] || null;
  }

  async createDoctor({ clinicId, name, email, passwordHash, phone = null, licenseNumber = null, specialty = null, autoVerifyLicense = true }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const licenseVerifiedAt = autoVerifyLicense ? new Date() : null;
      const userQuery = `
        INSERT INTO users (
          name, email, role, clinic_id, phone, license_number, specialty, status,
          email_verified_at, license_verified_at, created_at
        )
        VALUES ($1, $2, 'doctor', $3, $4, $5, $6, 'active', NOW(), $7, NOW())
        RETURNING id, name, email, role, clinic_id, phone, license_number, specialty, status, license_verified_at, created_at;
      `;
      const { rows } = await client.query(userQuery, [
        name.trim(),
        email.trim().toLowerCase(),
        clinicId,
        phone ? phone.trim() : null,
        licenseNumber ? licenseNumber.trim() : null,
        specialty ? specialty.trim() : null,
        licenseVerifiedAt,
      ]);
      const user = rows[0];

      await client.query(
        `INSERT INTO user_credentials (user_id, password_hash)
         VALUES ($1, $2);`,
        [user.id, passwordHash]
      );

      await client.query('COMMIT');
      return user;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new StaffRepository();

