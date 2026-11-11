const repo = require('./owner.repository');
const { logAuditEvent } = require('../audit-viewer/audit.event.logger');

class OwnerService {
  async getOwners(clinicId, search = '') {
    return repo.getOwners(clinicId, search);
  }

  async getOwnerById(clinicId, id) {
    const owner = await repo.findById(clinicId, id);
    if (!owner) {
      const err = new Error(`Owner #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return owner;
  }

  async createOwner(clinicId, data, actorId, reqInfo = {}) {
    const owner = await repo.create(clinicId, data);
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'owner_created',
      targetType: 'owner',
      targetId: owner.id,
      metadata: { name: owner.name, phone: owner.phone },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });
    return owner;
  }

  async updateOwner(clinicId, id, fields, actorId, reqInfo = {}) {
    const updated = await repo.update(clinicId, id, fields);
    if (!updated) {
      const err = new Error(`Owner #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'owner_updated',
      targetType: 'owner',
      targetId: id,
      metadata: { fieldsUpdated: Object.keys(fields) },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });
    return updated;
  }

  async mergeOwners(clinicId, primaryId, duplicateId, actorId, reqInfo = {}) {
    if (primaryId === duplicateId) {
      const err = new Error('Cannot merge an owner with themselves.');
      err.statusCode = 400;
      throw err;
    }

    const merged = await repo.mergeOwners(clinicId, primaryId, duplicateId);
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'owners_merged',
      targetType: 'owner',
      targetId: primaryId,
      metadata: { duplicateOwnerId: duplicateId },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });
    return merged;
  }
}

module.exports = new OwnerService();

