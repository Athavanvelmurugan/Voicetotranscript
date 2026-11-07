const repo = require('./consultation.repository');
const auditService = require('../audit/audit.service');

class ConsultationService {
  async getAllConsultations() {
    return repo.findAll();
  }

  async getAllPets() {
    return repo.getPets();
  }

  async resetConsultation(id, doctorId) {
    await this.getConsultation(id);
    const updated = await repo.resetStatus(id);

    await auditService.log({
      consultationId: id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'consultation_reset',
      entityType: 'consultation',
      entityId: id,
      afterState: { status: 'scheduled' },
    });

    return repo.findById(id);
  }

  async createConsultation(data, doctorId) {
    const consultation = await repo.create({
      ...data,
      doctorId,
    });

    await auditService.log({
      consultationId: consultation.id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'consultation_created',
      entityType: 'consultation',
      entityId: consultation.id,
      afterState: consultation,
    });

    return repo.findById(consultation.id);
  }

  async updateConsultationDoctor(id, doctorId, actorId) {
    const beforeConsultation = await this.getConsultation(id);
    await repo.updateDoctor(id, doctorId);
    const updated = await this.getConsultation(id);

    await auditService.log({
      consultationId: id,
      actorId: actorId || doctorId,
      actorType: 'doctor',
      action: 'consultation_doctor_reassigned',
      entityType: 'consultation',
      entityId: id,
      beforeState: { doctor_id: beforeConsultation.doctor_id, doctor_name: beforeConsultation.doctor_name },
      afterState: { doctor_id: updated.doctor_id, doctor_name: updated.doctor_name },
    });

    return updated;
  }

  async getConsultation(id) {
    const consultation = await repo.findById(id);
    if (!consultation) {
      const error = new Error(`Consultation #${id} not found`);
      error.statusCode = 404;
      throw error;
    }
    return consultation;
  }

  async recordConsent(id, { givenBy, ipAddress, userAgent }, doctorId) {
    const consultation = await this.getConsultation(id);
    const result = await repo.recordConsent({
      consultationId: id,
      givenBy,
      ipAddress,
      userAgent,
    });

    await auditService.log({
      consultationId: id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'recording_consent_granted',
      entityType: 'recording_consent',
      entityId: result.consent.id,
      afterState: result.consent,
      ipAddress,
    });

    return result;
  }

  async startRecording(id, doctorId) {
    const consultation = await this.getConsultation(id);

    if (!consultation.consent_given) {
      const error = new Error('Recording consent must be granted before starting consultation audio capture.');
      error.statusCode = 403;
      throw error;
    }

    const updated = await repo.updateStatus(id, 'recording', {
      started_at: consultation.started_at || new Date(),
      paused_at: null,
    });

    await auditService.log({
      consultationId: id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'recording_started',
      entityType: 'consultation',
      entityId: id,
      beforeState: { status: consultation.status },
      afterState: { status: updated.status },
    });

    return updated;
  }

  async pauseRecording(id, doctorId) {
    const consultation = await this.getConsultation(id);
    if (consultation.status !== 'recording') {
      const error = new Error(`Cannot pause a consultation in '${consultation.status}' state.`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await repo.updateStatus(id, 'paused', {
      paused_at: new Date(),
    });

    await auditService.log({
      consultationId: id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'recording_paused',
      entityType: 'consultation',
      entityId: id,
      beforeState: { status: consultation.status },
      afterState: { status: updated.status },
    });

    return updated;
  }

  async resumeRecording(id, doctorId) {
    const consultation = await this.getConsultation(id);
    if (consultation.status !== 'paused') {
      const error = new Error(`Cannot resume a consultation in '${consultation.status}' state.`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await repo.updateStatus(id, 'recording', {
      paused_at: null,
    });

    await auditService.log({
      consultationId: id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'recording_resumed',
      entityType: 'consultation',
      entityId: id,
      beforeState: { status: consultation.status },
      afterState: { status: updated.status },
    });

    return updated;
  }

  async stopRecording(id, doctorId, { audioDurationSeconds = 0 } = {}) {
    const consultation = await this.getConsultation(id);
    if (!['recording', 'paused'].includes(consultation.status)) {
      const error = new Error(`Cannot stop a consultation with status '${consultation.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    const started = new Date(consultation.started_at || Date.now());
    const duration = audioDurationSeconds || Math.round((Date.now() - started.getTime()) / 1000);

    const updated = await repo.updateStatus(id, 'processing', {
      ended_at: new Date(),
      audio_duration_seconds: duration,
    });

    await auditService.log({
      consultationId: id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'recording_stopped',
      entityType: 'consultation',
      entityId: id,
      beforeState: { status: consultation.status },
      afterState: { status: updated.status, duration },
    });

    return updated;
  }

  async saveSegment(segmentData) {
    return repo.insertTranscriptSegment(segmentData);
  }

  async getTranscript(consultationId, includePartial = false) {
    await this.getConsultation(consultationId);
    return repo.getTranscriptSegments(consultationId, includePartial);
  }

  async completeConsultation(id, doctorId) {
    const consultation = await this.getConsultation(id);

    if (consultation.status === 'draft_only_unverified' || consultation.draft_only_unverified === true) {
      const error = new Error('Cannot complete consultation: Final transcription pass failed. Record is flagged draft_only_unverified and sign-off is blocked.');
      error.statusCode = 422;
      error.code = 'SIGN_OFF_BLOCKED';
      throw error;
    }

    const updated = await repo.updateStatus(id, 'completed', {
      ended_at: consultation.ended_at || new Date(),
    });

    await auditService.log({
      consultationId: id,
      actorId: doctorId,
      actorType: 'doctor',
      action: 'consultation_completed',
      entityType: 'consultation',
      entityId: id,
      beforeState: { status: consultation.status },
      afterState: { status: 'completed' },
    });

    return updated;
  }
}

module.exports = new ConsultationService();

