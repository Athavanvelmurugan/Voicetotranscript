class FollowUpBuilder {
  static build(extraction, consultation) {
    const fu = extraction.follow_up || {};

    return {
      doc_type: 'follow_up',
      title: `Follow-up & Monitoring Plan — ${consultation.pet_name}`,
      patient: {
        pet_id: consultation.pet_id,
        name: consultation.pet_name,
        species: consultation.pet_species,
        owner_name: consultation.owner_name,
        owner_contact: consultation.owner_contact,
      },
      attending_doctor: consultation.doctor_name,
      follow_up_timeframe: fu.timeframe || '5-7 business days',
      recommended_date: fu.recommended_date || null,
      reason_for_revisit: fu.reason || 'Re-assessment of symptoms and response to medical therapy',
      home_care_and_monitoring: fu.monitoring_instructions || [
        'Observe appetite and fluid intake closely',
        'Record frequency of coughing or abnormal events',
      ],
      warning_signs_red_flags: fu.warning_signs || [
        'Difficulty or rapid shallow breathing at rest',
        'Sudden collapse, lethargy, or blueish gums',
      ],
      next_appointment_action: 'Client to call clinic to confirm revisit slot or book online',
      missing_fields: !fu.timeframe ? ['Recommended follow-up timeframe was not explicitly agreed upon'] : [],
    };
  }
}

module.exports = FollowUpBuilder;

