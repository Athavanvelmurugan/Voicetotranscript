const { z } = require('zod');

// Evidence Schema: every clinically significant item must reference transcript evidence
const TranscriptEvidenceSchema = z.object({
  quote: z.string().describe('Exact quote or phrase spoken during the consultation'),
  speaker: z.enum(['doctor', 'owner', 'laboratory', 'existing_medical_record', 'unknown']),
  sequence_number: z.number().int().optional(),
});

// Pet Information Schema
const PetInfoSchema = z.object({
  name: z.string().default('Unknown'),
  species: z.string().default('Canine'),
  breed: z.string().nullable().optional(),
  age: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
});

// Vitals Schema
const VitalsSchema = z.object({
  temperature: z.string().nullable().optional(),
  heart_rate: z.string().nullable().optional(),
  respiratory_rate: z.string().nullable().optional(),
  mucous_membranes: z.string().nullable().optional(),
  capillary_refill_time: z.string().nullable().optional(),
  body_condition_score: z.string().nullable().optional(),
});

// Symptom Schema
const SymptomSchema = z.object({
  symptom: z.string(),
  duration: z.string().nullable().optional(),
  severity: z.enum(['mild', 'moderate', 'severe', 'unspecified']).default('unspecified'),
  reported_by: z.enum(['owner', 'doctor', 'unknown']).default('owner'),
  transcript_evidence: TranscriptEvidenceSchema.optional(),
});

// Physical Observation Schema
const ObservationSchema = z.object({
  organ_system: z.string().default('General'),
  finding: z.string(),
  is_abnormal: z.boolean().default(false),
  transcript_evidence: TranscriptEvidenceSchema.optional(),
});

// Diagnosis Schema: strictly distinguish suspected vs confirmed
const DiagnosisSchema = z.object({
  condition: z.string(),
  type: z.enum(['suspected', 'confirmed']).default('suspected'),
  clinical_reasoning: z.string().optional(),
  transcript_evidence: TranscriptEvidenceSchema.optional(),
});

// Medication Schema: exact preservation of dosage, route, frequency
const MedicationSchema = z.object({
  medicine_name: z.string(),
  strength: z.string().nullable().optional(),
  dosage: z.string().describe('Prescribed dose, preserving numbers and units exactly'),
  route: z.enum(['oral', 'topical', 'subcutaneous', 'intramuscular', 'intravenous', 'ophthalmic', 'otic', 'inhalation', 'other']).default('oral'),
  frequency: z.string().describe('E.g., Twice daily, Every 12 hours, Once daily with food'),
  duration: z.string().describe('E.g., 7 days, 14 days, As needed'),
  special_instructions: z.string().nullable().optional(),
  doctor_notes: z.string().nullable().optional(),
  transcript_evidence: TranscriptEvidenceSchema.optional(),
});

// Lab Test Schema: differentiate discussed, recommended, ordered, completed
const LabTestSchema = z.object({
  test_name: z.string(),
  biomarker: z.string().nullable().optional(),
  clinical_reason: z.string().nullable().optional(),
  status: z.enum(['discussed', 'recommended', 'ordered', 'completed']).default('discussed'),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  instructions: z.string().nullable().optional(),
  transcript_evidence: TranscriptEvidenceSchema.optional(),
});

// Follow Up Schema
const FollowUpSchema = z.object({
  timeframe: z.string().nullable().optional(),
  recommended_date: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  monitoring_instructions: z.array(z.string()).default([]),
  warning_signs: z.array(z.string()).default([]),
  transcript_evidence: TranscriptEvidenceSchema.optional(),
});

// Root Clinical Extraction Schema
const ClinicalExtractionSchema = z.object({
  clinical_summary: z.string().optional(),
  pet_info: PetInfoSchema,
  chief_complaints: z.array(z.string()).default([]),
  symptoms: z.array(SymptomSchema).default([]),
  medical_history: z.record(z.any()).default({}),
  allergies: z.array(z.string()).default([]),
  vitals: VitalsSchema.default({}),
  observations: z.array(ObservationSchema).default([]),
  diagnoses: z.array(DiagnosisSchema).default([]),
  medications: z.array(MedicationSchema).default([]),
  lab_tests: z.array(LabTestSchema).default([]),
  follow_up: FollowUpSchema.default({}),
  missing_info: z.array(z.string()).default([]),
  contradictions: z.array(z.string()).default([]),
});

module.exports = {
  ClinicalExtractionSchema,
  MedicationSchema,
  LabTestSchema,
  DiagnosisSchema,
  SymptomSchema,
  ObservationSchema,
  FollowUpSchema,
  VitalsSchema,
  PetInfoSchema,
  TranscriptEvidenceSchema,
};

