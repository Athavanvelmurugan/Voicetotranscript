const repo = require('./scheduling.repository');
const engine = require('./scheduling.engine');
const { logAuditEvent } = require('../audit-viewer/audit.event.logger');

class SchedulingService {
  async getAppointments(clinicId, filters) {
    return repo.getAppointments(clinicId, filters);
  }

  async getAppointmentById(clinicId, id) {
    const apt = await repo.findById(clinicId, id);
    if (!apt) {
      const err = new Error(`Appointment #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return apt;
  }

  async createAppointment(clinicId, data, actorId, reqInfo = {}) {
    const { doctor_id, scheduled_at, duration_min = 15 } = data;

    if (doctor_id && scheduled_at) {
      const start = new Date(scheduled_at);
      // Look back and forward 24h around the appointment to check for overlap
      const rangeStart = new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const rangeEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const existing = await repo.getDoctorAppointmentsForRange(clinicId, doctor_id, rangeStart, rangeEnd);
      const conflict = engine.detectConflict(existing, start, duration_min);

      if (conflict) {
        const err = new Error(`Time slot conflict: Doctor already has an appointment (#${conflict.id}) at ${new Date(conflict.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
        err.statusCode = 409;
        throw err;
      }
    }

    const apt = await repo.create(clinicId, data);

    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'appointment_scheduled',
      targetType: 'appointment',
      targetId: apt.id,
      metadata: { petId: apt.pet_id, doctorId: apt.doctor_id, scheduledAt: apt.scheduled_at, durationMin: apt.duration_min },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return apt;
  }

  async updateAppointment(clinicId, id, fields, actorId, reqInfo = {}) {
    const current = await this.getAppointmentById(clinicId, id);

    // If rescheduling, check for conflicts
    const doctorId = fields.doctor_id || current.doctor_id;
    const scheduledAt = fields.scheduled_at || current.scheduled_at;
    const durationMin = fields.duration_min || current.duration_min;

    if (fields.scheduled_at || fields.doctor_id || fields.duration_min) {
      const start = new Date(scheduledAt);
      const rangeStart = new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const rangeEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const existing = await repo.getDoctorAppointmentsForRange(clinicId, doctorId, rangeStart, rangeEnd);
      const conflict = engine.detectConflict(existing, start, durationMin, id);

      if (conflict) {
        const err = new Error(`Time slot conflict: Doctor already has an appointment (#${conflict.id}) at ${new Date(conflict.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
        err.statusCode = 409;
        throw err;
      }
    }

    const updated = await repo.update(clinicId, id, fields);

    const action = fields.status === 'cancelled' ? 'appointment_cancelled' : 'appointment_updated';
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action,
      targetType: 'appointment',
      targetId: id,
      metadata: { fieldsUpdated: Object.keys(fields), status: updated.status },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async getDoctorAvailability(clinicId, doctorId) {
    return repo.getDoctorAvailability(clinicId, doctorId);
  }

  async setDoctorAvailability(clinicId, doctorId, blocks, actorId, reqInfo = {}) {
    const saved = await repo.setDoctorAvailability(clinicId, doctorId, blocks);
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'doctor_availability_updated',
      targetType: 'user',
      targetId: doctorId,
      metadata: { blockCount: blocks.length },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });
    return saved;
  }

  async getAvailableSlots(clinicId, doctorId, dateStr) {
    // dateStr format: YYYY-MM-DD
    const dateObj = new Date(dateStr);
    const weekday = dateObj.getUTCDay(); // 0 is Sunday, 6 is Saturday

    let blocks = await repo.getDoctorAvailability(clinicId, doctorId);
    blocks = blocks.filter((b) => b.weekday === weekday);

    // If no custom blocks for doctor on this day, fallback to default 09:00 - 17:00
    if (blocks.length === 0) {
      blocks = [{
        start_time: '09:00:00',
        end_time: '17:00:00',
        slot_minutes: 15,
      }];
    }

    const dayStartIso = `${dateStr}T00:00:00Z`;
    const dayEndIso = `${dateStr}T23:59:59Z`;
    const appointments = await repo.getDoctorAppointmentsForRange(clinicId, doctorId, dayStartIso, dayEndIso);

    return engine.generateSlotsForDate(dateStr, blocks, appointments);
  }

  async getTodayQueue(clinicId, doctorId = null) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfDay = `${todayStr}T00:00:00.000Z`;
    const endOfDay = `${todayStr}T23:59:59.999Z`;

    return repo.getTodayQueue(clinicId, doctorId, startOfDay, endOfDay);
  }
}

module.exports = new SchedulingService();

