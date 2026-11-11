const db = require('../../db/connection');

class SchedulingRepository {
  async getAppointments(clinicId, { page = 1, limit = 10, offset = 0, search = '', doctorId = null, startDate = null, endDate = null, status = null } = {}) {
    let whereClause = 'WHERE a.clinic_id = $1';
    const params = [clinicId];
    let idx = 2;

    if (doctorId) {
      whereClause += ` AND a.doctor_id = $${idx++}`;
      params.push(doctorId);
    }

    if (startDate) {
      whereClause += ` AND a.scheduled_at >= $${idx++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND a.scheduled_at <= $${idx++}`;
      params.push(endDate);
    }

    if (status && status !== 'all') {
      whereClause += ` AND a.status = $${idx++}`;
      params.push(status);
    }

    if (search && search.trim()) {
      whereClause += ` AND (p.name ILIKE $${idx} OR p.species ILIKE $${idx} OR d.name ILIKE $${idx} OR o.name ILIKE $${idx} OR a.reason ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const query = `
      SELECT 
        a.id,
        a.clinic_id,
        a.pet_id,
        a.doctor_id,
        a.scheduled_at,
        a.status,
        a.reason,
        a.type,
        a.duration_min,
        a.source,
        a.cancelled_reason,
        a.created_at,
        p.name AS pet_name,
        p.species AS pet_species,
        p.breed AS pet_breed,
        p.allergies AS pet_allergies,
        p.chronic_conditions AS pet_chronic_conditions,
        d.name AS doctor_name,
        d.email AS doctor_email,
        o.id AS owner_id,
        o.name AS owner_name,
        o.phone AS owner_phone,
        COUNT(*) OVER() AS full_count
      FROM appointments a
      LEFT JOIN pets p ON p.id = a.pet_id
      LEFT JOIN users d ON d.id = a.doctor_id
      LEFT JOIN pet_owners po ON po.pet_id = p.id AND po.is_primary = true
      LEFT JOIN owners o ON o.id = po.owner_id
      ${whereClause}
      ORDER BY a.scheduled_at ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const { rows } = await db.query(query, params);
    const totalCount = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;
    return { appointments: rows, totalCount };
  }

  async findById(clinicId, id) {
    const query = `
      SELECT 
        a.id,
        a.clinic_id,
        a.pet_id,
        a.doctor_id,
        a.scheduled_at,
        a.status,
        a.reason,
        a.type,
        a.duration_min,
        a.source,
        a.cancelled_reason,
        a.created_at,
        p.name AS pet_name,
        p.species AS pet_species,
        p.breed AS pet_breed,
        p.allergies AS pet_allergies,
        p.chronic_conditions AS pet_chronic_conditions,
        d.name AS doctor_name,
        d.email AS doctor_email,
        o.id AS owner_id,
        o.name AS owner_name,
        o.phone AS owner_phone
      FROM appointments a
      LEFT JOIN pets p ON p.id = a.pet_id
      LEFT JOIN users d ON d.id = a.doctor_id
      LEFT JOIN pet_owners po ON po.pet_id = p.id AND po.is_primary = true
      LEFT JOIN owners o ON o.id = po.owner_id
      WHERE a.clinic_id = $1 AND a.id = $2;
    `;
    const { rows } = await db.query(query, [clinicId, id]);
    return rows[0] || null;
  }

  async getDoctorAppointmentsForRange(clinicId, doctorId, startIso, endIso) {
    const query = `
      SELECT 
        a.id,
        a.scheduled_at,
        a.duration_min,
        a.status,
        a.reason,
        p.name AS pet_name
      FROM appointments a
      LEFT JOIN pets p ON p.id = a.pet_id
      WHERE a.clinic_id = $1 
        AND a.doctor_id = $2
        AND a.scheduled_at >= $3 
        AND a.scheduled_at <= $4
        AND a.status != 'cancelled'
      ORDER BY a.scheduled_at ASC;
    `;
    const { rows } = await db.query(query, [clinicId, doctorId, startIso, endIso]);
    return rows;
  }

  async create(clinicId, {
    pet_id,
    doctor_id,
    scheduled_at,
    duration_min = 15,
    type = 'general_checkup',
    reason = '',
    source = 'desk',
    status = 'scheduled'
  }) {
    const query = `
      INSERT INTO appointments (
        clinic_id, pet_id, doctor_id, scheduled_at, duration_min, type, reason, source, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      clinicId,
      pet_id,
      doctor_id,
      scheduled_at,
      duration_min,
      type,
      reason,
      source,
      status,
    ];
    const { rows } = await db.query(query, values);
    return this.findById(clinicId, rows[0].id);
  }

  async update(clinicId, id, fields) {
    const allowed = ['doctor_id', 'scheduled_at', 'duration_min', 'type', 'reason', 'status', 'cancelled_reason'];
    const sets = [];
    const values = [clinicId, id];
    let idx = 3;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        values.push(fields[key]);
      }
    }

    if (sets.length === 0) return this.findById(clinicId, id);

    const query = `
      UPDATE appointments
      SET ${sets.join(', ')}
      WHERE clinic_id = $1 AND id = $2
      RETURNING *;
    `;
    await db.query(query, values);
    return this.findById(clinicId, id);
  }

  async getDoctorAvailability(clinicId, doctorId) {
    const query = `
      SELECT *
      FROM doctor_availability
      WHERE clinic_id = $1 AND doctor_id = $2 AND is_active = true
      ORDER BY weekday ASC, start_time ASC;
    `;
    const { rows } = await db.query(query, [clinicId, doctorId]);
    return rows;
  }

  async setDoctorAvailability(clinicId, doctorId, blocks) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      // Deactivate or delete current
      await client.query('DELETE FROM doctor_availability WHERE clinic_id = $1 AND doctor_id = $2', [clinicId, doctorId]);

      for (const b of blocks) {
        await client.query(
          `INSERT INTO doctor_availability (clinic_id, doctor_id, weekday, start_time, end_time, slot_minutes, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [clinicId, doctorId, b.weekday, b.start_time, b.end_time, b.slot_minutes || 15, b.is_active !== false]
        );
      }

      await client.query('COMMIT');
      return this.getDoctorAvailability(clinicId, doctorId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getTodayQueue(clinicId, doctorId, startOfDay, endOfDay) {
    let whereClause = `WHERE a.clinic_id = $1 AND a.scheduled_at >= $2 AND a.scheduled_at <= $3`;
    const params = [clinicId, startOfDay, endOfDay];

    if (doctorId) {
      whereClause += ` AND a.doctor_id = $4`;
      params.push(doctorId);
    }

    const query = `
      SELECT 
        a.id,
        a.clinic_id,
        a.pet_id,
        a.doctor_id,
        a.scheduled_at,
        a.status,
        a.reason,
        a.type,
        a.duration_min,
        p.name AS pet_name,
        p.species AS pet_species,
        p.breed AS pet_breed,
        p.allergies AS pet_allergies,
        p.chronic_conditions AS pet_chronic_conditions,
        p.photo_key AS pet_photo_key,
        o.id AS owner_id,
        o.name AS owner_name,
        o.phone AS owner_phone,
        d.name AS doctor_name,
        c.id AS active_consultation_id
      FROM appointments a
      LEFT JOIN pets p ON p.id = a.pet_id
      LEFT JOIN users d ON d.id = a.doctor_id
      LEFT JOIN pet_owners po ON po.pet_id = p.id AND po.is_primary = true
      LEFT JOIN owners o ON o.id = po.owner_id
      LEFT JOIN consultations c ON c.appointment_id = a.id AND c.status = 'in_progress'
      ${whereClause}
      ORDER BY a.scheduled_at ASC;
    `;
    const { rows } = await db.query(query, params);
    return rows;
  }
}

module.exports = new SchedulingRepository();

