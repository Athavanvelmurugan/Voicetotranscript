const db = require('../../db/connection');
const auditService = require('../audit/audit.service');

class OwnerPortalService {
  async getProfile(ownerId) {
    const ownerRes = await db.query(
      `SELECT o.*, c.name AS clinic_name, np.email_enabled
       FROM owners o
       LEFT JOIN clinics c ON c.id = o.clinic_id
       LEFT JOIN notification_preferences np ON np.owner_id = o.id
       WHERE o.id = $1;`,
      [ownerId]
    );

    if (ownerRes.rows.length === 0) {
      const err = new Error('Owner not found');
      err.statusCode = 404;
      throw err;
    }

    const profile = ownerRes.rows[0];

    // Fetch all affiliated care hospitals for this pet owner
    const affilRes = await db.query(
      `SELECT DISTINCT c.id, c.name, c.address, c.phone, c.is_emergency
       FROM clinics c
       WHERE c.id = $1
          OR c.id IN (
            SELECT DISTINCT a.clinic_id
            FROM appointments a
            JOIN pet_owners po ON po.pet_id = a.pet_id
            WHERE po.owner_id = $2
          )
       ORDER BY c.name ASC;`,
      [profile.clinic_id || 1, ownerId]
    );

    profile.affiliated_clinics = affilRes.rows;
    return profile;
  }

  async updatePreferences(ownerId, { emailEnabled }) {
    const res = await db.query(
      `INSERT INTO notification_preferences (owner_id, email_enabled, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (owner_id)
       DO UPDATE SET email_enabled = EXCLUDED.email_enabled, updated_at = NOW()
       RETURNING *;`,
      [ownerId, emailEnabled !== false]
    );
    return res.rows[0];
  }

  async getPets(ownerId) {
    const query = `
      SELECT p.*, po.is_primary
      FROM pet_owners po
      JOIN pets p ON p.id = po.pet_id
      WHERE po.owner_id = $1
      ORDER BY p.name ASC;
    `;
    const { rows } = await db.query(query, [ownerId]);
    return rows;
  }

  async registerPet(ownerId, { name, species, breed, ageYears, weightKg, gender, microchipId, allergies, medicalHistory }) {
    if (!name || !species) {
      const err = new Error('Pet name and species are required');
      err.statusCode = 400;
      throw err;
    }

    // Resolve owner's clinic
    const owner = await this.getProfile(ownerId);
    const clinicId = owner.clinic_id || 1;

    // 1. Insert into pets table
    const petQuery = `
      INSERT INTO pets (
        clinic_id, name, species, breed, age_years, weight_kg, sex,
        microchip_no, allergies
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const petValues = [
      clinicId,
      name.trim(),
      species.trim(),
      breed ? breed.trim() : null,
      ageYears ? parseFloat(ageYears) : null,
      weightKg ? parseFloat(weightKg) : null,
      gender || 'Unknown',
      microchipId ? microchipId.trim() : null,
      JSON.stringify(allergies ? [allergies] : []),
    ];
    const petRes = await db.query(petQuery, petValues);
    const newPet = petRes.rows[0];

    // 2. Link in pet_owners
    await db.query(
      `INSERT INTO pet_owners (pet_id, owner_id, is_primary)
       VALUES ($1, $2, TRUE);`,
      [newPet.id, ownerId]
    );

    return newPet;
  }

  async getConsultations(ownerId) {
    const query = `
      SELECT c.id, c.pet_id, c.doctor_id, c.status, c.started_at, c.ended_at,
             COALESCE(c.started_at, NOW()) AS created_at,
             p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed,
             u.name AS doctor_name,
             (
               SELECT content FROM consultation_documents cd
               WHERE cd.consultation_id = c.id AND cd.doc_type = 'client_instructions'
               ORDER BY cd.current_version DESC LIMIT 1
             ) AS owner_instructions,
             (
               SELECT content FROM consultation_documents cd
               WHERE cd.consultation_id = c.id AND cd.doc_type = 'soap_note'
               ORDER BY cd.current_version DESC LIMIT 1
             ) AS soap_summary
      FROM consultations c
      JOIN pet_owners po ON po.pet_id = c.pet_id
      JOIN pets p ON p.id = c.pet_id
      LEFT JOIN users u ON u.id = c.doctor_id
      WHERE po.owner_id = $1
      ORDER BY c.started_at DESC;
    `;
    const { rows } = await db.query(query, [ownerId]);
    return rows;
  }

  async getPrescriptions(ownerId) {
    const query = `
      SELECT cd.id AS document_id, cd.consultation_id, cd.doc_type, cd.content->>'title' AS title,
             cd.content, cd.status AS document_status, cd.created_at,
             p.id AS pet_id, p.name AS pet_name, p.species AS pet_species,
             u.name AS doctor_name, u.license_number,
             gf.id AS generated_file_id, gf.ledger_hash, gf.file_name
      FROM consultation_documents cd
      JOIN consultations c ON c.id = cd.consultation_id
      JOIN pet_owners po ON po.pet_id = c.pet_id
      JOIN pets p ON p.id = c.pet_id
      LEFT JOIN users u ON u.id = c.doctor_id
      LEFT JOIN generated_files gf ON gf.doc_id = cd.id
      WHERE po.owner_id = $1 AND cd.doc_type = 'prescription' AND cd.status = 'approved'
      ORDER BY cd.created_at DESC;
    `;
    const { rows } = await db.query(query, [ownerId]);
    return rows;
  }

  async getPendingConsent(ownerId) {
    const query = `
      SELECT c.id AS consultation_id, c.started_at, c.status,
             p.id AS pet_id, p.name AS pet_name, p.species AS pet_species,
             u.name AS doctor_name,
             ct.id AS template_id, ct.title AS template_title, ct.body_md AS template_body, ct.version AS template_version,
             rc.consent_given, rc.signed_at
      FROM consultations c
      JOIN pet_owners po ON po.pet_id = c.pet_id
      JOIN pets p ON p.id = c.pet_id
      LEFT JOIN users u ON u.id = c.doctor_id
      CROSS JOIN (
        SELECT id, title, body_md, version FROM consent_templates
        WHERE active = true AND type = 'audio_recording'
        ORDER BY version DESC LIMIT 1
      ) ct
      LEFT JOIN recording_consents rc ON rc.consultation_id = c.id
      WHERE po.owner_id = $1
        AND (rc.signed_at IS NULL OR rc.revoked_at IS NOT NULL)
        AND c.status IN ('scheduled', 'recording', 'paused', 'processing')
      ORDER BY c.started_at DESC;
    `;
    const { rows } = await db.query(query, [ownerId]);
    return rows;
  }

  async signConsent(ownerId, { consultationId, templateId, signatureType, signatureData }) {
    if (!consultationId) {
      const err = new Error('consultationId is required');
      err.statusCode = 400;
      throw err;
    }

    // Verify pet ownership
    const verifyOwnership = await db.query(
      `SELECT c.id, c.clinic_id, c.pet_id, p.name AS pet_name
       FROM consultations c
       JOIN pet_owners po ON po.pet_id = c.pet_id
       JOIN pets p ON p.id = c.pet_id
       WHERE c.id = $1 AND po.owner_id = $2;`,
      [consultationId, ownerId]
    );

    if (verifyOwnership.rows.length === 0) {
      const err = new Error('Unauthorized: Pet guardian does not own the patient for this visit');
      err.statusCode = 403;
      throw err;
    }

    const consult = verifyOwnership.rows[0];

    // Fetch active template version
    const templateRes = await db.query(
      'SELECT id, version FROM consent_templates WHERE id = $1',
      [templateId || 1]
    );
    const templateVersion = templateRes.rows.length > 0 ? templateRes.rows[0].version : 1;

    // Insert or update recording_consents (SERIAL ID, NO UUID)
    const upsertQuery = `
      INSERT INTO recording_consents (
        clinic_id, consultation_id, given_by, consent_method,
        template_id, template_version, signed_by_owner_id,
        signature_type, signature_data, signed_at
      )
      VALUES ($1, $2, 'Pet Guardian (Portal)', 'portal_digital', $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (consultation_id)
      DO UPDATE SET
        clinic_id = EXCLUDED.clinic_id,
        given_by = 'Pet Guardian (Portal)',
        consent_method = 'portal_digital',
        template_id = EXCLUDED.template_id,
        template_version = EXCLUDED.template_version,
        signed_by_owner_id = EXCLUDED.signed_by_owner_id,
        signature_type = EXCLUDED.signature_type,
        signature_data = EXCLUDED.signature_data,
        signed_at = NOW(),
        revoked_at = NULL
      RETURNING *;
    `;

    const values = [
      consult.clinic_id || 1,
      consultationId,
      templateId || 1,
      templateVersion,
      ownerId,
      signatureType || 'canvas_drawing',
      signatureData || 'Digital Signature Stored',
    ];

    const { rows } = await db.query(upsertQuery, values);
    const consent = rows[0];

    // Log to immutable cryptographic audit ledger
    await auditService.logChainedEvent({
      consultationId,
      clinicId: consult.clinic_id,
      eventType: 'consent_granted',
      actorId: ownerId,
      actorType: 'system',
      payloadSnapshot: {
        method: 'portal_digital',
        ownerId,
        templateVersion,
        signatureType: signatureType || 'canvas_drawing',
        timestamp: new Date().toISOString(),
      },
    });

    return consent;
  }

  async getAvailableSlots(clinicId, date, doctorId = null) {
    const schedulingService = require('../scheduling/scheduling.service');
    const targetDate = date || new Date().toISOString().split('T')[0];
    return schedulingService.getAvailableSlots(clinicId || 1, doctorId || null, targetDate);
  }

  /**
   * List all active hospitals for pet owner selection
   */
  async getHospitals() {
    const query = `
      SELECT c.id, c.name, c.slug, c.timezone, c.status, c.address, c.phone, c.is_emergency,
             COUNT(DISTINCT u.id) AS doctor_count
      FROM clinics c
      LEFT JOIN users u ON u.clinic_id = c.id AND u.role IN ('doctor', 'veterinarian') AND u.status = 'active'
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY c.is_emergency DESC, c.name ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  /**
   * List all doctors inside a selected hospital
   */
  async getHospitalDoctors(clinicId) {
    const query = `
      SELECT u.id, u.name, u.email, u.license_number, u.role, u.specialty,
             c.name AS clinic_name
      FROM users u
      JOIN clinics c ON c.id = u.clinic_id
      WHERE u.clinic_id = $1 AND u.role IN ('doctor', 'veterinarian') AND u.status = 'active'
      ORDER BY u.name ASC;
    `;
    const { rows } = await db.query(query, [clinicId]);
    return rows;
  }

  async bookAppointment(ownerId, { clinicId, petId, doctorId, appointmentDate, startTime, endTime, reason, durationMin = 15 }) {
    // Verify pet belongs to owner
    const ownership = await db.query(
      'SELECT pet_id FROM pet_owners WHERE pet_id = $1 AND owner_id = $2',
      [petId, ownerId]
    );
    if (ownership.rows.length === 0) {
      const err = new Error('You may only book appointments for your registered pets');
      err.statusCode = 403;
      throw err;
    }

    const scheduledAt = appointmentDate && startTime
      ? new Date(`${appointmentDate}T${startTime}:00Z`).toISOString()
      : new Date().toISOString();

    const schedulingService = require('../scheduling/scheduling.service');
    return schedulingService.createAppointment(
      clinicId || 1,
      {
        pet_id: petId,
        doctor_id: doctorId || null,
        scheduled_at: scheduledAt,
        duration_min: durationMin || 15,
        type: 'general_checkup',
        reason: reason || 'Routine Checkup',
        source: 'owner_portal',
        status: 'scheduled',
      },
      null,
      { userAgent: 'pet_owner_portal' }
    );
  }

  /**
   * Affiliation lifecycle: Pet owner affiliates with a hospital & doctor, agreeing to consent terms
   */
  async affiliateHospital(ownerId, { clinicId, doctorId, consentAgreed }) {
    if (!clinicId) {
      const err = new Error('Hospital ID is required for clinical affiliation');
      err.statusCode = 400;
      throw err;
    }

    // Update owner's primary clinic
    await db.query(
      'UPDATE owners SET clinic_id = $1, updated_at = NOW() WHERE id = $2',
      [clinicId, ownerId]
    );

    // Also update any of owner's pets to be associated with this clinic
    await db.query(
      `UPDATE pets SET clinic_id = $1, updated_at = NOW()
       WHERE id IN (SELECT pet_id FROM pet_owners WHERE owner_id = $2)`,
      [clinicId, ownerId]
    );

    // Record digital consent if agreed
    if (consentAgreed) {
      await db.query(
        `INSERT INTO owner_consents (owner_id, clinic_id, consent_type, agreed, agreed_at)
         VALUES ($1, $2, 'hospital_affiliation_consent', true, NOW())
         ON CONFLICT DO NOTHING`,
        [ownerId, clinicId]
      ).catch(() => {}); // Graceful if table optional
    }

    return {
      success: true,
      affiliatedClinicId: clinicId,
      doctorId: doctorId || null,
      message: 'Successfully affiliated with hospital and attending veterinarian.'
    };
  }

  /**
   * Remove / Disaffiliate from a hospital and attending doctor
   */
  async removeAffiliation(ownerId) {
    await db.query(
      'UPDATE owners SET clinic_id = NULL, updated_at = NOW() WHERE id = $1',
      [ownerId]
    );

    return {
      success: true,
      message: 'Hospital affiliation cleanly disassociated.'
    };
  }

  /**
   * Update guardian profile
   */
  async updateProfile(ownerId, { name, phone, address }) {
    const res = await db.query(
      `UPDATE owners
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           address = COALESCE($3, address),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *;`,
      [name, phone, address, ownerId]
    );
    return res.rows[0];
  }

  /**
   * Update pet details
   */
  async updatePet(ownerId, petId, { name, weightKg, ageYears, allergies, chronicConditions }) {
    // Verify ownership
    const ownership = await db.query(
      'SELECT pet_id FROM pet_owners WHERE pet_id = $1 AND owner_id = $2',
      [petId, ownerId]
    );
    if (ownership.rows.length === 0) {
      const err = new Error('Pet not found or unauthorized');
      err.statusCode = 403;
      throw err;
    }

    const res = await db.query(
      `UPDATE pets
       SET name = COALESCE($1, name),
           weight_kg = COALESCE($2, weight_kg),
           age_years = COALESCE($3, age_years),
           allergies = COALESCE($4, allergies),
           chronic_conditions = COALESCE($5, chronic_conditions),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *;`,
      [
        name,
        weightKg ? parseFloat(weightKg) : null,
        ageYears ? parseFloat(ageYears) : null,
        allergies ? JSON.stringify(Array.isArray(allergies) ? allergies : [allergies]) : null,
        chronicConditions ? JSON.stringify(Array.isArray(chronicConditions) ? chronicConditions : [chronicConditions]) : null,
        petId
      ]
    );
    return res.rows[0];
  }

  /**
   * Get booked appointments for owner's pets with pagination and search
   */
  async getOwnerAppointments(ownerId, { page = 1, limit = 10, offset = 0, search = '', status = '' } = {}) {
    let whereClause = `WHERE po.owner_id = $1`;
    const params = [ownerId];
    let pIdx = 2;

    if (search.trim()) {
      whereClause += ` AND (p.name ILIKE $${pIdx} OR u.name ILIKE $${pIdx} OR a.reason ILIKE $${pIdx})`;
      params.push(`%${search.trim()}%`);
      pIdx++;
    }

    if (status) {
      whereClause += ` AND a.status = $${pIdx}`;
      params.push(status);
      pIdx++;
    }

    const query = `
      SELECT a.*,
             p.name AS pet_name, p.species, p.breed,
             u.name AS doctor_name,
             c.name AS clinic_name,
             COUNT(*) OVER() AS full_count
      FROM appointments a
      JOIN pet_owners po ON po.pet_id = a.pet_id
      JOIN pets p ON p.id = a.pet_id
      LEFT JOIN users u ON u.id = a.doctor_id
      LEFT JOIN clinics c ON c.id = a.clinic_id
      ${whereClause}
      ORDER BY a.scheduled_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;
    params.push(limit, offset);

    const { rows } = await db.query(query, params);
    const totalCount = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;
    return { appointments: rows, totalCount };
  }
}

module.exports = new OwnerPortalService();
