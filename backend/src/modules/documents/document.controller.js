const crypto = require('crypto');
const fs = require('fs');
const documentService = require('./document.service');
const approvalService = require('../approvals/approval.service');
const consultationService = require('../consultations/consultation.service');
const clinicalExtractor = require('../clinical-ai/clinical.extractor');
const transcriptAccumulator = require('../transcription/transcript.accumulator');
const pdfService = require('../pdf-generator/pdf.service');
const notificationService = require('../notifications/notification.service');
const db = require('../../db/connection');

class DocumentController {
  getDoctorId(req) {
    return req.user?.id || 1;
  }

  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doc = await documentService.getDocument(id);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const { content, doctorNotes } = req.body;

      if (!content) {
        return res.status(400).json({ success: false, error: 'Document content is required' });
      }

      const updated = await documentService.updateDocument(id, { content, doctorNotes }, doctorId);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async approve(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const approved = await approvalService.approveDocument(id, doctorId);
      res.json({ success: true, data: approved });
    } catch (err) {
      next(err);
    }
  }

  async reject(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const { reason } = req.body;
      const rejected = await approvalService.rejectDocument(id, doctorId, reason);
      res.json({ success: true, data: rejected });
    } catch (err) {
      next(err);
    }
  }

  async getVersions(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const versions = await documentService.getVersions(id);
      res.json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }

  async getByConsultation(req, res, next) {
    try {
      const consultationId = parseInt(req.params.consultationId, 10);
      if (isNaN(consultationId)) {
        return res.status(400).json({ success: false, error: 'Invalid consultation ID' });
      }

      const tenantContext = req.user ? {
        clinicId: req.user.clinicId,
        role: req.user.role,
        userId: req.user.id,
      } : null;

      // Strictly verify doctor/clinic ownership before returning documents
      await consultationService.getConsultation(consultationId, tenantContext);

      const docs = await documentService.getDocumentsForConsultation(consultationId);
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  }

  async generate(req, res, next) {
    try {
      const consultationId = parseInt(req.params.consultationId, 10);
      if (isNaN(consultationId)) {
        return res.status(400).json({ success: false, error: 'Invalid consultation ID' });
      }
      const doctorId = this.getDoctorId(req);

      const tenantContext = req.user ? {
        clinicId: req.user.clinicId,
        role: req.user.role,
        userId: req.user.id,
      } : null;

      // Strictly verify doctor/clinic ownership before AI extraction and generation
      const consultation = await consultationService.getConsultation(consultationId, tenantContext);
      const { fullText } = await transcriptAccumulator.getCompleteTranscript(consultationId);

      // Perform Clinical AI extraction
      const extraction = await clinicalExtractor.extractAndValidate(consultation, fullText);

      // Generate all 5 documents from the single extraction
      const docs = await documentService.generateAllDocuments(consultationId, extraction, doctorId);

      // Transition consultation to completed
      await consultationService.getConsultation(consultationId);
      const consultationRepo = require('../consultations/consultation.repository');
      await consultationRepo.updateStatus(consultationId, 'completed');

      res.status(201).json({
        success: true,
        data: {
          extractionId: extraction.id,
          documents: docs,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async generatePdf(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const result = await pdfService.generateSignedDocumentPdf(id, doctorId);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async downloadPdf(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);

      // Check if file exists in generated_files
      let fileRes = await db.query(
        'SELECT * FROM generated_files WHERE doc_id = $1 ORDER BY id DESC LIMIT 1',
        [id]
      );

      let fileRecord;
      if (fileRes.rows.length === 0) {
        // Generate on-the-fly if not generated yet
        const generated = await pdfService.generateSignedDocumentPdf(id, doctorId);
        fileRecord = generated.fileRecord;
      } else {
        fileRecord = fileRes.rows[0];
      }

      if (!fs.existsSync(fileRecord.storage_path)) {
        // Regenerate if file was pruned or missing on disk
        const generated = await pdfService.generateSignedDocumentPdf(id, doctorId);
        fileRecord = generated.fileRecord;
      }

      res.download(fileRecord.storage_path, fileRecord.file_name);
    } catch (err) {
      next(err);
    }
  }

  async sendToOwner(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);

      const doc = await documentService.getDocument(id);
      if (!doc) {
        return res.status(404).json({ success: false, error: `Document #${id} not found` });
      }

      const consultation = await consultationService.getConsultation(doc.consultation_id);
      
      // Ensure PDF is generated
      let fileRes = await db.query(
        'SELECT * FROM generated_files WHERE doc_id = $1 ORDER BY id DESC LIMIT 1',
        [id]
      );
      if (fileRes.rows.length === 0) {
        await pdfService.generateSignedDocumentPdf(id, doctorId);
      }

      // Generate a secure share link (expires in 30 days)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO share_links (doc_id, token_hash, expires_at)
         VALUES ($1, $2, $3);`,
        [id, tokenHash, expiresAt]
      );

      // Find owner recipient
      let ownerEmail = consultation.owner_contact && consultation.owner_contact.includes('@')
        ? consultation.owner_contact
        : null;
      let ownerId = null;

      const ownerLookup = await db.query(
        `SELECT o.id, o.email FROM owners o
         JOIN pet_owners po ON po.owner_id = o.id
         WHERE po.pet_id = $1 LIMIT 1;`,
        [consultation.pet_id]
      );

      if (ownerLookup.rows.length > 0) {
        ownerId = ownerLookup.rows[0].id;
        if (!ownerEmail && ownerLookup.rows[0].email) {
          ownerEmail = ownerLookup.rows[0].email;
        }
      }

      if (!ownerEmail) {
        ownerEmail = 'owner@example.com'; // Default staging fallback
      }

      const notification = await notificationService.sendDocumentsReady({
        clinicId: consultation.clinic_id || 1,
        ownerId,
        recipient: ownerEmail,
        ownerName: consultation.owner_name || 'Pet Guardian',
        petName: consultation.pet_name || 'Your Pet',
        consultationId: consultation.id,
        docTitle: doc.title || doc.doc_type,
      });

      res.json({
        success: true,
        message: 'Document dispatched to pet owner via email',
        data: {
          recipient: ownerEmail,
          notificationId: notification?.id,
          shareExpiresAt: expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentController();

