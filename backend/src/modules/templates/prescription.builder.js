class PrescriptionBuilder {
  static build(extraction, consultation) {
    const meds = Array.isArray(extraction?.medications)
      ? extraction.medications
      : (extraction?.medications && typeof extraction.medications === 'object')
        ? Object.values(extraction.medications)
        : [];

    const items = meds.map((m, idx) => ({
      item_number: idx + 1,
      medicine_name: m.medicine_name,
      strength: m.strength || 'Standard strength',
      dosage: m.dosage,
      route: m.route || 'oral',
      frequency: m.frequency,
      duration: m.duration,
      special_instructions: m.special_instructions || 'None noted',
      doctor_notes: m.doctor_notes || '',
      evidence: m.transcript_evidence || null,
    }));

    const missingFields = [];
    items.forEach((item, index) => {
      if (!item.duration) missingFields.push(`Item #${index + 1}: Duration is unspecified`);
      if (!item.frequency) missingFields.push(`Item #${index + 1}: Frequency is unspecified`);
    });

    return {
      doc_type: 'prescription',
      title: `Veterinary Prescription — ${consultation.pet_name}`,
      patient: {
        pet_id: consultation.pet_id,
        name: consultation.pet_name,
        species: consultation.pet_species,
        breed: consultation.pet_breed,
        weight: consultation.pet_weight ? `${consultation.pet_weight} kg` : extraction.pet_info?.weight || 'Unrecorded',
        owner: consultation.owner_name,
      },
      prescriber: {
        doctor_id: consultation.doctor_id,
        name: consultation.doctor_name,
        license: 'VET-LIC-STATE-2026',
      },
      date_prescribed: new Date().toISOString().split('T')[0],
      items,
      dispense_instructions: 'Dispense exact quantity as formulated. Label with pet name and instructions.',
      allergies_noted: extraction.allergies || ['None reported'],
      missing_fields: missingFields,
    };
  }
}

module.exports = PrescriptionBuilder;

