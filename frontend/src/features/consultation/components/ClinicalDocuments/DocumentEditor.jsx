import React from 'react';
import { AlertCircle, Quote, Plus, Trash2, Pill } from 'lucide-react';

export function DocumentEditor({
  document,
  formData,
  onChangeField,
  isApproved,
}) {
  if (!document || !formData) {
    return (
      <div className="doc-empty-state">
        <p className="doc-empty-state-title">No Document Generated Yet</p>
        <p className="doc-empty-state-sub">
          Stop the live recording or click "Generate Clinical Documents" to populate drafts.
        </p>
      </div>
    );
  }

  const { doc_type, missing_fields } = document;

  const handleAddMedication = () => {
    const current = formData.items || [];
    const newItem = {
      item_number: current.length + 1,
      medicine_name: '',
      strength: '',
      dosage: '',
      route: 'oral',
      frequency: 'Once daily',
      duration: '7 days',
      special_instructions: '',
      doctor_notes: '',
    };
    onChangeField('items', [...current, newItem]);
  };

  const handleRemoveMedication = (idxToRemove) => {
    const current = formData.items || [];
    const updated = current.filter((_, idx) => idx !== idxToRemove).map((item, idx) => ({
      ...item,
      item_number: idx + 1,
    }));
    onChangeField('items', updated);
  };

  return (
    <div className="doc-editor-stack">
      {/* Missing Information Alert Box */}
      {missing_fields && missing_fields.length > 0 && (
        <div className="missing-info-box">
          <h4>
            <AlertCircle size={14} /> Missing Clinical Information Identified
          </h4>
          <ul>
            {missing_fields.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. PRESCRIPTION TEMPLATE */}
      {doc_type === 'prescription' && (
        <>
          <div className="form-section">
            <div className="form-section-header">
              <h3>
                <Pill size={18} className="icon-primary" /> Prescribed Medications
              </h3>
              {!isApproved && (
                <button
                  type="button"
                  className="btn btn-outline doc-action-btn"
                  onClick={handleAddMedication}
                >
                  <Plus size={14} /> Add Medication
                </button>
              )}
            </div>

            {(!formData.items || formData.items.length === 0) ? (
              <div className="doc-empty-inline-box">
                <p className="doc-empty-inline-text">
                  No prescription medications detected in consultation audio. Click below to add medications or write instructions in Doctor Notes.
                </p>
                {!isApproved && (
                  <button
                    type="button"
                    className="btn btn-outline doc-action-btn"
                    onClick={handleAddMedication}
                  >
                    <Plus size={14} /> Add Medication Manually
                  </button>
                )}
              </div>
            ) : (
              formData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="doc-subcard"
                >
                  <div className="doc-subcard-header">
                    <div className="doc-subcard-title">
                      Item #{idx + 1}: {item.medicine_name || 'New Medication'}
                    </div>
                    {!isApproved && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(idx)}
                        className="doc-remove-btn"
                        title="Remove item"
                        aria-label={`Remove medication ${idx + 1}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                  <div className="form-group">
                    <label>Medicine Name</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={isApproved}
                      value={item.medicine_name || ''}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].medicine_name = e.target.value;
                        onChangeField('items', newItems);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Dosage & Strength</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={isApproved}
                      value={item.dosage || ''}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].dosage = e.target.value;
                        onChangeField('items', newItems);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Route</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={isApproved}
                      value={item.route || ''}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].route = e.target.value;
                        onChangeField('items', newItems);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Frequency</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={isApproved}
                      value={item.frequency || ''}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].frequency = e.target.value;
                        onChangeField('items', newItems);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Duration</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={isApproved}
                      value={item.duration || ''}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].duration = e.target.value;
                        onChangeField('items', newItems);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Special Instructions</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={isApproved}
                      value={item.special_instructions || ''}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].special_instructions = e.target.value;
                        onChangeField('items', newItems);
                      }}
                    />
                  </div>
                </div>

                {item.evidence && (
                  <div className="evidence-pill">
                    <Quote size={12} />
                    <span>Evidence: "{item.evidence.quote}" ({item.evidence.speaker})</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

          <div className="form-section">
            <h3>Doctor Notes & Dispense Instructions</h3>
            <div className="form-group">
              <label>Doctor Notes</label>
              <textarea
                className="form-control"
                disabled={isApproved}
                value={formData.doctor_notes || ''}
                onChange={(e) => onChangeField('doctor_notes', e.target.value)}
                placeholder="Additional instructions or veterinary annotations..."
              />
            </div>
          </div>
        </>
      )}

      {/* 2. LAB TESTS TEMPLATE */}
      {doc_type === 'lab_tests' && (
        <div className="form-section">
          <h3>Laboratory Investigations</h3>
          {(formData.tests || []).map((t, idx) => (
            <div
              key={idx}
              className="doc-subcard"
            >
              <div className="doc-subcard-header">
                <span className="doc-subcard-title">#{idx + 1} {t.test_name}</span>
                <span className="badge badge-info">{t.status.toUpperCase()}</span>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Biomarker / Target</label>
                  <input
                    type="text"
                    className="form-control"
                    disabled={isApproved}
                    value={t.biomarker || ''}
                    onChange={(e) => {
                      const newTests = [...formData.tests];
                      newTests[idx].biomarker = e.target.value;
                      onChangeField('tests', newTests);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-control"
                    disabled={isApproved}
                    value={t.status || 'discussed'}
                    onChange={(e) => {
                      const newTests = [...formData.tests];
                      newTests[idx].status = e.target.value;
                      onChangeField('tests', newTests);
                    }}
                  >
                    <option value="discussed">Discussed</option>
                    <option value="recommended">Recommended</option>
                    <option value="ordered">Ordered</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    className="form-control"
                    disabled={isApproved}
                    value={t.priority || 'routine'}
                    onChange={(e) => {
                      const newTests = [...formData.tests];
                      newTests[idx].priority = e.target.value;
                      onChangeField('tests', newTests);
                    }}
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT (Immediate)</option>
                  </select>
                </div>
                <div className="form-group form-group-span-full">
                  <label>Clinical Reason</label>
                  <input
                    type="text"
                    className="form-control"
                    disabled={isApproved}
                    value={t.clinical_reason || ''}
                    onChange={(e) => {
                      const newTests = [...formData.tests];
                      newTests[idx].clinical_reason = e.target.value;
                      onChangeField('tests', newTests);
                    }}
                  />
                </div>
              </div>

              {t.evidence && (
                <div className="evidence-pill">
                  <Quote size={12} />
                  <span>Evidence: "{t.evidence.quote}"</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. SOAP NOTES TEMPLATE */}
      {doc_type === 'soap_notes' && (
        <>
          <div className="form-section">
            <h3>S — Subjective (Pet Owner Reported)</h3>
            <div className="form-group">
              <label>Chief Complaint</label>
              <input
                type="text"
                className="form-control"
                disabled={isApproved}
                value={formData.S?.chief_complaint || ''}
                onChange={(e) => onChangeField('S', { ...formData.S, chief_complaint: e.target.value })}
              />
            </div>
            <div className="doc-sublabel-group">
              <label className="doc-sublabel">REPORTED SYMPTOMS</label>
              {(formData.S?.reported_symptoms || []).map((s, i) => (
                <div key={i} className="doc-symptom-row">
                  <strong>{s.symptom}</strong> (Duration: {s.duration})
                  {s.evidence && <span className="doc-symptom-evidence">— "{s.evidence}"</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>O — Objective (Veterinarian Examination & Vitals)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Temperature</label>
                <input
                  type="text"
                  className="form-control"
                  disabled={isApproved}
                  value={formData.O?.vitals?.temperature || ''}
                  onChange={(e) => onChangeField('O', { ...formData.O, vitals: { ...formData.O?.vitals, temperature: e.target.value } })}
                />
              </div>
              <div className="form-group">
                <label>Heart Rate</label>
                <input
                  type="text"
                  className="form-control"
                  disabled={isApproved}
                  value={formData.O?.vitals?.heart_rate || ''}
                  onChange={(e) => onChangeField('O', { ...formData.O, vitals: { ...formData.O?.vitals, heart_rate: e.target.value } })}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>A — Assessment (Diagnoses & Differentials)</h3>
            <div className="form-group">
              <label>Assessment Details</label>
              <textarea
                className="form-control"
                disabled={isApproved}
                value={formData.A?.clinical_notes || ''}
                onChange={(e) => onChangeField('A', { ...formData.A, clinical_notes: e.target.value })}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>P — Plan (Treatment & Follow-up)</h3>
            <div className="form-group">
              <label>Plan Details</label>
              <textarea
                className="form-control"
                disabled={isApproved}
                value={formData.P?.follow_up || ''}
                onChange={(e) => onChangeField('P', { ...formData.P, follow_up: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      {/* 4. FOLLOW-UP TEMPLATE */}
      {doc_type === 'follow_up' && (
        <div className="form-section">
          <h3>Follow-up & Monitoring Plan</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Timeframe</label>
              <input
                type="text"
                className="form-control"
                disabled={isApproved}
                value={formData.follow_up_timeframe || ''}
                onChange={(e) => onChangeField('follow_up_timeframe', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Reason For Revisit</label>
              <input
                type="text"
                className="form-control"
                disabled={isApproved}
                value={formData.reason_for_revisit || ''}
                onChange={(e) => onChangeField('reason_for_revisit', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. SUMMARY TEMPLATE */}
      {doc_type === 'summary' && (
        <div className="form-section form-section--summary">
          <h3>Comprehensive Consultation Summary</h3>

          {/* Clinical Overview Narrative */}
          <div className="form-group">
            <label className="doc-summary-narrative-label">Clinical Overview Narrative</label>
            <textarea
              className="form-control doc-summary-textarea"
              rows={4}
              disabled={isApproved}
              value={formData.overview || formData.clinical_narrative || ''}
              onChange={(e) => onChangeField('overview', e.target.value)}
              placeholder="Synthesized clinical narrative of the consultation presentation and assessment..."
            />
          </div>

          {/* Chief Complaints */}
          <div className="form-group">
            <label className="doc-summary-field-label">Chief Complaints</label>
            <input
              type="text"
              className="form-control"
              disabled={isApproved}
              value={(formData.chief_complaints || []).join(', ')}
              onChange={(e) => onChangeField('chief_complaints', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>

          {/* Symptoms Overview */}
          {(formData.symptoms_overview || formData.symptoms) && (
            <div className="doc-surface-block">
              <label className="doc-surface-label">
                Symptoms Overview & Timeline
              </label>
              {(formData.symptoms_overview || []).length > 0 ? (
                <ul className="doc-surface-list">
                  {(formData.symptoms_overview || []).map((s, idx) => (
                    <li key={idx} className="doc-surface-item">{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="doc-surface-empty doc-surface-empty--italic">
                  No specific symptoms reported in consultation audio.
                </p>
              )}
            </div>
          )}

          {/* Clinical Examination Findings */}
          <div className="doc-surface-block">
            <label className="doc-surface-label">
              Physical Examination & Abnormal Findings
            </label>
            {(formData.clinical_examination_summary || []).length > 0 ? (
              <ul className="doc-surface-list">
                {(formData.clinical_examination_summary || []).map((f, idx) => (
                  <li key={idx} className="doc-surface-item">{f}</li>
                ))}
              </ul>
            ) : (
              <p className="doc-surface-empty">
                Physical examination parameters reviewed within normal baseline.
              </p>
            )}
          </div>

          {/* Assessment Conclusions */}
          <div className="doc-surface-block">
            <label className="doc-surface-label">
              Assessment Conclusions & Diagnoses
            </label>
            {(formData.assessment_conclusions || []).length > 0 ? (
              <ul className="doc-surface-list">
                {(formData.assessment_conclusions || []).map((c, idx) => (
                  <li key={idx} className="doc-surface-item doc-surface-item--diagnosis">{c}</li>
                ))}
              </ul>
            ) : (
              <p className="doc-surface-empty">
                No acute pathology confirmed at present examination.
              </p>
            )}
          </div>

          {/* Treatment Plan & Investigations */}
          <div className="doc-two-col-summary">
            <div className="doc-surface-block doc-surface-block--compact">
              <label className="doc-surface-label">
                Prescribed Medications
              </label>
              {(formData.prescribed_treatment_plan || []).length > 0 ? (
                <ul className="doc-surface-list">
                  {(formData.prescribed_treatment_plan || []).map((p, idx) => (
                    <li key={idx} className="doc-surface-item doc-surface-item--compact">{p}</li>
                  ))}
                </ul>
              ) : (
                <span className="doc-surface-empty doc-surface-empty--italic">None prescribed in audio</span>
              )}
            </div>

            <div className="doc-surface-block doc-surface-block--compact">
              <label className="doc-surface-label">
                Recommended Lab Tests
              </label>
              {(formData.recommended_investigations || []).length > 0 ? (
                <ul className="doc-surface-list">
                  {(formData.recommended_investigations || []).map((l, idx) => (
                    <li key={idx} className="doc-surface-item doc-surface-item--compact">{l}</li>
                  ))}
                </ul>
              ) : (
                <span className="doc-surface-empty doc-surface-empty--italic">None ordered in audio</span>
              )}
            </div>
          </div>

          {/* Client Instructions & Follow-up */}
          <div className="form-group">
            <label className="doc-summary-field-label">Client Home Care & Follow-up Instructions</label>
            <textarea
              className="form-control"
              rows={2}
              disabled={isApproved}
              value={formData.owner_guidance || formData.client_instructions_and_follow_up?.key_instructions?.join('. ') || ''}
              onChange={(e) => onChangeField('owner_guidance', e.target.value)}
              placeholder="Home care instructions, re-check schedule..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

