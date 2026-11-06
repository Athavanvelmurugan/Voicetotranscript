const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ClinicalExtractionSchema,
  MedicationSchema,
  LabTestSchema,
  DiagnosisSchema,
} = require('../../src/modules/clinical-ai/clinical.schemas');

describe('Clinical Safety Zod Schemas', () => {
  it('should validate a complete, safe clinical extraction object', () => {
    const validExtraction = {
      pet_info: {
        name: 'Bella',
        species: 'Canine',
        breed: 'Golden Retriever',
        age: '4.5 years',
        weight: '28.5 kg',
      },
      chief_complaints: ['Persistent coughing', 'Lethargy'],
      symptoms: [
        {
          symptom: 'Dry hacking cough',
          duration: '3 days',
          severity: 'moderate',
          reported_by: 'owner',
          transcript_evidence: {
            quote: 'She has been coughing non stop since Tuesday',
            speaker: 'owner',
          },
        },
      ],
      medical_history: {},
      allergies: ['No known allergies'],
      vitals: {
        temperature: '38.5 C',
        heart_rate: '110 bpm',
      },
      observations: [
        {
          organ_system: 'Respiratory',
          finding: 'Tracheal sensitivity on palpation',
          is_abnormal: true,
          transcript_evidence: {
            quote: 'She coughs immediately when I palpate her trachea',
            speaker: 'doctor',
          },
        },
      ],
      diagnoses: [
        {
          condition: 'Infectious Tracheobronchitis',
          type: 'suspected',
          clinical_reasoning: 'Acute cough after boarding',
          transcript_evidence: {
            quote: 'Signs point toward kennel cough',
            speaker: 'doctor',
          },
        },
      ],
      medications: [
        {
          medicine_name: 'Doxycycline',
          strength: '100 mg',
          dosage: '100 mg orally',
          route: 'oral',
          frequency: 'Twice daily',
          duration: '10 days',
          transcript_evidence: {
            quote: 'Give one 100 milligram tablet twice a day for ten days',
            speaker: 'doctor',
          },
        },
      ],
      lab_tests: [
        {
          test_name: 'Thoracic Radiographs',
          biomarker: 'Lung fields',
          clinical_reason: 'Evaluate for secondary pneumonia',
          status: 'discussed',
          priority: 'routine',
          transcript_evidence: {
            quote: 'We might need x-rays if the cough persists',
            speaker: 'doctor',
          },
        },
      ],
      follow_up: {
        timeframe: '7 days',
        recommended_date: '2026-11-13',
        reason: 'Recheck cough',
        monitoring_instructions: ['Watch breathing effort at rest'],
        warning_signs: ['Difficulty breathing', 'Lethargy'],
      },
      missing_info: [],
      contradictions: [],
    };

    const parsed = ClinicalExtractionSchema.safeParse(validExtraction);
    assert.equal(parsed.success, true);
  });

  it('should enforce exact medication structure with dosage, route, frequency', () => {
    const validMed = {
      medicine_name: 'Amoxicillin-Clavulanate',
      strength: '250 mg',
      dosage: '250 mg',
      route: 'oral',
      frequency: 'Every 12 hours with food',
      duration: '14 days',
    };

    const res = MedicationSchema.safeParse(validMed);
    assert.equal(res.success, true);
    assert.equal(res.data.medicine_name, 'Amoxicillin-Clavulanate');
    assert.equal(res.data.route, 'oral');
  });

  it('should strictly differentiate between suspected and confirmed diagnoses', () => {
    const suspected = DiagnosisSchema.safeParse({
      condition: 'Canine Parvovirus',
      type: 'suspected',
      clinical_reasoning: 'Bloody diarrhea and lethargy in puppy',
    });
    assert.equal(suspected.success, true);
    assert.equal(suspected.data.type, 'suspected');

    const confirmed = DiagnosisSchema.safeParse({
      condition: 'Canine Parvovirus',
      type: 'confirmed',
      clinical_reasoning: 'Positive SNAP antigen test',
    });
    assert.equal(confirmed.success, true);
    assert.equal(confirmed.data.type, 'confirmed');

    // Invalid diagnosis type should fail validation
    const invalidType = DiagnosisSchema.safeParse({
      condition: 'Canine Parvovirus',
      type: 'definitely_has_it',
    });
    assert.equal(invalidType.success, false);
  });

  it('should validate lab test statuses (discussed vs ordered)', () => {
    const discussed = LabTestSchema.safeParse({
      test_name: 'CBC and Chemistry Panel',
      status: 'discussed',
    });
    assert.equal(discussed.success, true);
    assert.equal(discussed.data.status, 'discussed');

    const ordered = LabTestSchema.safeParse({
      test_name: 'Urinalysis',
      status: 'ordered',
    });
    assert.equal(ordered.success, true);
    assert.equal(ordered.data.status, 'ordered');
  });
});

