const db = require('../../db/connection');

class ConsultationRepository {
  async create({ appointmentId, petId, doctorId, clinicId = 1, language = 'en', consentGiven = false }) {
    const query = `
      INSERT INTO consultations (appointment_id, pet_id, doctor_id, clinic_id, language, consent_given, consent_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
      RETURNING *;
    `;
    const values = [
      appointmentId || null,
      petId,
      doctorId,
      clinicId,
      language,
      consentGiven,
      consentGiven ? new Date() : null,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async findById(id) {
    const query = `
      SELECT 
        c.*,
        p.name AS pet_name,
        p.species AS pet_species,
        p.breed AS pet_breed,
        p.age_years AS pet_age,
        p.weight_kg AS pet_weight,
        p.allergies AS pet_allergies,
        p.chronic_conditions AS pet_chronic_conditions,
        p.microchip_no AS pet_microchip_no,
        p.owner_name,
        p.owner_contact,
        u.name AS doctor_name,
        u.email AS doctor_email,
        a.scheduled_at AS appointment_time,
        a.reason AS appointment_reason
      FROM consultations c
      JOIN pets p ON c.pet_id = p.id
      JOIN users u ON c.doctor_id = u.id
      LEFT JOIN appointments a ON c.appointment_id = a.id
      WHERE c.id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  async updateStatus(id, status, extraFields = {}) {
    const allowed = ['started_at', 'paused_at', 'ended_at', 'audio_duration_seconds', 'audio_file_path'];
    const sets = ['status = $2', 'updated_at = NOW()'];
    const values = [id, status];

    let paramIdx = 3;
    for (const key of allowed) {
      if (extraFields[key] !== undefined) {
        sets.push(`${key} = $${paramIdx++}`);
        values.push(extraFields[key]);
      }
    }

    const query = `
      UPDATE consultations
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async updateDoctor(id, doctorId) {
    const query = `
      UPDATE consultations
      SET doctor_id = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, doctorId]);
    return rows[0] || null;
  }

  async recordConsent({ consultationId, givenBy, ipAddress = null, userAgent = null, clinicId = null }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const consentQuery = `
        INSERT INTO recording_consents (consultation_id, given_by, ip_address, user_agent, clinic_id)
        VALUES ($1, $2, $3, $4, COALESCE($5::int, (SELECT clinic_id FROM consultations WHERE id = $1), 1))
        ON CONFLICT (consultation_id) 
        DO UPDATE SET
          given_by = EXCLUDED.given_by,
          clinic_id = COALESCE(EXCLUDED.clinic_id, recording_consents.clinic_id),
          created_at = NOW()
        RETURNING *;
      `;
      const consentRes = await client.query(consentQuery, [consultationId, givenBy, ipAddress, userAgent, clinicId || null]);

      const consultQuery = `
        UPDATE consultations
        SET consent_given = true, consent_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      const consultRes = await client.query(consultQuery, [consultationId]);

      await client.query('COMMIT');
      return { consent: consentRes.rows[0], consultation: consultRes.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async insertTranscriptSegment({
    consultationId,
    sequenceNumber,
    text,
    isPartial = false,
    speakerRole = 'unknown',
    languageDetected = 'en',
    confidence = 1.0,
    startMs = 0,
    endMs = 0,
    source = 'openai_realtime',
    passNumber = 1,
    isFinalPass = true,
    model = null,
    provider = null,
    promptVersion = null,
    params = {},
    avgLogprob = null,
    noSpeechProb = null,
    needsVetReview = false,
    clinicId = null,
  }) {
    const query = `
      INSERT INTO transcript_segments 
        (consultation_id, sequence_number, text, is_partial, speaker_role, language_detected, confidence, start_ms, end_ms, source, pass_number, is_final_pass, model, provider, prompt_version, params, avg_logprob, no_speech_prob, needs_vet_review, clinic_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, COALESCE($20::int, (SELECT clinic_id FROM consultations WHERE id = $1), 1))
      ON CONFLICT (consultation_id, pass_number, sequence_number, is_partial)
      DO UPDATE SET 
        text = EXCLUDED.text,
        speaker_role = EXCLUDED.speaker_role,
        confidence = EXCLUDED.confidence,
        end_ms = EXCLUDED.end_ms,
        model = EXCLUDED.model,
        provider = EXCLUDED.provider,
        avg_logprob = EXCLUDED.avg_logprob,
        no_speech_prob = EXCLUDED.no_speech_prob,
        needs_vet_review = EXCLUDED.needs_vet_review,
        clinic_id = COALESCE(EXCLUDED.clinic_id, transcript_segments.clinic_id)
      RETURNING *;
    `;
    const values = [
      consultationId,
      sequenceNumber,
      text,
      isPartial,
      speakerRole,
      languageDetected,
      confidence,
      startMs,
      endMs,
      source,
      passNumber,
      isFinalPass,
      model,
      provider,
      promptVersion,
      JSON.stringify(params),
      avgLogprob,
      noSpeechProb,
      needsVetReview,
      clinicId || null,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async findAll(options = {}) {
    let clinicId = null;
    let doctorId = null;

    if (typeof options === 'number' || typeof options === 'string') {
      clinicId = parseInt(options, 10);
    } else if (options && typeof options === 'object') {
      clinicId = options.clinicId ? parseInt(options.clinicId, 10) : null;
      doctorId = options.doctorId ? parseInt(options.doctorId, 10) : null;
    }

    let whereClause = '';
    const conditions = [];
    const params = [];
    let idx = 1;

    if (clinicId) {
      conditions.push(`c.clinic_id = $${idx++}`);
      params.push(clinicId);
    }

    if (doctorId) {
      conditions.push(`c.doctor_id = $${idx++}`);
      params.push(doctorId);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const query = `
      SELECT 
        c.*,
        p.name AS pet_name,
        p.species AS pet_species,
        p.breed AS pet_breed,
        p.age_years AS pet_age,
        p.weight_kg AS pet_weight,
        p.allergies AS pet_allergies,
        p.chronic_conditions AS pet_chronic_conditions,
        p.microchip_no AS pet_microchip_no,
        p.owner_name,
        p.owner_contact,
        u.name AS doctor_name,
        u.email AS doctor_email,
        a.scheduled_at AS appointment_time,
        a.reason AS appointment_reason
      FROM consultations c
      JOIN pets p ON c.pet_id = p.id
      JOIN users u ON c.doctor_id = u.id
      LEFT JOIN appointments a ON c.appointment_id = a.id
      ${whereClause}
      ORDER BY c.id DESC;
    `;
    const { rows } = await db.query(query, params);
    return rows;
  }

  async getPets(clinicId = null) {
    let whereClause = '';
    const params = [];
    if (clinicId) {
      whereClause = 'WHERE clinic_id = $1';
      params.push(clinicId);
    }
    const query = `SELECT * FROM pets ${whereClause} ORDER BY id ASC;`;
    const { rows } = await db.query(query, params);
    return rows;
  }

  async resetStatus(id) {
    const query = `
      UPDATE consultations
      SET status = 'scheduled', started_at = null, paused_at = null, ended_at = null, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  async getTranscriptSegments(consultationId, includePartial = false) {
    const query = `
      SELECT *
      FROM transcript_segments
      WHERE consultation_id = $1
        ${includePartial ? '' : 'AND is_partial = false'}
      ORDER BY sequence_number ASC;
    `;
    const { rows } = await db.query(query, [consultationId]);
    return rows;
  }
}

module.exports = new ConsultationRepository();

