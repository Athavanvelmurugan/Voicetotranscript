const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const consultationController = require('../../src/modules/consultations/consultation.controller');
const consultationService = require('../../src/modules/consultations/consultation.service');

describe('Consultation Controller Doctor Reassign Unit Tests', () => {
  function createMockRes() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
  }

  it('should return 400 when consultation ID is invalid', async () => {
    const req = {
      params: { id: 'abc' },
      body: { doctorId: 1 },
      headers: {},
    };
    const res = createMockRes();
    const next = () => {};

    await consultationController.updateDoctor(req, res, next);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'A valid integer consultation ID is required');
  });

  it('should return 400 when doctorId is missing', async () => {
    const req = {
      params: { id: '40' },
      body: {},
      headers: {},
    };
    const res = createMockRes();
    const next = () => {};

    await consultationController.updateDoctor(req, res, next);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'A valid integer doctorId is required');
  });

  it('should call consultationService.updateConsultationDoctor and return updated consultation', async () => {
    const originalMethod = consultationService.updateConsultationDoctor;
    try {
      consultationService.updateConsultationDoctor = async (consultId, docId, actorId) => {
        return {
          id: consultId,
          doctor_id: docId,
          doctor_name: 'Dr Mouni',
          status: 'scheduled',
        };
      };

      const req = {
        params: { id: '40' },
        body: { doctorId: 1 },
        headers: { 'x-doctor-id': '1' },
      };
      const res = createMockRes();
      const next = () => {};

      await consultationController.updateDoctor(req, res, next);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.doctor_id, 1);
      assert.strictEqual(res.body?.data?.doctor_name, 'Dr Mouni');
    } finally {
      consultationService.updateConsultationDoctor = originalMethod;
    }
  });
});

