const docRepo = require('../documents/document.repository');
const auditService = require('../audit/audit.service');

class ApprovalService {
  async approveDocument(documentId, doctorId) {
    const doc = await docRepo.findById(documentId);
    if (!doc) {
      const err = new Error(`Document #${documentId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (doc.status === 'approved') {
      return doc; // Idempotent approval
    }

    const updated = await docRepo.updateStatus(documentId, 'approved');

    // Record formal approval
    await docRepo.recordApproval({
      documentId,
      doctorId,
      action: 'approved',
      versionNumber: doc.current_version,
      reason: 'Veterinarian verified and authorized clinical document',
    });

    // Record immutable version marker
    await docRepo.createVersion({
      documentId,
      versionNumber: doc.current_version,
      content: doc.content,
      changedBy: doctorId,
      changeType: 'approved',
      changeSummary: 'Document officially approved and locked by attending veterinarian',
    });

    await auditService.log({
      consultationId: doc.consultation_id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'document_approved',
      entityType: 'consultation_document',
      entityId: documentId,
      beforeState: { status: doc.status },
      afterState: { status: 'approved', version: doc.current_version },
    });

    return updated;
  }

  async rejectDocument(documentId, doctorId, reason) {
    const doc = await docRepo.findById(documentId);
    if (!doc) {
      const err = new Error(`Document #${documentId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (!reason) {
      const err = new Error('Rejection reason must be provided for clinical audit compliance');
      err.statusCode = 400;
      throw err;
    }

    const updated = await docRepo.updateStatus(documentId, 'rejected');

    await docRepo.recordApproval({
      documentId,
      doctorId,
      action: 'rejected',
      versionNumber: doc.current_version,
      reason,
    });

    await docRepo.createVersion({
      documentId,
      versionNumber: doc.current_version,
      content: doc.content,
      changedBy: doctorId,
      changeType: 'rejected',
      changeSummary: `Rejected: ${reason}`,
    });

    await auditService.log({
      consultationId: doc.consultation_id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'document_rejected',
      entityType: 'consultation_document',
      entityId: documentId,
      beforeState: { status: doc.status },
      afterState: { status: 'rejected', reason },
    });

    return updated;
  }
}

module.exports = new ApprovalService();

