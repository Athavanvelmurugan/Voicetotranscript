import React, { useState } from 'react';
import {
  X, FileText, Pill, FlaskConical, Calendar, Sparkles, CheckCircle2,
  Copy, Check, AlertTriangle, Quote, Clock, Activity, User, Stethoscope, ShieldCheck
} from 'lucide-react';

export function ClinicalInsightsModal({
  isOpen,
  onClose,
  consultation,
  documents = [],
  onApproveAll,
  isApprovingAll = false,
  onRejectAll,
  isRejectingAll = false,
  onRegenerate,
  isGenerating = false,
}) {
  const [activeTab, setActiveTab] = useState('summary');
  const [copied, setCopied] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!isOpen) return null;

  const summaryDoc      = documents.find((d) => d.doc_type === 'summary');
  const prescriptionDoc = documents.find((d) => d.doc_type === 'prescription');
  const labTestsDoc     = documents.find((d) => d.doc_type === 'lab_tests');
  const followUpDoc     = documents.find((d) => d.doc_type === 'follow_up');
  const soapDoc         = documents.find((d) => d.doc_type === 'soap_notes');

  const summaryContent      = summaryDoc?.content || {};
  const prescriptionContent = prescriptionDoc?.content || {};
  const labTestsContent     = labTestsDoc?.content || {};
  const followUpContent     = followUpDoc?.content || {};
  const soapContent         = soapDoc?.content || {};

  const medications = prescriptionContent.items || [];
  const labTests    = labTestsContent.tests || [];
  const followUp    = followUpContent.follow_up || {};
  const redFlags    = followUpContent.warning_signs || followUp.warning_signs || [];
  const monitoring  = followUpContent.monitoring_instructions || followUp.monitoring_instructions || [];

  // Robust fallback-aware clinical summary fields
  const chiefComplaints = (summaryContent.chief_complaints && summaryContent.chief_complaints.length > 0)
    ? summaryContent.chief_complaints
    : (soapContent.S?.chief_complaint ? [soapContent.S.chief_complaint] : []);

  const rawSymptoms = summaryContent.symptoms || summaryContent.symptoms_overview || soapContent.S?.reported_symptoms || [];
  const symptomsList = rawSymptoms.map(s => {
    if (typeof s === 'string') return { symptom: s, duration: null, severity: 'unspecified' };
    return {
      symptom: s.symptom || s.name || 'Reported symptom',
      duration: s.duration || null,
      severity: s.severity || 'unspecified',
      reported_by: s.reported_by || 'owner',
      quote: s.transcript_evidence?.quote || s.evidence?.quote || null,
    };
  });

  const diagnosesList = (summaryContent.diagnoses && summaryContent.diagnoses.length > 0)
    ? summaryContent.diagnoses
    : (summaryContent.assessment_conclusions && summaryContent.assessment_conclusions.length > 0
        ? summaryContent.assessment_conclusions.map(c => ({ condition: c, type: 'suspected' }))
        : (soapContent.A?.primary_diagnoses || []));

  const examFindings = summaryContent.clinical_examination_summary || soapContent.O?.physical_examination || [];
  const missingAlerts = summaryContent.missing_information_alert || soapContent.missing_fields || [];

  const overviewNarrative = summaryContent.overview || summaryContent.clinical_narrative ||
    (chiefComplaints.length > 0
      ? `${consultation?.pet_name || 'Patient'} presented for examination. Chief concerns: ${chiefComplaints.join(', ')}.${symptomsList.length > 0 ? ' Reported symptoms: ' + symptomsList.map(s => s.symptom).join(', ') + '.' : ''} Examined by ${consultation?.doctor_name || 'attending veterinarian'}.`
      : 'Consultation completed. Patient examined with clinical parameters reviewed across clinical sections.');

  const handleCopySummary = () => {
    const textLines = [
      `=== AI CLINICAL INSIGHTS: ${consultation?.pet_name || 'Patient'} ===`,
      `Attending Veterinarian: ${consultation?.doctor_name || 'Veterinarian'}`,
      `Pet Owner: ${consultation?.owner_name || 'Owner'}`,
      `Species / Breed: ${consultation?.pet_species || 'Canine'} (${consultation?.pet_breed || 'Mixed'})`,
      '',
      '--- 1. CLINICAL OVERVIEW & COMPLAINTS ---',
      overviewNarrative,
      chiefComplaints.length > 0 ? `Chief Complaints: ${chiefComplaints.join(', ')}` : '',
      symptomsList.length > 0
        ? `Symptoms: ${symptomsList.map(s => `${s.symptom}${s.duration ? ' (' + s.duration + ')' : ''}`).join('; ')}`
        : '',
      diagnosesList.length > 0
        ? `Assessment: ${diagnosesList.map(d => `${d.type === 'confirmed' ? '[CONFIRMED]' : '[SUSPECTED]'} ${d.condition || d}`).join('; ')}`
        : '',
      '',
      '--- 2. MEDICATIONS ---',
      medications.length > 0
        ? medications.map((m, i) => `${i + 1}. ${m.medicine_name} — ${m.dosage} (${m.route}), ${m.frequency} for ${m.duration}`).join('\n')
        : 'No prescription medications detected.',
      '',
      '--- 3. LAB TESTS & BIOMARKERS ---',
      labTests.length > 0
        ? labTests.map((t, i) => `${i + 1}. [${t.status?.toUpperCase() || 'ORDERED'}] ${t.test_name} (Biomarker: ${t.biomarker || 'Standard'}) - ${t.clinical_reason || 'Diagnostic'}`).join('\n')
        : 'No specific laboratory investigations ordered.',
      '',
      '--- 4. FOLLOW-UPS & RED FLAGS ---',
      `Re-check Timeframe: ${followUpContent.timeframe || followUp.timeframe || 'PRN (as needed)'}`,
      monitoring.length > 0 ? `Monitoring: ${monitoring.join('; ')}` : '',
      redFlags.length > 0 ? `EMERGENCY RED FLAGS: ${redFlags.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(textLines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(console.error);
  };

  return (
    <div className="modal-overlay modal-overlay--insights" onClick={onClose}>
      <div
        className="modal-content consult-modal-content modal-insights-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="modal-header--insights">
          <div>
            <div className="insights-header-top">
              <Sparkles size={20} className="icon-on-primary" />
              <h2 className="insights-header-title">
                AI Clinical Insights & Templates — {consultation?.pet_name || 'Patient'}
              </h2>
            </div>
            <div className="insights-meta-pills">
              <span className="insights-meta-pill">
                <Stethoscope size={12} /> {consultation?.doctor_name || 'Veterinarian'}
              </span>
              <span className="insights-meta-pill">
                <User size={12} /> Owner: {consultation?.owner_name || 'Owner'}
              </span>
              <span className="insights-meta-pill">
                <Activity size={12} /> {consultation?.pet_species || 'Canine'} ({consultation?.pet_breed || 'Mixed'})
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="insights-close-btn"
            title="Close popup"
            aria-label="Close clinical insights modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Tabs Navigation ─── */}
        <div className="insights-tabs-bar">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`insights-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          >
            <FileText size={15} /> Summary
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('medicine')}
            className={`insights-tab-btn ${activeTab === 'medicine' ? 'active' : ''}`}
          >
            <Pill size={15} /> Medicine ({medications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`insights-tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
          >
            <FlaskConical size={15} /> Tests & Biomarkers ({labTests.length})
          </button>
        </div>

        {/* ─── Modal Body Content ─── */}
        <div className="insights-body">
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="insights-stack">
              {/* 1. Clinical Overview Narrative Card */}
              <div className="insights-card insights-card--overview">
                <div className="insights-card-header">
                  <Sparkles size={16} className="icon-primary" />
                  <h3 className="insights-card-title">
                    Clinical Overview Narrative
                  </h3>
                </div>
                <p className="insights-narrative-text">
                  {overviewNarrative}
                </p>
              </div>

              {/* 2. Chief Complaints & Symptoms Card */}
              {(chiefComplaints.length > 0 || symptomsList.length > 0) && (
                <div className="insights-card insights-card--soft">
                  <div className="insights-card-header">
                    <Activity size={16} className="icon-primary" />
                    <h4 className="insights-card-title">
                      Chief Complaints & Reported Symptoms
                    </h4>
                  </div>

                  {chiefComplaints.length > 0 && (
                    <div className="insights-complaint-chips">
                      {chiefComplaints.map((cc, i) => (
                        <span key={i} className="insights-complaint-chip">
                          • {cc}
                        </span>
                      ))}
                    </div>
                  )}

                  {symptomsList.length > 0 && (
                    <div className="insights-list-stack">
                      {symptomsList.map((s, i) => (
                        <div key={i} className="insights-list-row">
                          <div>
                            <span className="insights-symptom-name">
                              {s.symptom}
                            </span>
                            {s.duration && (
                              <span className="insights-symptom-duration">
                                (Duration: {s.duration})
                              </span>
                            )}
                            {s.quote && (
                              <div className="insights-symptom-quote">
                                Quote: "{s.quote}"
                              </div>
                            )}
                          </div>
                          <span
                            className={`badge insights-badge-cap ${s.severity === 'severe' ? 'badge-danger' : s.severity === 'moderate' ? 'badge-warning' : 'badge-info'}`}
                          >
                            {s.severity || 'Reported'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Physical Examination Findings */}
              {examFindings.length > 0 && (
                <div className="insights-card">
                  <div className="insights-card-header">
                    <Stethoscope size={16} className="icon-primary" />
                    <h4 className="insights-card-title">
                      Physical Examination Findings
                    </h4>
                  </div>
                  <div className="insights-list-stack">
                    {examFindings.map((f, i) => (
                      <div key={i} className="insights-exam-item">
                        ✓ {typeof f === 'string' ? f : f.finding || JSON.stringify(f)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Diagnoses Card */}
              <div className="insights-card">
                <div className="insights-card-header">
                  <ShieldCheck size={16} className="icon-primary" />
                  <h4 className="insights-card-title">
                    Clinical Assessment & Diagnoses
                  </h4>
                </div>
                {diagnosesList.length === 0 ? (
                  <p className="insights-empty-note">
                    No acute pathology confirmed at present examination. Patient triaged for home monitoring.
                  </p>
                ) : (
                  <div className="insights-list-stack">
                    {diagnosesList.map((d, i) => (
                      <div key={i} className="insights-list-row">
                        <div>
                          <span className="insights-diagnosis-name">
                            {typeof d === 'string' ? d : d.condition || d.name}
                          </span>
                          {d.clinical_reasoning && (
                            <span className="insights-diagnosis-reason">— {d.clinical_reasoning}</span>
                          )}
                        </div>
                        <span
                          className={`badge insights-badge-cap ${d.type === 'confirmed' ? 'badge-success' : 'badge-warning'}`}
                        >
                          {d.type || 'Suspected'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Owner Guidance Card */}
              <div className="insights-card insights-card--info">
                <div className="insights-card-header">
                  <User size={16} className="insights-card-title--info" />
                  <h4 className="insights-card-title insights-card-title--info">
                    Owner Home Care & Discharge Guidance
                  </h4>
                </div>
                <p className="insights-info-text">
                  {summaryContent.owner_guidance ||
                    (followUp.monitoring_instructions && followUp.monitoring_instructions.length > 0
                      ? followUp.monitoring_instructions.join('. ')
                      : `Observe ${consultation?.pet_name || 'patient'} closely at home. Maintain access to fresh water and monitor appetite. Contact the clinic if condition changes.`)}
                </p>
              </div>

              {/* 6. Missing Information / Safety Guardrail Notice */}
              {missingAlerts.length > 0 && (
                <div className="insights-card insights-card--warning">
                  <div className="insights-card-header">
                    <AlertTriangle size={15} className="icon-warning" />
                    <span className="insights-warning-title">
                      Clinical Safety & Information Checklist
                    </span>
                  </div>
                  <ul className="insights-warning-list">
                    {missingAlerts.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MEDICINE */}
          {activeTab === 'medicine' && (
            <div className="insights-stack">
              {medications.length === 0 ? (
                <div className="insights-empty-panel">
                  <Pill size={32} className="insights-empty-panel-icon" />
                  <p className="insights-empty-panel-title">
                    No prescription medications detected in consultation audio.
                  </p>
                  <p className="insights-empty-panel-sub">
                    If medications are needed, you can add them directly in the Prescription document tab.
                  </p>
                </div>
              ) : (
                medications.map((item, idx) => (
                  <div key={idx} className="insights-card">
                    <div className="insights-item-header">
                      <span className="insights-med-title">
                        #{idx + 1} {item.medicine_name} {item.strength ? `(${item.strength})` : ''}
                      </span>
                      <span className="badge badge-info insights-badge-cap">
                        {item.route || 'Oral'}
                      </span>
                    </div>

                    <div className="insights-med-grid">
                      <div>
                        <strong className="insights-field-label">Dosage:</strong> {item.dosage || 'Standard'}
                      </div>
                      <div>
                        <strong className="insights-field-label">Frequency:</strong> {item.frequency || 'As directed'}
                      </div>
                      <div>
                        <strong className="insights-field-label">Duration:</strong> {item.duration || 'As directed'}
                      </div>
                    </div>

                    {item.special_instructions && (
                      <div className="insights-note-strip">
                        <strong>Instructions:</strong> {item.special_instructions}
                      </div>
                    )}

                    {item.evidence && (
                      <div className="evidence-pill">
                        <Quote size={12} />
                        <span>"{item.evidence.quote}" ({item.evidence.speaker})</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: TESTS (BIOMARKERS) */}
          {activeTab === 'tests' && (
            <div className="insights-stack">
              {labTests.length === 0 ? (
                <div className="insights-empty-panel">
                  <FlaskConical size={32} className="insights-empty-panel-icon" />
                  <p className="insights-empty-panel-title">
                    No laboratory tests or diagnostic biomarkers ordered.
                  </p>
                  <p className="insights-empty-panel-sub">
                    Diagnostics can be requested or customized in the Lab Tests document tab.
                  </p>
                </div>
              ) : (
                labTests.map((test, idx) => (
                  <div key={idx} className="insights-card">
                    <div className="insights-item-header">
                      <span className="insights-test-title">
                        #{idx + 1} {test.test_name}
                      </span>
                      <div className="insights-test-badges">
                        <span className="badge badge-info insights-badge-upper">
                          {test.status || 'ORDERED'}
                        </span>
                        <span className={`badge insights-badge-upper ${test.priority === 'urgent' ? 'badge-danger' : 'badge-purple'}`}>
                          {test.priority || 'ROUTINE'}
                        </span>
                      </div>
                    </div>

                    <div className="insights-test-body">
                      <div>
                        <strong className="insights-field-label">Target Biomarker / Panel:</strong>{' '}
                        <span className="insights-biomarker-val">{test.biomarker || 'Standard diagnostic panel'}</span>
                      </div>
                      {test.clinical_reason && (
                        <div>
                          <strong className="insights-field-label">Clinical Indication:</strong> {test.clinical_reason}
                        </div>
                      )}
                      {test.instructions && (
                        <div className="insights-note-strip">
                          <strong>Patient Preparation:</strong> {test.instructions}
                        </div>
                      )}
                    </div>

                    {test.evidence && (
                      <div className="evidence-pill">
                        <Quote size={12} />
                        <span>"{test.evidence.quote}" ({test.evidence.speaker})</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: FOLLOW-UPS */}
          {activeTab === 'followup' && (
            <div className="insights-stack">
              {/* Timeframe Card */}
              <div className="insights-schedule-card">
                <Clock size={20} className="icon-primary" />
                <div>
                  <div className="insights-schedule-label">
                    Recommended Re-check Schedule
                  </div>
                  <div className="insights-schedule-val">
                    {followUpContent.timeframe || followUp.timeframe || 'PRN (As needed or if symptoms persist)'}
                  </div>
                </div>
              </div>

              {/* Home Monitoring Instructions */}
              <div className="insights-card">
                <h4 className="insights-card-title">
                  Owner Monitoring Checklist
                </h4>
                {monitoring.length > 0 ? (
                  <ul className="insights-checklist">
                    {monitoring.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="insights-empty-note">
                    Monitor appetite, activity level, hydration, and report any recurrence of symptoms.
                  </p>
                )}
              </div>

              {/* Emergency Red Flags */}
              <div className="insights-card insights-card--danger">
                <div className="insights-card-header insights-card-title--danger">
                  <AlertTriangle size={18} />
                  <h4 className="insights-card-title insights-card-title--danger">
                    Emergency Red-Flag Warning Signs
                  </h4>
                </div>
                {redFlags.length > 0 ? (
                  <ul className="insights-checklist insights-checklist--danger">
                    {redFlags.map((flag, idx) => (
                      <li key={idx}><strong>{flag}</strong> — Seek immediate emergency veterinary attention</li>
                    ))}
                  </ul>
                ) : (
                  <p className="insights-empty-note insights-checklist--danger">
                    Seek immediate emergency veterinary care if the patient shows difficulty breathing, collapse, extreme lethargy, or uncontrolled vomiting.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Rejection Reason Prompt (Modal Level) ─── */}
        {showRejectBox && (
          <div className="insights-reject-panel">
            <div className="insights-reject-header">
              <span className="insights-reject-title">
                <AlertTriangle size={15} className="icon-danger" /> Reject AI Clinical Documentation
              </span>
              <button
                type="button"
                onClick={() => setShowRejectBox(false)}
                className="insights-reject-close"
                aria-label="Close rejection note"
              >
                <X size={14} />
              </button>
            </div>
            <p className="insights-reject-desc">
              Please specify why the AI draft is being rejected (e.g. incorrect medication, missing diagnosis, needs re-transcription):
            </p>
            <textarea
              className="form-control insights-reject-textarea"
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Clinical reason for rejection..."
            />
            <div className="insights-reject-actions">
              <button
                type="button"
                className="btn btn-outline doc-action-btn"
                onClick={() => setShowRejectBox(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger doc-action-btn"
                disabled={isRejectingAll}
                onClick={() => onRejectAll && onRejectAll(rejectReason || 'Clinician rejected AI clinical draft')}
              >
                {isRejectingAll ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Footer Action Bar ─── */}
        <div className="insights-footer">
          <div className="insights-footer-group">
            <button
              type="button"
              className="btn btn-outline insights-footer-btn"
              onClick={handleCopySummary}
            >
              {copied ? <Check size={14} className="icon-success" /> : <Copy size={14} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Summary'}
            </button>

            {onRegenerate && (
              <button
                type="button"
                className="btn btn-outline insights-footer-btn"
                onClick={onRegenerate}
                disabled={isGenerating}
                title="Re-run AI extraction across current transcripts to update templates"
              >
                <Sparkles size={14} className="icon-primary" />
                {isGenerating ? 'Extracting with AI...' : 'Re-generate with AI'}
              </button>
            )}
          </div>

          <div className="insights-footer-group">
            <button
              type="button"
              className="btn btn-outline insights-footer-btn"
              onClick={onClose}
              title="Close modal to edit individual fields in right panel"
            >
              Edit in Workspace
            </button>

            {onRejectAll && (
              <button
                type="button"
                className="btn btn-danger insights-footer-btn"
                onClick={() => setShowRejectBox(true)}
                disabled={isRejectingAll || isApprovingAll}
              >
                <X size={14} />
                {isRejectingAll ? 'Rejecting...' : 'Reject AI Draft'}
              </button>
            )}

            {onApproveAll && (
              <button
                type="button"
                className="btn btn-success insights-footer-btn"
                onClick={onApproveAll}
                disabled={isApprovingAll || isRejectingAll}
              >
                <ShieldCheck size={14} />
                {isApprovingAll ? 'Approving All...' : 'Approve & Sign All'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

