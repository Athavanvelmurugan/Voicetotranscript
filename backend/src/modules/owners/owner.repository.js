const db = require('../../db/connection');

class OwnerRepository {
  async getOwners(clinicId, search = '') {
    let whereClause = 'WHERE o.clinic_id = $1';
    const params = [clinicId];

    if (search && search.trim()) {
      whereClause += ' AND (o.name ILIKE $2 OR o.phone ILIKE $2 OR o.email ILIKE $2)';
      params.push(`%${search.trim()}%`);
    }

    const query = `
      SELECT 
        o.id,
        o.name,
        o.phone,
        o.email,
        o.address,
        o.preferred_language,
        o.created_at,
        COUNT(DISTINCT po.pet_id)::int AS pet_count,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', p.id, 'name', p.name, 'species', p.species)) 
          FILTER (WHERE p.id IS NOT NULL), 
          '[]'
        ) AS pets
      FROM owners o
      LEFT JOIN pet_owners po ON po.owner_id = o.id
      LEFT JOIN pets p ON p.id = po.pet_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.name ASC;
    `;
    const { rows } = await db.query(query, params);
    return rows;
  }

  async findById(clinicId, id) {
    const query = `
      SELECT 
        o.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', p.id, 
            'name', p.name, 
            'species', p.species, 
            'breed', p.breed, 
            'allergies', p.allergies,
            'chronic_conditions', p.chronic_conditions
          )) FILTER (WHERE p.id IS NOT NULL), 
          '[]'
        ) AS pets
      FROM owners o
      LEFT JOIN pet_owners po ON po.owner_id = o.id
      LEFT JOIN pets p ON p.id = po.pet_id
      WHERE o.clinic_id = $1 AND o.id = $2
      GROUP BY o.id;
    `;
    const { rows } = await db.query(query, [clinicId, id]);
    return rows[0] || null;
  }

  async create(clinicId, { name, phone, email = null, address = null, preferredLanguage = 'en' }) {
    const query = `
      INSERT INTO owners (clinic_id, name, phone, email, address, preferred_language)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [clinicId, name.trim(), phone.trim(), email ? email.trim() : null, address ? address.trim() : null, preferredLanguage];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async update(clinicId, id, fields) {
    const allowed = ['name', 'phone', 'email', 'address', 'preferred_language'];
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
      UPDATE owners
      SET ${sets.join(', ')}
      WHERE clinic_id = $1 AND id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, values);
    return rows[0] || null;
  }

  async mergeOwners(clinicId, primaryId, duplicateId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Move all pet links from duplicate to primary
      await client.query(
        `INSERT INTO pet_owners (pet_id, owner_id, is_primary)
         SELECT pet_id, $1, false FROM pet_owners WHERE owner_id = $2
         ON CONFLICT (pet_id, owner_id) DO NOTHING;`,
        [primaryId, duplicateId]
      );

      // 2. Delete pet_owners references for duplicate
      await client.query('DELETE FROM pet_owners WHERE owner_id = $1;', [duplicateId]);

      // 3. Delete duplicate owner record
      await client.query('DELETE FROM owners WHERE clinic_id = $1 AND id = $2;', [clinicId, duplicateId]);

      await client.query('COMMIT');
      return this.findById(clinicId, primaryId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new OwnerRepository();

