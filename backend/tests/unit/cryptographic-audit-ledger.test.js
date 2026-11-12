const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../src/db/connection');
const auditService = require('../../src/modules/audit/audit.service');
const clinicalExtractor = require('../../src/modules/clinical-ai/clinical.extractor');

test('Cryptographic Audit Ledger & Formulary Safety Intercept Unit Tests', async (t) => {
  // Setup a test consultation id
  let testConsultationId = 9999;

  await t.test('Setup: ensure clean test consultation', async () => {
    // Check if consultation 9999 exists, or insert dummy
    await db.query(`DELETE FROM consultation_audit_ledger WHERE consultation_id = $1`, [testConsultationId]);
    await db.query(`DELETE FROM consultations WHERE id = $1`, [testConsultationId]);

    // Insert dummy consultation for foreign key
    await db.query(`
      INSERT INTO consultations (id, clinic_id, appointment_id, doctor_id, pet_id, status, language)
      VALUES ($1, 1, NULL, 1, 1, 'recording', 'en')
      ON CONFLICT (id) DO UPDATE SET status = 'recording', clinic_id = 1;
    `, [testConsultationId]);
  });

  await t.test('1. should compute deterministic SHA-256 block hashes', () => {
    const blockA = {
      previousHash: '0'.repeat(64),
      sequenceNumber: 1,
      eventType: 'CONSULTATION_STARTED',
      actorId: 1,
      actorType: 'doctor',
      createdAt: '2026-11-07T12:00:00.000Z',
      payloadSnapshot: { test: true },
    };

    const hash1 = auditService.computeHash(blockA);
    const hash2 = auditService.computeHash(blockA);
    assert.strictEqual(hash1, hash2, 'Identical block data must yield identical SHA-256 hashes');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex string must be 64 characters');

    // Modifying one field must produce a totally different hash
    const blockB = { ...blockA, sequenceNumber: 2 };
    const hash3 = auditService.computeHash(blockB);
    assert.notStrictEqual(hash1, hash3, 'Different sequence numbers must yield different hashes');
  });

  await t.test('2. should build an immutable SHA-256 hash-chained audit ledger', async () => {
    // Block 1 (Genesis)
    const block1 = await auditService.logChainedEvent({
      consultationId: testConsultationId,
      eventType: 'RECORDING_CONSENT_GRANTED',
      actorId: 1,
      actorType: 'doctor',
      payloadSnapshot: { consentMethod: 'digital_signature', owner: 'Test Owner' },
    });

    assert.strictEqual(block1.sequence_number, 1);
    assert.strictEqual(block1.previous_hash, '0'.repeat(64), 'Genesis block must have 64 zeros as previous_hash');
    assert.strictEqual(block1.current_hash.length, 64);

    // Block 2
    const block2 = await auditService.logChainedEvent({
      consultationId: testConsultationId,
      eventType: 'AUDIO_CHUNK_INGESTED',
      actorId: null,
      actorType: 'system',
      payloadSnapshot: { chunkIndex: 0, durationSec: 30 },
    });

    assert.strictEqual(block2.sequence_number, 2);
    assert.strictEqual(block2.previous_hash, block1.current_hash, 'Block 2 previous_hash must match Block 1 current_hash');

    // Block 3
    const block3 = await auditService.logChainedEvent({
      consultationId: testConsultationId,
      eventType: 'CLINICAL_EXTRACTION_COMPLETED',
      actorId: null,
      actorType: 'ai',
      payloadSnapshot: { model: 'llama-3.3-70b-versatile', diagnosisCount: 1 },
    });

    assert.strictEqual(block3.sequence_number, 3);
    assert.strictEqual(block3.previous_hash, block2.current_hash, 'Block 3 previous_hash must match Block 2 current_hash');

    // Verify valid chain
    const verification = await auditService.verifyChain(testConsultationId);
    assert.strictEqual(verification.valid, true, 'Unbroken chain must verify as valid');
    assert.strictEqual(verification.count, 3, 'Must verify 3 chained blocks');
    assert.strictEqual(verification.headHash, block3.current_hash);
  });

  await t.test('3. should detect ledger tampering when payload is manipulated', async () => {
    // Tamper with Block 2 payload directly in the database
    await db.query(
      `UPDATE consultation_audit_ledger 
       SET payload_snapshot = '{"tampered": true}'::jsonb 
       WHERE consultation_id = $1 AND sequence_number = 2;`,
      [testConsultationId]
    );

    const tamperedVerification = await auditService.verifyChain(testConsultationId);
    assert.strictEqual(tamperedVerification.valid, false, 'Tampered block must fail cryptographic verification');
    assert.strictEqual(tamperedVerification.brokenAtSequence, 2, 'Must pinpoint tampering at sequence 2');
    assert.match(tamperedVerification.reason, /Hash mismatch at sequence 2/, 'Reason must mention hash mismatch');
  });

  await t.test('4. Formulary Safety: should intercept lethal feline Paracetamol orders', () => {
    const felineConsultation = {
      pet_name: 'Luna',
      pet_species: 'Feline',
      pet_breed: 'Domestic Short Hair',
    };

    const extractionData = {
      contradictions: [],
      medications: [
        {
          medicine_name: 'Paracetamol Syrup (Crocin)',
          dosage: '10 mg/kg',
          frequency: 'Twice daily',
          duration: '3 days',
          route: 'oral',
        },
        {
          medicine_name: 'Amoxicillin-Clavulanate',
          dosage: '12.5 mg/kg',
          frequency: 'Twice daily',
          duration: '7 days',
          route: 'oral',
        },
      ],
    };

    const result = clinicalExtractor.validateSafetyContraindications(extractionData, felineConsultation);

    assert.strictEqual(result.hasFatalContraindication, true, 'Feline paracetamol must trigger fatal contraindication flag');
    assert.strictEqual(result.hasSafetyAlert, true);
    assert.ok(result.alerts.length >= 1);
    assert.match(result.alerts[0], /\[FATAL CONTRAINDICATION INTERCEPTED\]/);
    assert.match(result.alerts[0], /Paracetamol/);

    // Contradictions list in data must have been populated
    assert.ok(extractionData.contradictions.some((c) => c.includes('FATAL CONTRAINDICATION INTERCEPTED')));

    // Medication item must have doctor note warning
    const paracetamolItem = extractionData.medications.find((m) => m.medicine_name.includes('Paracetamol'));
    assert.ok(paracetamolItem.doctor_notes.includes('BLOCKED:'));
  });

  await t.test('5. Formulary Safety: should allow feline safe meds without false positives', () => {
    const felineConsultation = {
      pet_name: 'Luna',
      pet_species: 'Cat',
    };

    const extractionData = {
      contradictions: [],
      medications: [
        {
          medicine_name: 'Meloxicam Oral Suspension',
          dosage: '0.05 mg/kg',
          frequency: 'Once daily',
          duration: '3 days',
          route: 'oral',
        },
      ],
    };

    const result = clinicalExtractor.validateSafetyContraindications(extractionData, felineConsultation);
    assert.strictEqual(result.hasFatalContraindication, false, 'Meloxicam alone in feline should not trigger paracetamol block');
    assert.strictEqual(result.hasHighRiskInteraction, false, 'Single NSAID should not trigger interaction warning');
  });

  await t.test('6. Formulary Safety: should intercept concurrent NSAID + Corticosteroid orders', () => {
    const canineConsultation = {
      pet_name: 'Ashwin',
      pet_species: 'Canine',
    };

    const extractionData = {
      contradictions: [],
      medications: [
        {
          medicine_name: 'Carprofen',
          dosage: '2 mg/kg',
          frequency: 'Twice daily',
          duration: '5 days',
          route: 'oral',
        },
        {
          medicine_name: 'Prednisolone',
          dosage: '0.5 mg/kg',
          frequency: 'Once daily',
          duration: '5 days',
          route: 'oral',
        },
      ],
    };

    const result = clinicalExtractor.validateSafetyContraindications(extractionData, canineConsultation);
    assert.strictEqual(result.hasHighRiskInteraction, true, 'Concurrent NSAID + Corticosteroid must trigger high risk alert');
    assert.ok(extractionData.contradictions.some((c) => c.includes('HIGH-RISK DRUG INTERACTION')));
    assert.match(result.alerts[0], /ulceration/);
  });

  await t.test('Teardown: clean up test consultation and ledger entries', async () => {
    await db.query(`DELETE FROM consultation_audit_ledger WHERE consultation_id = $1`, [testConsultationId]);
    await db.query(`DELETE FROM consultations WHERE id = $1`, [testConsultationId]);
  });
});
