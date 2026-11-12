const db = require('../../db/connection');

class PetRepository {
  async getPets(clinicId, { page = 1, limit = 10, offset = 0, ownerId = null, search = '', species = '' } = {}) {
    let whereClause = `WHERE (p.clinic_id = $1 OR EXISTS (
      SELECT 1 FROM pet_practice_links ppl WHERE ppl.pet_id = p.id AND ppl.clinic_id = $1 AND ppl.status = 'ACTIVE'
    ))`;
    const params = [clinicId];
    let idx = 2;

    if (ownerId) {
      whereClause += ` AND po.owner_id = $${idx++}`;
      params.push(ownerId);
    }

    if (species && species !== 'ALL') {
      whereClause += ` AND p.species ILIKE $${idx++}`;
      params.push(`%${species}%`);
    }

    if (search && search.trim()) {
      whereClause += ` AND (p.name ILIKE $${idx} OR p.breed ILIKE $${idx} OR p.microchip_no ILIKE $${idx} OR o.name ILIKE $${idx} OR p.species ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const query = `
      SELECT 
        p.id,
        p.clinic_id,
        p.name,
        p.species,
        p.breed,
        p.sex,
        p.dob,
        p.age_years,
        p.weight_kg,
        p.microchip_no,
        p.allergies,
        p.chronic_conditions,
        p.photo_key,
        p.created_at,
        o.id AS owner_id,
        o.name AS owner_name,
        o.phone AS owner_phone,
        COUNT(c.id)::int AS consultation_count,
        COUNT(*) OVER() AS full_count
      FROM pets p
      LEFT JOIN pet_owners po ON po.pet_id = p.id AND po.is_primary = true
      LEFT JOIN owners o ON o.id = po.owner_id
      LEFT JOIN consultations c ON c.pet_id = p.id
      ${whereClause}
      GROUP BY p.id, o.id
      ORDER BY p.name ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    const totalCount = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;
    return { pets: rows, totalCount };
  }

  async findById(clinicId, id) {
    const query = `
      SELECT 
        p.*,
        o.id AS owner_id,
        o.name AS owner_name,
        o.phone AS owner_phone,
        o.email AS owner_email,
        COUNT(c.id)::int AS consultation_count
      FROM pets p
      LEFT JOIN pet_owners po ON po.pet_id = p.id AND po.is_primary = true
      LEFT JOIN owners o ON o.id = po.owner_id
      LEFT JOIN consultations c ON c.pet_id = p.id
      WHERE (p.clinic_id = $1 OR EXISTS (
        SELECT 1 FROM pet_practice_links ppl WHERE ppl.pet_id = p.id AND ppl.clinic_id = $1 AND ppl.status = 'ACTIVE'
      )) AND p.id = $2
      GROUP BY p.id, o.id;
    `;
    const { rows } = await db.query(query, [clinicId, id]);
    return rows[0] || null;
  }

  async create(clinicId, {
    name,
    species,
    breed = null,
    sex = 'Unknown',
    dob = null,
    age_years = null,
    weight_kg = null,
    microchip_no = null,
    allergies = [],
    chronic_conditions = [],
    owner_id = null,
    owner_name = null,
    owner_contact = null,
    owner_phone = null,
    owner_email = null,
  }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const contactVal = owner_contact || owner_phone || owner_email || null;

      const insertPet = `
        INSERT INTO pets (clinic_id, name, species, breed, sex, dob, age_years, weight_kg, microchip_no, allergies, chronic_conditions, owner_name, owner_contact)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;
      const petVals = [
        clinicId,
        name.trim(),
        species.trim(),
        breed ? breed.trim() : null,
        sex,
        dob || null,
        age_years ? parseFloat(age_years) : null,
        weight_kg ? parseFloat(weight_kg) : null,
        microchip_no ? microchip_no.trim() : null,
        JSON.stringify(allergies || []),
        JSON.stringify(chronic_conditions || []),
        owner_name ? owner_name.trim() : null,
        contactVal ? contactVal.trim() : null,
      ];

      const petRes = await client.query(insertPet, petVals);
      const pet = petRes.rows[0];

      let linkedOwnerId = owner_id;
      if (!linkedOwnerId && owner_name && owner_name.trim()) {
        // owners.phone is VARCHAR(20) NOT NULL; never store long emails in phone
        const rawPhone = (owner_phone && owner_phone.trim())
          || (owner_contact && !owner_contact.includes('@') ? owner_contact.trim() : '');
        const resolvedPhone = rawPhone ? rawPhone.slice(0, 20) : 'Unspecified';
        const resolvedEmail = (owner_email && owner_email.trim())
          || (owner_contact && owner_contact.includes('@') ? owner_contact.trim() : null);

        const ownerRes = await client.query(
          `INSERT INTO owners (clinic_id, name, phone, email)
           VALUES ($1, $2, $3, $4)
           RETURNING id;`,
          [clinicId, owner_name.trim(), resolvedPhone, resolvedEmail]
        );
        if (ownerRes.rows.length > 0) {
          linkedOwnerId = ownerRes.rows[0].id;
        }
      }

      // Link to owner if provided or created
      if (linkedOwnerId) {
        await client.query(
          `INSERT INTO pet_owners (pet_id, owner_id, is_primary)
           VALUES ($1, $2, true)
           ON CONFLICT (pet_id, owner_id) DO NOTHING;`,
          [pet.id, linkedOwnerId]
        );
      }

      // Link pet to practice via pet_practice_links
      await client.query(
        `INSERT INTO pet_practice_links (pet_id, practice_id, clinic_id, status)
         SELECT $1, pr.id, pr.clinic_id, 'ACTIVE'
         FROM practices pr WHERE pr.clinic_id = $2
         ON CONFLICT (pet_id, practice_id) DO UPDATE SET status = 'ACTIVE';`,
        [pet.id, clinicId]
      );

      await client.query('COMMIT');
      return this.findById(clinicId, pet.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(clinicId, id, fields) {
    const allowed = ['name', 'species', 'breed', 'sex', 'dob', 'age_years', 'weight_kg', 'microchip_no', 'allergies', 'chronic_conditions', 'photo_key'];
    const sets = [];
    const values = [clinicId, id];
    let idx = 3;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        if (key === 'allergies' || key === 'chronic_conditions') {
          values.push(JSON.stringify(fields[key]));
        } else {
          values.push(fields[key]);
        }
      }
    }

    if (sets.length === 0) return this.findById(clinicId, id);

    const query = `
      UPDATE pets
      SET ${sets.join(', ')}
      WHERE (clinic_id = $1 OR EXISTS (
        SELECT 1 FROM pet_practice_links ppl WHERE ppl.pet_id = pets.id AND ppl.clinic_id = $1 AND ppl.status = 'ACTIVE'
      )) AND id = $2
      RETURNING *;
    `;
    await db.query(query, values);
    return this.findById(clinicId, id);
  }

  async getClinicalChart(clinicId, petId) {
    // 1. Get pet info with owner
    const pet = await this.findById(clinicId, petId);
    if (!pet) return null;

    // 2. Get past consultations
    const consultQuery = `
      SELECT 
        c.id, c.appointment_id, c.doctor_id, c.status, c.started_at, c.ended_at, c.created_at,
        u.name AS doctor_name, u.email AS doctor_email
      FROM consultations c
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE c.clinic_id = $1 AND c.pet_id = $2
      ORDER BY c.created_at DESC;
    `;
    const { rows: consultations } = await db.query(consultQuery, [clinicId, petId]);

    // 3. Get AI Summaries from consultation_documents
    const summaryQuery = `
      SELECT 
        cd.id, cd.consultation_id, cd.status, cd.content, cd.created_at,
        c.created_at AS consultation_date, u.name AS doctor_name
      FROM consultation_documents cd
      JOIN consultations c ON cd.consultation_id = c.id
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE c.clinic_id = $1 AND c.pet_id = $2 AND cd.doc_type = 'summary'
      ORDER BY cd.created_at DESC;
    `;
    const { rows: summaries } = await db.query(summaryQuery, [clinicId, petId]);

    // 4. Get Prescriptions from consultation_documents
    const prescriptionQuery = `
      SELECT 
        cd.id, cd.consultation_id, cd.status, cd.content, cd.doctor_notes, cd.created_at,
        c.created_at AS consultation_date, u.name AS doctor_name
      FROM consultation_documents cd
      JOIN consultations c ON cd.consultation_id = c.id
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE c.clinic_id = $1 AND c.pet_id = $2 AND cd.doc_type = 'prescription'
      ORDER BY cd.created_at DESC;
    `;
    const { rows: prescriptions } = await db.query(prescriptionQuery, [clinicId, petId]);

    // 5. Get clinical extractions
    const extractionQuery = `
      SELECT 
        ce.id, ce.consultation_id, ce.chief_complaints, ce.symptoms, ce.diagnoses,
        ce.medications, ce.vitals, ce.created_at
      FROM clinical_extractions ce
      JOIN consultations c ON ce.consultation_id = c.id
      WHERE c.clinic_id = $1 AND c.pet_id = $2
      ORDER BY ce.created_at DESC
      LIMIT 5;
    `;
    const { rows: extractions } = await db.query(extractionQuery, [clinicId, petId]);

    // 6. Build chronological timeline
    const timeline = [];
    consultations.forEach((c) => {
      timeline.push({
        id: `consult-${c.id}`,
        type: 'consultation',
        title: `Consultation #${c.id} (${c.status})`,
        description: `Attending Doctor: ${c.doctor_name || 'Veterinarian'}`,
        timestamp: c.created_at,
        metadata: { consultationId: c.id, status: c.status },
      });
    });
    summaries.forEach((s) => {
      let desc = 'Visit summary compiled.';
      if (typeof s.content === 'object' && s.content?.summary) {
        desc = typeof s.content.summary === 'string' ? s.content.summary.slice(0, 160) + '...' : 'Visit summary compiled.';
      } else if (typeof s.content === 'string') {
        desc = s.content.slice(0, 160) + '...';
      }
      timeline.push({
        id: `summary-${s.id}`,
        type: 'ai_summary',
        title: `AI Clinical Summary Generated (Consultation #${s.consultation_id})`,
        description: desc,
        timestamp: s.created_at,
        metadata: { documentId: s.id, consultationId: s.consultation_id },
      });
    });
    prescriptions.forEach((p) => {
      timeline.push({
        id: `rx-${p.id}`,
        type: 'prescription',
        title: `Prescription Issued (Consultation #${p.consultation_id})`,
        description: p.doctor_notes || 'Prescription drafted & authorized.',
        timestamp: p.created_at,
        metadata: { documentId: p.id, consultationId: p.consultation_id },
      });
    });

    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      patient: pet,
      consultations,
      summaries,
      prescriptions,
      extractions,
      timeline,
      latestSummary: summaries[0] || null,
      latestExtraction: extractions[0] || null,
    };
  }
}

module.exports = new PetRepository();

