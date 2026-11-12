const db = require('../../db/connection');

class DocumentRepository {
  async upsertDocument({
    consultationId,
    extractionId,
    docType,
    status = 'draft',
    content = {},
    missingFields = [],
    aiConfidence = 1.0,
    clinicId = null,
  }) {
    const query = `
      INSERT INTO consultation_documents (
        consultation_id, extraction_id, doc_type, status, content, missing_fields, ai_confidence, current_version, clinic_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 1,
        COALESCE($8::int, (SELECT clinic_id FROM consultations WHERE id = $1), 1)
      )
      ON CONFLICT (consultation_id, doc_type)
      DO UPDATE SET
        extraction_id = EXCLUDED.extraction_id,
        status = CASE 
          WHEN consultation_documents.status = 'approved' THEN consultation_documents.status 
          ELSE EXCLUDED.status 
        END,
        content = CASE 
          WHEN consultation_documents.status = 'approved' THEN consultation_documents.content 
          ELSE EXCLUDED.content 
        END,
        missing_fields = EXCLUDED.missing_fields,
        ai_confidence = EXCLUDED.ai_confidence,
        clinic_id = COALESCE(EXCLUDED.clinic_id, consultation_documents.clinic_id),
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      consultationId,
      extractionId || null,
      docType,
      status,
      JSON.stringify(content),
      JSON.stringify(missingFields),
      aiConfidence,
      clinicId || null,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async findByConsultation(consultationId) {
    const query = `
      SELECT *
      FROM consultation_documents
      WHERE consultation_id = $1
      ORDER BY id ASC;
    `;
    const { rows } = await db.query(query, [consultationId]);
    return rows;
  }

  async findById(id) {
    const query = `
      SELECT d.*, c.doctor_id, c.pet_id
      FROM consultation_documents d
      JOIN consultations c ON d.consultation_id = c.id
      WHERE d.id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  async updateContent(id, content, doctorNotes, nextVersion) {
    const query = `
      UPDATE consultation_documents
      SET 
        content = $2,
        doctor_notes = $3,
        current_version = $4,
        status = 'needs_review',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, JSON.stringify(content), doctorNotes, nextVersion]);
    return rows[0];
  }

  async updateStatus(id, status) {
    const query = `
      UPDATE consultation_documents
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, status]);
    return rows[0];
  }

  async createVersion({ documentId, versionNumber, content, changedBy, changeType, changeSummary, clinicId = null }) {
    const query = `
      INSERT INTO document_versions (document_id, version_number, content, changed_by, change_type, change_summary, clinic_id)
      VALUES (
        $1, $2, $3, $4, $5, $6,
        COALESCE($7::int, (SELECT clinic_id FROM consultation_documents WHERE id = $1), 1)
      )
      ON CONFLICT (document_id, version_number)
      DO UPDATE SET
        content = EXCLUDED.content,
        change_summary = EXCLUDED.change_summary,
        clinic_id = COALESCE(EXCLUDED.clinic_id, document_versions.clinic_id)
      RETURNING *;
    `;
    const values = [
      documentId,
      versionNumber,
      JSON.stringify(content),
      changedBy,
      changeType,
      changeSummary || null,
      clinicId || null,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async getVersions(documentId) {
    const query = `
      SELECT v.*, u.name AS changed_by_name
      FROM document_versions v
      JOIN users u ON v.changed_by = u.id
      WHERE v.document_id = $1
      ORDER BY v.version_number DESC;
    `;
    const { rows } = await db.query(query, [documentId]);
    return rows;
  }

  async recordApproval({ documentId, doctorId, action, versionNumber, reason, clinicId = null }) {
    const query = `
      INSERT INTO document_approvals (document_id, doctor_id, action, version_number, reason, clinic_id)
      VALUES (
        $1, $2, $3, $4, $5,
        COALESCE($6::int, (SELECT clinic_id FROM consultation_documents WHERE id = $1), 1)
      )
      RETURNING *;
    `;
    const values = [documentId, doctorId, action, versionNumber, reason || null, clinicId || null];
    const { rows } = await db.query(query, values);
    return rows[0];
  }
}

module.exports = new DocumentRepository();

