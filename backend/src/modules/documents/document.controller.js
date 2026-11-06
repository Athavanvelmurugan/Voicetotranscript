const documentService = require('./document.service');
const approvalService = require('../approvals/approval.service');
const consultationService = require('../consultations/consultation.service');
const clinicalExtractor = require('../clinical-ai/clinical.extractor');
const transcriptAccumulator = require('../transcription/transcript.accumulator');

class DocumentController {
  getDoctorId(req) {
    return parseInt(req.headers['x-doctor-id'], 10) || req.user?.id || 1;
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
      const docs = await documentService.getDocumentsForConsultation(consultationId);
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  }

  async generate(req, res, next) {
    try {
      const consultationId = parseInt(req.params.consultationId, 10);
      const doctorId = this.getDoctorId(req);

      const consultation = await consultationService.getConsultation(consultationId);
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
}

module.exports = new DocumentController();

