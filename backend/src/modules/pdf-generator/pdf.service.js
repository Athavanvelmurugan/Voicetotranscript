const db = require('../../db/connection');
const pdfEngine = require('./pdf.engine');
const auditService = require('../audit/audit.service');
const consultationRepo = require('../consultations/consultation.repository');
const docRepo = require('../documents/document.repository');
const ownerRepo = require('../owners/owner.repository');

class PdfService {
  async generateSignedDocumentPdf(docId, actorId) {
    const doc = await docRepo.findById(docId);
    if (!doc) {
      const err = new Error(`Document #${docId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const consultation = await consultationRepo.findById(doc.consultation_id);
    if (!consultation) {
      const err = new Error(`Consultation #${doc.consultation_id} not found`);
      err.statusCode = 404;
      throw err;
    }

    // Resolve clinic details
    const clinicRes = await db.query('SELECT * FROM clinics WHERE id = $1', [consultation.clinic_id || 1]);
    const clinic = clinicRes.rows[0] || { id: 1, name: 'Central Valley Animal Hospital' };

    // Resolve attending doctor
    const doctorRes = await db.query('SELECT id, name, email, license_number FROM users WHERE id = $1', [doc.changed_by || consultation.doctor_id]);
    const doctor = doctorRes.rows[0] || { name: consultation.doctor_name || 'Dr. Attending', license_number: 'VET-ACTIVE-99' };

    // Resolve patient details
    const patientRes = await db.query('SELECT * FROM pets WHERE id = $1', [consultation.pet_id]);
    const patient = patientRes.rows[0] || { name: consultation.pet_name, species: consultation.pet_species, breed: consultation.pet_breed };

    // Resolve primary owner details
    let owner = { name: consultation.owner_name, phone: consultation.owner_contact };
    const ownerRes = await db.query(
      `SELECT o.* FROM owners o
       JOIN pet_owners po ON po.owner_id = o.id AND po.is_primary = true
       WHERE po.pet_id = $1 LIMIT 1;`,
      [consultation.pet_id]
    );
    if (ownerRes.rows.length > 0) {
      owner = ownerRes.rows[0];
    }

    // 1. Append cryptographic block to audit ledger
    const ledgerBlock = await auditService.logChainedEvent({
      consultationId: consultation.id,
      clinicId: consultation.clinic_id,
      eventType: 'document_pdf_issued',
      actorId,
      actorType: 'doctor',
      payloadSnapshot: {
        docId: doc.id,
        docType: doc.doc_type,
        version: doc.current_version,
        patientName: patient.name,
      },
    });

    const ledgerHash = ledgerBlock.current_hash;

    // 2. Generate PDF via PDFKit Engine with embedded verification QR code
    const generated = await pdfEngine.generateClinicalPdf({
      clinic,
      doctor,
      patient,
      owner,
      consultation,
      document: doc,
      ledgerHash,
    });

    // 3. Save into generated_files (SERIAL PK, NO UUID)
    const insertQuery = `
      INSERT INTO generated_files (
        clinic_id, consultation_id, doc_id, type, file_name, storage_path, sha256, ledger_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      consultation.clinic_id,
      consultation.id,
      doc.id,
      `${doc.doc_type}_pdf`,
      generated.fileName,
      generated.filePath,
      generated.sha256,
      ledgerHash,
    ];
    const { rows } = await db.query(insertQuery, values);
    const fileRecord = rows[0];

    return {
      fileRecord,
      sha256: generated.sha256,
      ledgerHash,
      fileName: generated.fileName,
      filePath: generated.filePath,
      verifyUrl: generated.verifyUrl,
    };
  }

  async getFileByDocId(docId) {
    const query = `
      SELECT * FROM generated_files 
      WHERE doc_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [docId]);
    return rows[0] || null;
  }

  async getFileById(fileId) {
    const query = `SELECT * FROM generated_files WHERE id = $1;`;
    const { rows } = await db.query(query, [fileId]);
    return rows[0] || null;
  }
}

module.exports = new PdfService();
