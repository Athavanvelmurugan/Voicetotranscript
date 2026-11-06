class LabTestsBuilder {
  static build(extraction, consultation) {
    const rawTests = Array.isArray(extraction?.lab_tests)
      ? extraction.lab_tests
      : (extraction?.lab_tests && typeof extraction.lab_tests === 'object')
        ? Object.values(extraction.lab_tests)
        : [];

    const tests = rawTests.map((t, idx) => ({
      item_number: idx + 1,
      test_name: t.test_name,
      biomarker: t.biomarker || 'N/A',
      clinical_reason: t.clinical_reason || 'Diagnostic evaluation',
      status: t.status || 'discussed', // 'discussed' | 'recommended' | 'ordered' | 'completed'
      priority: t.priority || 'routine',
      instructions: t.instructions || 'Follow standard sample collection protocol',
      evidence: t.transcript_evidence || null,
    }));

    const missingFields = [];
    tests.forEach((t, idx) => {
      if (t.status === 'ordered' && !t.instructions) {
        missingFields.push(`Test #${idx + 1} (${t.test_name}): Missing sample collection instructions`);
      }
    });

    return {
      doc_type: 'lab_tests',
      title: `Laboratory Investigations & Biomarkers — ${consultation.pet_name}`,
      patient: {
        pet_id: consultation.pet_id,
        name: consultation.pet_name,
        species: consultation.pet_species,
        breed: consultation.pet_breed,
      },
      ordered_by: consultation.doctor_name,
      order_date: new Date().toISOString().split('T')[0],
      tests,
      counts: {
        total: tests.length,
        ordered: tests.filter(t => t.status === 'ordered').length,
        recommended: tests.filter(t => t.status === 'recommended').length,
        discussed: tests.filter(t => t.status === 'discussed').length,
        completed: tests.filter(t => t.status === 'completed').length,
      },
      missing_fields: missingFields,
    };
  }
}

module.exports = LabTestsBuilder;

