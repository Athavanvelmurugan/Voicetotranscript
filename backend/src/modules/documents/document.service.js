const repo = require('./document.repository');
const consultationRepo = require('../consultations/consultation.repository');
const db = require('../../db/connection');
const auditService = require('../audit/audit.service');

const PrescriptionBuilder = require('../templates/prescription.builder');
const LabTestsBuilder = require('../templates/lab-tests.builder');
const SoapNotesBuilder = require('../templates/soap-notes.builder');
const FollowUpBuilder = require('../templates/follow-up.builder');
const SummaryBuilder = require('../templates/summary.builder');

class DocumentService {
  async generateAllDocuments(consultationId, extractionRecord, doctorId) {
    const consultation = await consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new Error(`Consultation #${consultationId} not found`);
    }

    const extraction = extractionRecord.raw_extraction || extractionRecord;

    // Build the 5 clinical documents
    const docDefinitions = [
      {
        docType: 'prescription',
        builder: () => PrescriptionBuilder.build(extraction, consultation),
      },
      {
        docType: 'lab_tests',
        builder: () => LabTestsBuilder.build(extraction, consultation),
      },
      {
        docType: 'soap_notes',
        builder: () => SoapNotesBuilder.build(extraction, consultation),
      },
      {
        docType: 'follow_up',
        builder: () => FollowUpBuilder.build(extraction, consultation),
      },
      {
        docType: 'summary',
        builder: () => SummaryBuilder.build(extraction, consultation),
      },
    ];

    const generatedDocs = [];

    for (const def of docDefinitions) {
      const docData = def.builder();

      // Upsert document (won't overwrite if already approved)
      const doc = await repo.upsertDocument({
        consultationId,
        extractionId: extractionRecord.id,
        docType: def.docType,
        status: 'draft',
        content: docData,
        missingFields: docData.missing_fields || [],
        aiConfidence: 0.98,
      });

      // Insert Initial Version 1
      await repo.createVersion({
        documentId: doc.id,
        versionNumber: doc.current_version,
        content: doc.content,
        changedBy: doctorId || consultation.doctor_id,
        changeType: 'ai_generated',
        changeSummary: 'Initial AI clinical scribe draft generated from consultation transcript',
      });

      await auditService.log({
        consultationId,
        actorType: 'ai',
        action: 'document_generated',
        entityType: 'consultation_document',
        entityId: doc.id,
        metadata: { docType: def.docType, version: doc.current_version },
      });

      generatedDocs.push(doc);
    }

    return generatedDocs;
  }

  async getDocument(id) {
    const doc = await repo.findById(id);
    if (!doc) {
      const err = new Error(`Document #${id} not found`);
      err.statusCode = 404;
      throw err;
    }
    return doc;
  }

  async getDocumentsForConsultation(consultationId) {
    return repo.findByConsultation(consultationId);
  }

  async updateDocument(id, { content, doctorNotes }, doctorId) {
    const doc = await this.getDocument(id);

    // SAFETY RULE: Never automatically or directly edit approved documents
    if (doc.status === 'approved') {
      const error = new Error('Approved medical records are immutable. To make changes, reject the document first or request a formal amendment.');
      error.statusCode = 403;
      error.code = 'IMMUTABLE_APPROVED_DOCUMENT';
      throw error;
    }

    const nextVersion = doc.current_version + 1;
    const updated = await repo.updateContent(id, content, doctorNotes, nextVersion);

    // Record new version in version history
    await repo.createVersion({
      documentId: id,
      versionNumber: nextVersion,
      content,
      changedBy: doctorId,
      changeType: 'doctor_edit',
      changeSummary: doctorNotes || `Doctor manual edit (v${nextVersion})`,
    });

    await auditService.log({
      consultationId: doc.consultation_id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'document_edited',
      entityType: 'consultation_document',
      entityId: id,
      beforeState: { version: doc.current_version, status: doc.status },
      afterState: { version: nextVersion, status: updated.status },
    });

    return updated;
  }

  async getVersions(id) {
    await this.getDocument(id);
    return repo.getVersions(id);
  }
}

module.exports = new DocumentService();

