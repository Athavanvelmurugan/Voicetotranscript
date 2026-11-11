const repo = require('./settings.repository');
const { logAuditEvent } = require('../audit-viewer/audit.event.logger');

class SettingsService {
  async getSettings(clinicId) {
    return repo.getSettings(clinicId);
  }

  async updateSettings(clinicId, fields, actorId, reqInfo = {}) {
    const updated = await repo.updateSettings(clinicId, fields);
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'clinic_settings_updated',
      targetType: 'clinic_settings',
      targetId: String(clinicId),
      metadata: { fieldsUpdated: Object.keys(fields) },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });
    return updated;
  }
}

module.exports = new SettingsService();

