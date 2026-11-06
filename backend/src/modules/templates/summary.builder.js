class SummaryBuilder {
  static build(extraction, consultation) {
    const toArr = (val) => Array.isArray(val) ? val : (val && typeof val === 'object') ? Object.values(val) : [];

    // 1. Normalize symptoms list safely (handling s.symptom or s.name)
    const symptomsList = toArr(extraction?.symptoms).map(s => {
      if (typeof s === 'string') return { symptom: s, duration: 'recent', severity: 'unspecified', reported_by: 'owner' };
      const name = s.symptom || s.name || s.description || 'Reported clinical symptom';
      return {
        ...s,
        symptom: name,
        duration: s.duration || null,
        severity: s.severity || 'unspecified',
        reported_by: s.reported_by || 'owner',
      };
    });

    // 2. Chief complaints (derive from symptoms if empty)
    let chiefComplaints = toArr(extraction?.chief_complaints).map(String).filter(Boolean);
    if (chiefComplaints.length === 0 && symptomsList.length > 0) {
      chiefComplaints = symptomsList.map(s => s.symptom);
    }
    if (chiefComplaints.length === 0) {
      chiefComplaints = ['General clinical evaluation & wellness consultation'];
    }

    // 3. Normalize diagnoses with type and clinical reasoning
    const diagnoses = toArr(extraction?.diagnoses).map(d => {
      if (typeof d === 'string') return { condition: d, type: 'suspected', clinical_reasoning: null };
      return {
        condition: d.condition || d.name || 'Clinical syndrome',
        type: d.type === 'confirmed' ? 'confirmed' : 'suspected',
        clinical_reasoning: d.clinical_reasoning || d.reasoning || null,
      };
    });

    // 4. Clinical observations & abnormal findings
    const observations = toArr(extraction?.observations);
    const examSummary = observations.filter(o => o.is_abnormal).map(o => o.finding || o.description || 'Abnormal finding noted');

    // 5. Prescribed meds & lab tests
    const meds = toArr(extraction?.medications);
    const labs = toArr(extraction?.lab_tests);
    const followUp = extraction?.follow_up && typeof extraction.follow_up === 'object' ? extraction.follow_up : {};

    // 6. Natural Language Clinical Narrative Overview Synthesis
    const petDesc = `${consultation.pet_name} (${consultation.pet_age ? consultation.pet_age + ' yrs, ' : ''}${consultation.pet_species || 'Canine'}${consultation.pet_breed ? ' ' + consultation.pet_breed : ''})`;
    const doctorDesc = consultation.doctor_name || 'the attending veterinarian';
    const ownerDesc = consultation.owner_name ? `accompanied by owner ${consultation.owner_name}` : 'presented for examination';
    const complaintPhrase = chiefComplaints.join(', ');
    const symptomsPhrase = symptomsList.length > 0
      ? symptomsList.map(s => `${s.symptom}${s.duration ? ' (' + s.duration + ')' : ''}`).join(', ')
      : '';
    const examPhrase = examSummary.length > 0 ? `Clinical examination noted: ${examSummary.join(', ')}.` : '';
    const diagPhrase = diagnoses.length > 0
      ? `Primary assessment indicates ${diagnoses.map(d => `${d.type === 'confirmed' ? 'confirmed' : 'suspected'} ${d.condition}`).join('; ')}.`
      : 'Patient received initial clinical triage; no acute pathology confirmed at presentation.';
    const planPhrase = meds.length > 0
      ? `Prescribed medical therapy includes ${meds.map(m => m.medicine_name).join(', ')}.`
      : (labs.length > 0 ? `Diagnostic workup recommended: ${labs.map(l => l.test_name).join(', ')}.` : 'Supportive home monitoring and symptomatic care advised.');

    const overview = extraction?.clinical_summary || extraction?.overview ||
      `${petDesc} was evaluated by ${doctorDesc}, ${ownerDesc}. Chief presenting concern: ${complaintPhrase}.${symptomsPhrase ? ' Reported symptoms: ' + symptomsPhrase + '.' : ''} ${examPhrase} ${diagPhrase} ${planPhrase}`;

    // 7. Owner Guidance Text
    const ownerGuidance = (followUp.monitoring_instructions && followUp.monitoring_instructions.length > 0)
      ? followUp.monitoring_instructions.join('. ')
      : (followUp.timeframe
          ? `Re-check recommended in ${followUp.timeframe}. Monitor appetite, hydration, and activity levels closely at home.`
          : `Monitor ${consultation.pet_name} closely at home. Contact the clinic immediately if symptoms worsen or fail to resolve.`);

    return {
      doc_type: 'summary',
      title: `Consultation Comprehensive Summary — ${consultation.pet_name}`,
      overview,
      clinical_narrative: overview,
      patient: {
        id: consultation.pet_id,
        name: consultation.pet_name,
        species: consultation.pet_species,
        breed: consultation.pet_breed,
        age: consultation.pet_age ? `${consultation.pet_age} yrs` : 'N/A',
        weight: consultation.pet_weight ? `${consultation.pet_weight} kg` : 'N/A',
        owner: consultation.owner_name,
      },
      consultation_details: {
        id: consultation.id,
        doctor: consultation.doctor_name,
        date: new Date().toISOString().split('T')[0],
        duration: consultation.audio_duration_seconds ? `${Math.round(consultation.audio_duration_seconds / 60)} mins` : 'Live session',
      },
      chief_complaints: chiefComplaints,
      symptoms_overview: symptomsList.map(s => `${s.symptom} (${s.duration || 'recent'}${s.severity && s.severity !== 'unspecified' ? ', ' + s.severity : ''})`),
      symptoms: symptomsList,
      diagnoses,
      assessment_conclusions: diagnoses.length > 0
        ? diagnoses.map(d => `${d.type === 'confirmed' ? 'Confirmed' : 'Suspected'}: ${d.condition}`)
        : ['No acute pathology confirmed at present examination'],
      clinical_examination_summary: examSummary.length > 0
        ? examSummary
        : ['Physical examination parameters reviewed within baseline'],
      observations,
      prescribed_treatment_plan: meds.map(m => `${m.medicine_name} (${m.dosage}, ${m.frequency})`),
      recommended_investigations: labs.map(l => `${l.test_name} [${(l.status || 'ORDERED').toUpperCase()}]`),
      client_instructions_and_follow_up: {
        revisit: followUp.timeframe || 'As instructed / PRN',
        key_instructions: followUp.monitoring_instructions || [],
        warning_signs: followUp.warning_signs || [],
      },
      owner_guidance: ownerGuidance,
      missing_information_alert: extraction?.missing_info || [],
    };
  }
}

module.exports = SummaryBuilder;
