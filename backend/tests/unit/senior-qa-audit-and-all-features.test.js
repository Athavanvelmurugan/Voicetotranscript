const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { hashPassword, verifyPassword } = require('../../src/utils/password');
const { authorize } = require('../../src/middleware/authorize');
const { tenantContext } = require('../../src/middleware/tenantContext');
const { loadUserContext, LEGACY_ROLE_MAP } = require('../../src/modules/auth/userContext.helper');
const db = require('../../src/db/connection');
const auditService = require('../../src/modules/audit/audit.service');
const auditViewerController = require('../../src/modules/audit-viewer/audit.viewer.controller');
const auditViewerService = require('../../src/modules/audit-viewer/audit.viewer.service');
const { logAuditEvent } = require('../../src/modules/audit-viewer/audit.event.logger');
const { parsePagination, buildPaginatedResponse } = require('../../src/utils/pagination');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  return res;
}

describe('Senior QA Unit Suite — Security, Multi-Practice RBAC, Audit & Validation', () => {
  describe('1. Password Security (Argon2id + Bcrypt Migration)', () => {
    it('hashes new passwords with Argon2id and rejects mismatches', async () => {
      const { hash, algo } = await hashPassword('VetClinic!2026');
      assert.strictEqual(algo, 'argon2id');
      assert.ok(hash.startsWith('$argon2id$'), 'Expected Argon2id hash prefix');

      const good = await verifyPassword('VetClinic!2026', hash);
      assert.deepStrictEqual(good, { valid: true, needsRehash: false });

      const bad = await verifyPassword('WrongPass!2026', hash);
      assert.deepStrictEqual(bad, { valid: false, needsRehash: false });
    });

    it('verifies legacy bcrypt hash and flags needsRehash=true', async () => {
      const legacyHash = await bcrypt.hash('LegacyPass!99', 6);
      const res = await verifyPassword('LegacyPass!99', legacyHash);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.needsRehash, true);

      const fail = await verifyPassword('Nope', legacyHash);
      assert.strictEqual(fail.valid, false);
    });
  });

  describe('2. Multi-Practice Role Mapping (loadUserContext & LEGACY_ROLE_MAP)', () => {
    async function resolveContextWithMock(userRow, roleRows, membershipRows) {
      const orig = db.query.bind(db);
      db.query = async (sql) => {
        if (sql.includes('FROM users u')) return { rows: [userRow] };
        if (sql.includes('FROM user_roles')) return { rows: roleRows };
        if (sql.includes('FROM practice_members')) return { rows: membershipRows };
        return { rows: [] };
      };
      try {
        return await loadUserContext(userRow.id);
      } finally {
        db.query = orig;
      }
    }

    it('maps legacy roles canonically in LEGACY_ROLE_MAP and keeps super_admin/pet_owner canonical', async () => {
      assert.strictEqual(LEGACY_ROLE_MAP.veterinarian, 'DOCTOR');
      assert.strictEqual(LEGACY_ROLE_MAP.clinic_admin, 'HOSPITAL_ADMIN');
      assert.strictEqual(LEGACY_ROLE_MAP.owner, 'PET_OWNER');

      const sa = await resolveContextWithMock(
        { id: 1, name: 'SA', email: 'sa@x.com', role: 'super_admin', clinic_id: null, status: 'ACTIVE' },
        [{ role: 'SUPER_ADMIN' }],
        []
      );
      assert.strictEqual(sa.role, 'super_admin');

      const po = await resolveContextWithMock(
        { id: 2, name: 'PO', email: 'po@x.com', role: 'owner', clinic_id: null, status: 'ACTIVE' },
        [{ role: 'PET_OWNER' }],
        []
      );
      assert.strictEqual(po.role, 'pet_owner');
    });

    it('maps INDEPENDENT practice OWNER to doctor so doctor workspace & clinical tools stay primary', async () => {
      const ctx = await resolveContextWithMock(
        { id: 3, name: 'Solo Vet', email: 'solo@x.com', role: 'doctor', clinic_id: 10, status: 'ACTIVE' },
        [{ role: 'DOCTOR' }],
        [{ practice_id: 5, role: 'OWNER', status: 'ACTIVE', practice_type: 'INDEPENDENT', practice_status: 'ACTIVE', clinic_id: 10, practice_name: 'Solo', practice_slug: 'solo' }]
      );
      assert.strictEqual(ctx.role, 'doctor');
      assert.strictEqual(ctx.practiceRole, 'OWNER');
      assert.strictEqual(ctx.clinicId, 10);
    });

    it('maps HOSPITAL practice OWNER/ADMIN to clinic_admin and HOSPITAL DOCTOR to doctor', async () => {
      const hOwner = await resolveContextWithMock(
        { id: 4, name: 'Hosp Owner', email: 'ho@x.com', role: 'doctor', clinic_id: 20, status: 'ACTIVE' },
        [{ role: 'DOCTOR' }],
        [{ practice_id: 6, role: 'OWNER', status: 'ACTIVE', practice_type: 'HOSPITAL', practice_status: 'ACTIVE', clinic_id: 20, practice_name: 'Care', practice_slug: 'care' }]
      );
      assert.strictEqual(hOwner.role, 'clinic_admin');

      const hAdmin = await resolveContextWithMock(
        { id: 5, name: 'Hosp Admin', email: 'ha@x.com', role: 'clinic_admin', clinic_id: 20, status: 'ACTIVE' },
        [{ role: 'HOSPITAL_ADMIN' }],
        [{ practice_id: 6, role: 'ADMIN', status: 'ACTIVE', practice_type: 'HOSPITAL', practice_status: 'ACTIVE', clinic_id: 20, practice_name: 'Care', practice_slug: 'care' }]
      );
      assert.strictEqual(hAdmin.role, 'clinic_admin');

      const hDoc = await resolveContextWithMock(
        { id: 6, name: 'Hosp Doc', email: 'hd@x.com', role: 'doctor', clinic_id: 20, status: 'ACTIVE' },
        [{ role: 'DOCTOR' }],
        [{ practice_id: 6, role: 'DOCTOR', status: 'ACTIVE', practice_type: 'HOSPITAL', practice_status: 'ACTIVE', clinic_id: 20, practice_name: 'Care', practice_slug: 'care' }]
      );
      assert.strictEqual(hDoc.role, 'doctor');
      assert.strictEqual(hDoc.practiceRole, 'DOCTOR');
    });
  });

  describe('3. Authorization Middleware (authorize)', () => {
    it('returns 401 when req.user is missing', () => {
      const mw = authorize(['doctor']);
      const res = createMockRes();
      let nextCalled = false;
      mw({}, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.code, 'UNAUTHENTICATED');
    });

    it('grants access across canonical & legacy aliases and practice OWNER', () => {
      const docRes = createMockRes();
      let docNext = false;
      authorize(['DOCTOR'])({ user: { role: 'veterinarian', roles: [] } }, docRes, () => { docNext = true; });
      assert.strictEqual(docNext, true);

      const superRes = createMockRes();
      let superNext = false;
      authorize(['clinic_admin'])({ user: { role: 'super_admin', roles: ['SUPER_ADMIN'] } }, superRes, () => { superNext = true; });
      assert.strictEqual(superNext, true);

      const ownerRes = createMockRes();
      let ownerNext = false;
      authorize(['clinic_admin'])({ user: { role: 'doctor', roles: ['DOCTOR'], practiceRole: 'OWNER' } }, ownerRes, () => { ownerNext = true; });
      assert.strictEqual(ownerNext, true);
    });

    it('rejects regular hospital doctor from admin-only endpoints (403 FORBIDDEN)', () => {
      const res = createMockRes();
      let nextCalled = false;
      authorize(['clinic_admin', 'super_admin'])(
        { user: { role: 'doctor', roles: ['DOCTOR'], practiceRole: 'DOCTOR' } },
        res,
        () => { nextCalled = true; }
      );
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.code, 'FORBIDDEN');
    });
  });

  describe('4. Tenant Context Isolation Middleware (tenantContext)', () => {
    it('blocks PENDING_VERIFICATION, PENDING_APPROVAL, REJECTED, and unassigned workspaces', async () => {
      const scenarios = [
        { user: { role: 'clinic_admin', status: 'PENDING_VERIFICATION' }, code: 'ACCOUNT_PENDING_VERIFICATION' },
        { user: { role: 'clinic_admin', status: 'PENDING_APPROVAL' }, code: 'PRACTICE_PENDING_APPROVAL' },
        { user: { role: 'clinic_admin', status: 'REJECTED' }, code: 'PRACTICE_REJECTED' },
        {
          user: {
            role: 'doctor',
            status: 'ACTIVE',
            clinicId: null,
            memberships: [{ practice_status: 'PENDING_APPROVAL', status: 'ACTIVE' }],
          },
          code: 'PRACTICE_PENDING_APPROVAL',
        },
        {
          user: {
            role: 'doctor',
            status: 'ACTIVE',
            clinicId: null,
            memberships: [{ practice_status: 'ACTIVE', status: 'PENDING_APPROVAL' }],
          },
          code: 'MEMBERSHIP_PENDING_APPROVAL',
        },
        { user: { role: 'doctor', status: 'ACTIVE', clinicId: null, memberships: [] }, code: 'TENANT_NOT_ASSIGNED' },
      ];

      for (const s of scenarios) {
        const res = createMockRes();
        let nextCalled = false;
        await tenantContext({ user: s.user }, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.body.code, s.code);
      }
    });

    it('populates req.clinicId and req.practiceId for active tenant', async () => {
      const req = { user: { role: 'doctor', status: 'ACTIVE', clinicId: 42, practiceId: 9, roles: ['DOCTOR'] } };
      const res = createMockRes();
      let nextCalled = false;
      await tenantContext(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.clinicId, 42);
      assert.strictEqual(req.practiceId, 9);
      assert.strictEqual(req.isSuperAdmin, false);
    });
  });

  describe('5. Audit Ledger Cryptography & Pagination Contract', () => {
    it('produces identical SHA-256 hashes under different JSON key orderings (RFC 8785)', () => {
      const base = {
        previousHash: '0'.repeat(64),
        sequenceNumber: 1,
        eventType: 'document_approved',
        actorId: 12,
        actorType: 'doctor',
        createdAt: '2026-11-12T08:00:00.000Z',
      };
      const h1 = auditService.computeHash({ ...base, payloadSnapshot: { docId: 5, nested: { b: 2, a: 1 } } });
      const h2 = auditService.computeHash({ ...base, payloadSnapshot: { nested: { a: 1, b: 2 }, docId: 5 } });
      assert.strictEqual(h1, h2);
      assert.strictEqual(h1.length, 64);

      // Tampering payload changes hash
      const tampered = auditService.computeHash({ ...base, payloadSnapshot: { nested: { a: 99, b: 2 }, docId: 5 } });
      assert.notStrictEqual(h1, tampered);
    });

    it('gracefully returns null from logAuditEvent when given empty/non-existent target without throwing', async () => {
      const db = require('../../src/db/connection');
      const originalQuery = db.query.bind(db);
      db.query = async () => {
        throw new Error('simulated DB failure');
      };
      try {
        const out = await logAuditEvent({ clinicId: null, practiceId: null, actorUserId: 1, action: 'qa_test' });
        assert.strictEqual(out, null);
      } finally {
        db.query = originalQuery;
      }
    });

    it('pagination helper returns pagination.total (root cause of phase2 auditData.total mismatch)', () => {
      const parsed = parsePagination({ page: '2', limit: '250' }, { page: 1, limit: 15, maxLimit: 100 });
      assert.deepStrictEqual(parsed, {
        page: 2,
        limit: 100,
        offset: 100,
        search: '',
        sortBy: 'id',
        sortDir: 'DESC',
      });

      const resp = buildPaginatedResponse([{ id: 1 }], 4, 1, 20);
      assert.strictEqual(resp.pagination.total, 4);
      assert.strictEqual(resp.total, undefined);
    });

    it('rejects missing clinicId in AuditService without defaulting to clinic_id=1 and flags empty verifyChain', async () => {
      const originalQuery = db.query.bind(db);
      db.query = async () => ({ rows: [] });
      try {
        await assert.rejects(
          () => auditService.logChainedEvent({ consultationId: null, clinicId: null, eventType: 'TEST' }),
          (err) => err.code === 'AUDIT_TENANT_REQUIRED'
        );
        await assert.rejects(
          () => auditService.log({ consultationId: null, clinicId: null, action: 'TEST' }),
          (err) => err.code === 'AUDIT_TENANT_REQUIRED'
        );
        const emptyVerify = await auditService.verifyChain(99999999);
        assert.strictEqual(emptyVerify.valid, false);
        assert.strictEqual(emptyVerify.count, 0);
        assert.strictEqual(emptyVerify.isEmpty, true);
      } finally {
        db.query = originalQuery;
      }
    });

    it('scopes hospital DOCTOR audit queries and exposes top-level total in auditViewerController', async () => {
      const origGetEvents = auditViewerService.getEvents.bind(auditViewerService);
      let capturedOpts = null;
      auditViewerService.getEvents = async (_clinicId, opts) => {
        capturedOpts = opts;
        return { total: 4, limit: opts.limit, offset: opts.offset, data: [{ id: '1' }] };
      };
      try {
        const docRes = createMockRes();
        await auditViewerController.getEvents(
          { query: {}, clinicId: 226, practiceId: 99, user: { id: 1052, clinicId: 226, practiceId: 99, role: 'doctor', practiceRole: 'DOCTOR' } },
          docRes,
          (err) => { throw err; }
        );
        assert.strictEqual(capturedOpts.doctorScopeUserId, 1052);
        assert.strictEqual(capturedOpts.practiceId, 99);
        assert.strictEqual(docRes.body.total, 4);
        assert.strictEqual(docRes.body.pagination.total, 4);

        const ownerRes = createMockRes();
        await auditViewerController.getEvents(
          { query: {}, clinicId: 223, practiceId: 88, user: { id: 1044, clinicId: 223, practiceId: 88, role: 'doctor', practiceRole: 'OWNER' } },
          ownerRes,
          (err) => { throw err; }
        );
        assert.strictEqual(capturedOpts.doctorScopeUserId, null);
      } finally {
        auditViewerService.getEvents = origGetEvents;
      }
    });
  });

  describe('6. Frontend Registration & Validation Library (ESM import)', () => {
    it('validates email, mobile phone, password strength, slug, license, OTP, PIN, and experience', async () => {
      const valUrl = pathToFileURL(path.resolve(__dirname, '../../../frontend/src/auth/validation.js')).href;
      const v = await import(valUrl);

      assert.strictEqual(v.validateEmail('doc@clinic.com').isValid, true);
      assert.strictEqual(v.validateEmail('invalid').isValid, false);

      assert.strictEqual(v.validatePhone('9876543210').isValid, true);
      assert.strictEqual(v.validatePhone('123').isValid, false);

      assert.strictEqual(v.validatePassword('PetCare!2026').isValid, true);
      assert.strictEqual(v.validatePassword('weak').isValid, false);

      assert.strictEqual(v.validateConfirmPassword('PetCare!2026', 'PetCare!2026').isValid, true);
      assert.strictEqual(v.validateConfirmPassword('PetCare!2026', 'Other!2026').isValid, false);

      assert.strictEqual(v.generateSlug('Central Valley Animal Hospital!'), 'central-valley-animal-hospital');
      assert.strictEqual(v.validatePinCode('560001').isValid, true);
      assert.strictEqual(v.validatePinCode('@@').isValid, false);
      assert.strictEqual(v.validateYearsOfExperience(6).isValid, true);
      assert.strictEqual(v.validateYearsOfExperience(-1).isValid, false);
      assert.strictEqual(v.validateOtp('1,2,3-4 5 6').isValid, true);
      assert.strictEqual(v.validateOtp('123').isValid, false);
    });
  });

  describe('7. BUG-QA-1 & BUG-QA-2 Regression Protections', () => {
    it('BUG-QA-1: ownerPortalService.signConsent passes owners.user_id (never owners.id) to auditService.logChainedEvent', async () => {
      const ownerPortalService = require('../../src/modules/owner-portal/owner.portal.service');
      const originalQuery = db.query.bind(db);
      const originalLogChained = auditService.logChainedEvent.bind(auditService);
      let capturedAudit = null;

      db.query = async (sql) => {
        if (sql.includes('FROM consultations c')) {
          return { rows: [{ id: 901, clinic_id: 1, pet_id: 88, pet_name: 'Bruno' }] };
        }
        if (sql.includes('FROM consent_templates')) {
          return { rows: [{ id: 1, version: 2 }] };
        }
        if (sql.includes('INSERT INTO recording_consents')) {
          return { rows: [{ id: 55, consultation_id: 901, signed_by_owner_id: 777 }] };
        }
        if (sql.includes('SELECT user_id FROM owners')) {
          return { rows: [{ user_id: 3005 }] };
        }
        return { rows: [] };
      };
      auditService.logChainedEvent = async (payload) => {
        capturedAudit = payload;
        return { current_hash: 'mock-hash' };
      };

      try {
        await ownerPortalService.signConsent(777, {
          consultationId: 901,
          templateId: 1,
          signatureType: 'typed_name',
          signatureData: 'Ananya',
        });
        assert.strictEqual(capturedAudit.actorId, 3005, 'Must pass users.id instead of owners.id to avoid FK 23503');
        assert.strictEqual(capturedAudit.payloadSnapshot.ownerId, 777);

        // Legacy owner without unified users row should pass null cleanly
        db.query = async (sql) => {
          if (sql.includes('FROM consultations c')) return { rows: [{ id: 902, clinic_id: 1, pet_id: 88, pet_name: 'Bruno' }] };
          if (sql.includes('FROM consent_templates')) return { rows: [{ id: 1, version: 2 }] };
          if (sql.includes('INSERT INTO recording_consents')) return { rows: [{ id: 56, consultation_id: 902, signed_by_owner_id: 778 }] };
          if (sql.includes('SELECT user_id FROM owners')) return { rows: [{ user_id: null }] };
          return { rows: [] };
        };
        await ownerPortalService.signConsent(778, { consultationId: 902 });
        assert.strictEqual(capturedAudit.actorId, null);
      } finally {
        db.query = originalQuery;
        auditService.logChainedEvent = originalLogChained;
      }
    });

    it('BUG-QA-2: audioController.uploadAndScribe computes SHA-256 audio_hash and inserts into consultation_audio', async () => {
      const fs = require('fs');
      const os = require('os');
      const crypto = require('crypto');
      const audioController = require('../../src/modules/audio/audio.controller');
      const whisperClient = require('../../src/modules/transcription/whisper.client');
      const clinicalTranslator = require('../../src/modules/clinical-ai/clinical.translator');
      const consultationRepo = require('../../src/modules/consultations/consultation.repository');

      const wav = Buffer.alloc(44 + 16000 * 2);
      wav.write('RIFF', 0);
      wav.writeUInt32LE(36 + 32000, 4);
      wav.write('WAVE', 8);
      wav.write('fmt ', 12);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(16000, 24);
      wav.writeUInt32LE(32000, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write('data', 36);
      wav.writeUInt32LE(32000, 40);
      wav.fill(0x44, 44);
      const expectedHash = crypto.createHash('sha256').update(wav).digest('hex');

      const tmpWav = path.join(os.tmpdir(), `qa_bug2_${Date.now()}.wav`);
      fs.writeFileSync(tmpWav, wav);

      const originalQuery = db.query.bind(db);
      const origTranscribe = whisperClient.transcribe.bind(whisperClient);
      const origTranslate = clinicalTranslator.translateAndDiarize.bind(clinicalTranslator);
      const origFindById = consultationRepo.findById.bind(consultationRepo);
      const origInsertSeg = consultationRepo.insertTranscriptSegment.bind(consultationRepo);

      let audioInsertParams = null;
      let audioInsertSql = '';

      whisperClient.transcribe = async () => ({
        fullText: 'Patient seems stable today.',
        detectedLanguage: 'en',
        segments: [{ text: 'Patient seems stable today.', speakerRole: 'doctor', confidence: 0.99, startMs: 0, endMs: 1000 }],
      });
      clinicalTranslator.translateAndDiarize = async (p) => ({
        fullText: p.fullText,
        segments: p.segments,
      });
      consultationRepo.findById = async (id) => ({ id, clinic_id: 1, pet_name: 'Bruno', pet_species: 'Canine' });
      consultationRepo.insertTranscriptSegment = async () => ({ id: 1 });
      db.query = async (sql, params) => {
        if (sql.includes('INSERT INTO consultation_audio')) {
          audioInsertSql = sql;
          audioInsertParams = params;
        }
        return { rows: [] };
      };

      const res = createMockRes();
      try {
        await audioController.uploadAndScribe(
          {
            file: { path: tmpWav, originalname: 'qa_bug2.wav', mimetype: 'audio/wav', size: wav.length },
            body: { consultationId: '955', autoGenerate: 'false' },
            headers: {},
            params: { id: '955' },
            user: { id: 1 },
          },
          res,
          (err) => { throw err; }
        );

        assert.strictEqual(res.statusCode, 200);
        assert.match(audioInsertSql, /audio_hash/);
        assert.ok(Array.isArray(audioInsertParams));
        assert.ok(audioInsertParams.includes(expectedHash), 'Inserted consultation_audio row must store SHA-256 audio_hash');
      } finally {
        db.query = originalQuery;
        whisperClient.transcribe = origTranscribe;
        clinicalTranslator.translateAndDiarize = origTranslate;
        consultationRepo.findById = origFindById;
        consultationRepo.insertTranscriptSegment = origInsertSeg;
        if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
      }
    });

    it('BUG-QA-3 regression: discoverPractices orders newest practices first (created_at DESC, id DESC) so new independent practices are not buried', async () => {
      const db = require('../../src/db/connection');
      const practiceService = require('../../src/modules/practices/practice.service');
      const originalQuery = db.query;
      let capturedSql = '';

      db.query = async (sql) => {
        capturedSql = sql;
        return { rows: [] };
      };

      try {
        await practiceService.discoverPractices({ limit: 100 });
        assert.match(capturedSql, /ORDER BY p\.created_at DESC,\s*p\.id DESC/i);
      } finally {
        db.query = originalQuery;
      }
    });

    it('BUG-QA-4 regression: PetRepository.create does not write long owner_email into VARCHAR(20) owners.phone when owner_phone is omitted', async () => {
      const db = require('../../src/db/connection');
      const petRepo = require('../../src/modules/pets/pet.repository');
      const originalGetClient = db.getClient;
      const originalFindById = petRepo.findById;
      let ownerInsertParams = null;

      db.getClient = async () => ({
        query: async (sql, params) => {
          if (sql.includes('INSERT INTO pets')) return { rows: [{ id: 888, clinic_id: 1, name: 'Zeus' }] };
          if (sql.includes('INSERT INTO owners')) {
            ownerInsertParams = params;
            return { rows: [{ id: 777 }] };
          }
          return { rows: [] };
        },
        release: () => {},
      });
      petRepo.findById = async () => ({ id: 888, name: 'Zeus', owner_email: 'elena.long.address.1794473@petcare.vet' });

      try {
        const longEmail = 'elena.long.address.1794473@petcare.vet';
        await petRepo.create(1, {
          name: 'Zeus',
          species: 'Dog',
          owner_name: 'Elena Rostova',
          owner_phone: '',
          owner_email: longEmail,
        });

        assert.ok(Array.isArray(ownerInsertParams));
        const [, , phoneParam, emailParam] = ownerInsertParams;
        assert.strictEqual(phoneParam, 'Unspecified');
        assert.ok(phoneParam.length <= 20, 'owners.phone must fit VARCHAR(20)');
        assert.strictEqual(emailParam, longEmail);
      } finally {
        db.getClient = originalGetClient;
        petRepo.findById = originalFindById;
      }
    });
  });
});

