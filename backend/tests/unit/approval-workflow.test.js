const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const documentService = require('../../src/modules/documents/document.service');
const approvalService = require('../../src/modules/approvals/approval.service');
const consultationService = require('../../src/modules/consultations/consultation.service');
const clinicalExtractor = require('../../src/modules/clinical-ai/clinical.extractor');

describe('Document Approval & Immutability Workflow', () => {
  let testConsultation;
  let testDocs;

  before(async () => {
    // Create a consultation for testing
    testConsultation = await consultationService.createConsultation({
      petId: 1,
      appointmentId: 1,
      language: 'en',
      consentGiven: true,
    }, 1);

    // Save a mock transcript segment
    await consultationService.saveSegment({
      consultationId: testConsultation.id,
      sequenceNumber: 1,
      text: 'Bella has kennel cough symptoms. Prescribe Doxycycline 100mg twice daily for 10 days.',
      isPartial: false,
      speakerRole: 'doctor',
    });

    // Extract & generate documents
    const extraction = await clinicalExtractor.extractAndValidate(testConsultation, 'Prescribe Doxycycline 100mg');
    testDocs = await documentService.generateAllDocuments(testConsultation.id, extraction, 1);
  });

  it('should initialize documents in draft state with version 1', () => {
    assert.equal(testDocs.length, 5);
    const rxDoc = testDocs.find(d => d.doc_type === 'prescription');
    assert.equal(rxDoc.status, 'draft');
    assert.equal(rxDoc.current_version, 1);
  });

  it('should allow doctor to edit draft document and increment version to 2', async () => {
    const rxDoc = testDocs.find(d => d.doc_type === 'prescription');
    const updatedContent = { ...rxDoc.content, doctor_notes: 'Verified safe with patient medical history.' };

    const edited = await documentService.updateDocument(rxDoc.id, {
      content: updatedContent,
      doctorNotes: 'Added safety verification note',
    }, 1);

    assert.equal(edited.current_version, 2);
    assert.equal(edited.status, 'needs_review');

    const versions = await documentService.getVersions(rxDoc.id);
    assert.ok(versions.length >= 2);
  });

  it('should approve document independently and lock its status to approved', async () => {
    const rxDoc = testDocs.find(d => d.doc_type === 'prescription');
    const approved = await approvalService.approveDocument(rxDoc.id, 1);

    assert.equal(approved.status, 'approved');
  });

  it('SAFETY RULE: should prevent editing an approved document (immutability check)', async () => {
    const rxDoc = testDocs.find(d => d.doc_type === 'prescription');

    await assert.rejects(
      async () => {
        await documentService.updateDocument(rxDoc.id, {
          content: { ...rxDoc.content, hacked: true },
          doctorNotes: 'Illegal alteration attempt',
        }, 1);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'IMMUTABLE_APPROVED_DOCUMENT');
        return true;
      }
    );
  });

  it('should allow rejecting a document with a mandatory reason', async () => {
    const labDoc = testDocs.find(d => d.doc_type === 'lab_tests');
    const rejected = await approvalService.rejectDocument(labDoc.id, 1, 'Owner declined optional blood panel due to cost.');

    assert.equal(rejected.status, 'rejected');
  });

  it('should require a rejection reason for audit compliance', async () => {
    const soapDoc = testDocs.find(d => d.doc_type === 'soap_notes');

    await assert.rejects(
      async () => {
        await approvalService.rejectDocument(soapDoc.id, 1, '');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});

