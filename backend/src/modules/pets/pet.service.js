const repo = require('./pet.repository');
const { logAuditEvent } = require('../audit-viewer/audit.event.logger');

class PetService {
  async getPets(clinicId, options = {}) {
    return repo.getPets(clinicId, options);
  }

  async getPetById(clinicId, id) {
    const pet = await repo.findById(clinicId, id);
    if (!pet) {
      const err = new Error(`Patient #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return pet;
  }

  async getClinicalChart(clinicId, id) {
    const chart = await repo.getClinicalChart(clinicId, id);
    if (!chart) {
      const err = new Error(`Patient #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return chart;
  }

  async createPet(clinicId, data, actorId, reqInfo = {}) {
    const pet = await repo.create(clinicId, data);
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'patient_created',
      targetType: 'pet',
      targetId: pet.id,
      metadata: { name: pet.name, species: pet.species, allergiesCount: (pet.allergies || []).length },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });
    return pet;
  }

  async updatePet(clinicId, id, fields, actorId, reqInfo = {}) {
    const updated = await repo.update(clinicId, id, fields);
    if (!updated) {
      const err = new Error(`Patient #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'patient_updated',
      targetType: 'pet',
      targetId: id,
      metadata: { fieldsUpdated: Object.keys(fields) },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });
    return updated;
  }
}

module.exports = new PetService();

