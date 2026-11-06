const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const PrescriptionBuilder = require('../../src/modules/templates/prescription.builder');
const LabTestsBuilder = require('../../src/modules/templates/lab-tests.builder');
const SoapNotesBuilder = require('../../src/modules/templates/soap-notes.builder');
const FollowUpBuilder = require('../../src/modules/templates/follow-up.builder');
const SummaryBuilder = require('../../src/modules/templates/summary.builder');

const mockConsultation = {
  id: 1,
  pet_id: 1,
  pet_name: 'Bella',
  pet_species: 'Canine',
  pet_breed: 'Golden Retriever',
  pet_age: 4.5,
  pet_weight: 28.5,
  owner_name: 'Sarah Jenkins',
  owner_contact: '+1-555-0192',
  doctor_id: 1,
  doctor_name: 'Dr. Alex Morgan, DVM',
};

const mockExtraction = {
  pet_info: { name: 'Bella', species: 'Canine', breed: 'Golden Retriever' },
  chief_complaints: ['Coughing for 3 days'],
  symptoms: [
    { symptom: 'Dry hack cough', duration: '3 days', severity: 'moderate', transcript_evidence: { quote: 'dry hack', speaker: 'owner' } },
  ],
  medical_history: { spayed: true },
  allergies: ['None'],
  vitals: { temperature: '38.6 C', heart_rate: '110 bpm' },
  observations: [
    { organ_system: 'Respiratory', finding: 'Sensitive trachea', is_abnormal: true },
  ],
  diagnoses: [
    { condition: 'Kennel Cough', type: 'suspected', clinical_reasoning: 'Dog park exposure', transcript_evidence: { quote: 'kennel cough', speaker: 'doctor' } },
  ],
  medications: [
    {
      medicine_name: 'Doxycycline',
      strength: '100 mg',
      dosage: '100 mg',
      route: 'oral',
      frequency: 'Twice daily',
      duration: '10 days',
      special_instructions: 'Give with food',
      doctor_notes: 'Standard course',
    },
  ],
  lab_tests: [
    { test_name: 'Thoracic X-Rays', status: 'discussed', priority: 'routine', clinical_reason: 'Check lungs' },
  ],
  follow_up: {
    timeframe: '7 days',
    reason: 'Check cough resolution',
    monitoring_instructions: ['Rest', 'Harness only'],
    warning_signs: ['Lethargy', 'Labored breathing'],
  },
  missing_info: ['Previous bordetella vaccine record date'],
  contradictions: [],
};

describe('Clinical Document Builders (All 5 Templates from 1 Extraction)', () => {
  it('Template 1: PrescriptionBuilder generates valid prescription with dosage and route', () => {
    const doc = PrescriptionBuilder.build(mockExtraction, mockConsultation);
    assert.equal(doc.doc_type, 'prescription');
    assert.equal(doc.items.length, 1);
    assert.equal(doc.items[0].medicine_name, 'Doxycycline');
    assert.equal(doc.items[0].dosage, '100 mg');
    assert.equal(doc.items[0].route, 'oral');
    assert.equal(doc.patient.name, 'Bella');
  });

  it('Template 2: LabTestsBuilder preserves discussed vs ordered statuses', () => {
    const doc = LabTestsBuilder.build(mockExtraction, mockConsultation);
    assert.equal(doc.doc_type, 'lab_tests');
    assert.equal(doc.tests.length, 1);
    assert.equal(doc.tests[0].status, 'discussed');
    assert.equal(doc.counts.discussed, 1);
    assert.equal(doc.counts.ordered, 0);
  });

  it('Template 3: SoapNotesBuilder cleanly partitions Subjective, Objective, Assessment, Plan', () => {
    const doc = SoapNotesBuilder.build(mockExtraction, mockConsultation);
    assert.equal(doc.doc_type, 'soap_notes');
    assert.ok(doc.S.reported_symptoms.length > 0);
    assert.equal(doc.O.vitals.temperature, '38.6 C');
    assert.equal(doc.A.differential_diagnoses[0].condition, 'Kennel Cough');
    assert.ok(doc.P.medications[0].includes('Doxycycline'));
  });

  it('Template 4: FollowUpBuilder includes monitoring and red flag warning signs', () => {
    const doc = FollowUpBuilder.build(mockExtraction, mockConsultation);
    assert.equal(doc.doc_type, 'follow_up');
    assert.equal(doc.follow_up_timeframe, '7 days');
    assert.ok(doc.warning_signs_red_flags.includes('Labored breathing'));
  });

  it('Template 5: SummaryBuilder aggregates all clinical sections', () => {
    const doc = SummaryBuilder.build(mockExtraction, mockConsultation);
    assert.equal(doc.doc_type, 'summary');
    assert.equal(doc.patient.name, 'Bella');
    assert.ok(doc.chief_complaints.includes('Coughing for 3 days'));
    assert.ok(doc.prescribed_treatment_plan[0].includes('Doxycycline'));
  });
});

