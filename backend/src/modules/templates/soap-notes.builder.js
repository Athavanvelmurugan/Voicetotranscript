class SoapNotesBuilder {
  static build(extraction, consultation) {
    const toArr = (val) => Array.isArray(val) ? val : (val && typeof val === 'object') ? Object.values(val) : [];
    const symptoms = toArr(extraction?.symptoms);
    const observations = toArr(extraction?.observations);
    const diagnoses = toArr(extraction?.diagnoses);
    const medications = toArr(extraction?.medications);
    const labTests = toArr(extraction?.lab_tests);
    const followUp = extraction?.follow_up && typeof extraction.follow_up === 'object' ? extraction.follow_up : {};

    const subjective = {
      chief_complaint: extraction.chief_complaints?.join(', ') || 'Consultation examination',
      reported_symptoms: symptoms.map(s => ({
        symptom: s.symptom,
        duration: s.duration || 'Not specified',
        severity: s.severity || 'unspecified',
        evidence: s.transcript_evidence?.quote,
      })),
      history: extraction.medical_history || {},
      allergies: extraction.allergies || ['No known allergies'],
    };

    const objective = {
      vitals: extraction.vitals || {},
      physical_examination: observations.map(o => ({
        system: o.organ_system,
        finding: o.finding,
        is_abnormal: o.is_abnormal,
      })),
    };

    const assessment = {
      primary_diagnoses: diagnoses.filter(d => d.type === 'confirmed').map(d => ({
        condition: d.condition,
        evidence: d.transcript_evidence?.quote,
      })),
      differential_diagnoses: diagnoses.filter(d => d.type === 'suspected').map(d => ({
        condition: d.condition,
        reasoning: d.clinical_reasoning,
        evidence: d.transcript_evidence?.quote,
      })),
      clinical_notes: extraction.contradictions?.length
        ? `Contradictions noted in history: ${extraction.contradictions.join('; ')}`
        : 'Consistent presentation with acute clinical onset.',
    };

    const plan = {
      medications: medications.map(m => {
        if (typeof m === 'string') return m;
        return `${m.medicine_name || 'Medication'} ${m.dosage || ''} ${m.route || ''} ${m.frequency || ''} for ${m.duration || ''}`.trim();
      }),
      diagnostic_workup: labTests.map(t => {
        if (typeof t === 'string') {
          try {
            const parsed = JSON.parse(t);
            return `[${(parsed.status || 'ORDERED').toUpperCase()}] ${parsed.test_name || 'Lab Test'} (${parsed.priority || 'routine'})`;
          } catch {
            return `[ORDERED] ${t} (routine)`;
          }
        }
        return `[${(t?.status || 'ORDERED').toUpperCase()}] ${t?.test_name || 'Lab Test'} (${t?.priority || 'routine'})`;
      }),
      follow_up: followUp.timeframe ? `Return in ${followUp.timeframe} for re-evaluation.` : 'PRN (as needed)',
      client_education: followUp.monitoring_instructions || [],
      emergency_red_flags: followUp.warning_signs || [],
    };

    return {
      doc_type: 'soap_notes',
      title: `SOAP Clinical Notes — ${consultation.pet_name}`,
      patient: {
        id: consultation.pet_id,
        name: consultation.pet_name,
        species: consultation.pet_species,
        breed: consultation.pet_breed,
        age: consultation.pet_age,
        weight: consultation.pet_weight,
      },
      veterinarian: consultation.doctor_name,
      consultation_date: new Date().toISOString(),
      S: subjective,
      O: objective,
      A: assessment,
      P: plan,
      missing_fields: extraction.missing_info || [],
    };
  }
}

module.exports = SoapNotesBuilder;

