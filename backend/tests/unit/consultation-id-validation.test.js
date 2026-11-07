const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const consultationController = require('../../src/modules/consultations/consultation.controller');

describe('Consultation Controller ID Validation Unit Tests', () => {
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

  it('should return 400 when consultation ID is "null" on consent endpoint', async () => {
    const req = {
      params: { id: 'null' },
      body: { givenBy: 'Sarah Jenkins' },
      headers: {},
      ip: '127.0.0.1',
    };
    const res = createMockRes();
    let nextCalled = false;
    const next = (err) => { nextCalled = !!err; };

    await consultationController.consent(req, res, next);

    assert.strictEqual(res.statusCode, 400, 'Status should be 400 Bad Request');
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'A valid integer consultation ID is required');
    assert.strictEqual(nextCalled, false, 'Should not throw to error handler');
  });

  it('should return 400 when consultation ID is "undefined" or NaN on start endpoint', async () => {
    const req = {
      params: { id: 'undefined' },
      headers: {},
    };
    const res = createMockRes();
    const next = () => {};

    await consultationController.start(req, res, next);

    assert.strictEqual(res.statusCode, 400, 'Status should be 400 Bad Request');
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'A valid integer consultation ID is required');
  });

  it('should return 400 when consultation ID is not a number on getById endpoint', async () => {
    const req = {
      params: { id: 'abc' },
      headers: {},
    };
    const res = createMockRes();
    const next = () => {};

    await consultationController.getById(req, res, next);

    assert.strictEqual(res.statusCode, 400, 'Status should be 400 Bad Request');
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error, 'A valid integer consultation ID is required');
  });
});

