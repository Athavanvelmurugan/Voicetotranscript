const test = require('node:test');
const assert = require('node:assert/strict');
const auditService = require('../../src/modules/audit/audit.service');
const db = require('../../src/db/connection');

test('Part B.6 Cryptographic Audit Ledger Chained Events', async (t) => {
  let testConsultId;

  t.before(async () => {
    const res = await db.query(
      `INSERT INTO consultations (clinic_id, doctor_id, pet_id, status, language, consent_given)
       VALUES (1, 1, 1, 'recording', 'en', true)
       RETURNING id`
    );
    testConsultId = res.rows[0].id;
  });

  t.after(async () => {
    if (testConsultId) {
      await db.query('DELETE FROM consultations WHERE id = $1', [testConsultId]).catch(() => {});
    }
    await db.pool.end();
  });

  await t.test('1. Chained events (superseded, final_pass, hash_verified, drug_auto_corrected) produce valid cryptographic hash chain', async () => {
    // 1. TRANSCRIPT_SUPERSEDED
    await auditService.logChainedEvent({
      consultationId: testConsultId,
      eventType: 'TRANSCRIPT_SUPERSEDED',
      actorType: 'ai',
      payloadSnapshot: { passNumber: 1, replacedByPass: 2, reason: 'final_pass_replacing_live' },
    });

    // 2. AUDIO_HASH_VERIFIED
    await auditService.logChainedEvent({
      consultationId: testConsultId,
      eventType: 'AUDIO_HASH_VERIFIED',
      actorType: 'ai',
      payloadSnapshot: { audioHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', verified: true },
    });

    // 3. DRUG_AUTO_CORRECTED
    await auditService.logChainedEvent({
      consultationId: testConsultId,
      eventType: 'DRUG_AUTO_CORRECTED',
      actorType: 'ai',
      payloadSnapshot: { original: 'clave amox', canonical: 'Clavamox', confidence: 1.0 },
    });

    // 4. FINAL_PASS_COMPLETED
    await auditService.logChainedEvent({
      consultationId: testConsultId,
      eventType: 'FINAL_PASS_COMPLETED',
      actorType: 'ai',
      payloadSnapshot: { passNumber: 2, totalSegments: 15, wordDiffPercent: 2 },
    });

    // 5. Verify the entire chain
    const verification = await auditService.verifyChain(testConsultId);
    assert.strictEqual(verification.valid, true, `Chain must be cryptographically valid: ${verification.reason}`);
    assert.strictEqual(verification.count, 4);
  });

  await t.test('2. FINAL_PASS_FAILED event appends correctly to chain and maintains chain validity', async () => {
    await auditService.logChainedEvent({
      consultationId: testConsultId,
      eventType: 'FINAL_PASS_FAILED',
      actorType: 'ai',
      payloadSnapshot: { error: 'Network timeout during provider Whisper call', retryAllowed: true },
    });

    const verification = await auditService.verifyChain(testConsultId);
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.count, 5);
  });

  await t.test('3. Tampering with any payload in the chain breaks verifyChain', async () => {
    // Tamper with block #2 payload in DB
    await db.query(
      `UPDATE consultation_audit_ledger 
       SET payload_snapshot = '{"tampered":true}'::jsonb 
       WHERE consultation_id = $1 AND sequence_number = 2`,
      [testConsultId]
    );

    const verification = await auditService.verifyChain(testConsultId);
    assert.strictEqual(verification.valid, false, 'Chain must be detected as invalid after tampering');
    assert.strictEqual(verification.brokenAtSequence, 2, 'Tampering must be identified at sequence 2');
  });
});
