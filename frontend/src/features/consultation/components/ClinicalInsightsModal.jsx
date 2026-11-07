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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '860px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* ─── Header ─── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            boxShadow: '0 2px 8px rgba(12, 74, 110, 0.2)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={20} color="#38bdf8" />
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 750, color: '#ffffff', letterSpacing: '-0.015em' }}>
                AI Clinical Insights & Templates — {consultation?.pet_name || 'Patient'}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.8rem', opacity: 0.95 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.12)', padding: '2px 8px', borderRadius: '9999px' }}>
                <Stethoscope size={12} /> {consultation?.doctor_name || 'Veterinarian'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.12)', padding: '2px 8px', borderRadius: '9999px' }}>
                <User size={12} /> Owner: {consultation?.owner_name || 'Owner'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.12)', padding: '2px 8px', borderRadius: '9999px' }}>
                <Activity size={12} /> {consultation?.pet_species || 'Canine'} ({consultation?.pet_breed || 'Mixed'})
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close popup"
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Tabs Navigation ─── */}
        <div
          style={{
            display: 'flex',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '4px 16px 0 16px',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'summary' ? '3px solid #0284c7' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'summary' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'summary' ? 700 : 500,
              fontSize: '0.86rem',
              cursor: 'pointer',
            }}
          >
            <FileText size={15} /> Summary
          </button>

          <button
            onClick={() => setActiveTab('medicine')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'medicine' ? '3px solid #0284c7' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'medicine' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'medicine' ? 700 : 500,
              fontSize: '0.86rem',
              cursor: 'pointer',
            }}
          >
            <Pill size={15} /> Medicine ({medications.length})
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'tests' ? '3px solid #0284c7' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'tests' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'tests' ? 700 : 500,
              fontSize: '0.86rem',
              cursor: 'pointer',
            }}
          >
            <FlaskConical size={15} /> Tests & Biomarkers ({labTests.length})
          </button>
        </div>

        {/* ─── Modal Body Content ─── */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, maxHeight: '60vh' }}>
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1. Clinical Overview Narrative Card */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #0284c7', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Sparkles size={16} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: '0.96rem', color: '#0f172a', fontWeight: 750 }}>
                    Clinical Overview Narrative
                  </h3>
                </div>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.90rem', lineHeight: 1.65 }}>
                  {overviewNarrative}
                </p>
              </div>

              {/* 2. Chief Complaints & Symptoms Card */}
              {(chiefComplaints.length > 0 || symptomsList.length > 0) && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Activity size={16} color="#0284c7" />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                      Chief Complaints & Reported Symptoms
                    </h4>
                  </div>

                  {chiefComplaints.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {chiefComplaints.map((cc, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            borderRadius: '16px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          • {cc}
                        </span>
                      ))}
                    </div>
                  )}

                  {symptomsList.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {symptomsList.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '10px 14px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.86rem' }}>
                              {s.symptom}
                            </span>
                            {s.duration && (
                              <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: '8px' }}>
                                (Duration: {s.duration})
                              </span>
                            )}
                            {s.quote && (
                              <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '2px' }}>
                                Quote: "{s.quote}"
                              </div>
                            )}
                          </div>
                          <span
                            className={`badge ${s.severity === 'severe' ? 'badge-danger' : s.severity === 'moderate' ? 'badge-warning' : 'badge-info'}`}
                            style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}
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
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px 20px', background: '#ffffff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <Stethoscope size={16} color="#0284c7" />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                      Physical Examination Findings
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {examFindings.map((f, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', color: '#334155', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px' }}>
                        ✓ {typeof f === 'string' ? f : f.finding || JSON.stringify(f)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Diagnoses Card */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px 20px', background: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldCheck size={16} color="#0284c7" />
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                    Clinical Assessment & Diagnoses
                  </h4>
                </div>
                {diagnosesList.length === 0 ? (
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    No acute pathology confirmed at present examination. Patient triaged for home monitoring.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {diagnosesList.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 14px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: '#0284c7' }}>
                            {typeof d === 'string' ? d : d.condition || d.name}
                          </span>
                          {d.clinical_reasoning && (
                            <span style={{ color: '#64748b', marginLeft: '8px' }}>— {d.clinical_reasoning}</span>
                          )}
                        </div>
                        <span
                          className={`badge ${d.type === 'confirmed' ? 'badge-success' : 'badge-warning'}`}
                          style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}
                        >
                          {d.type || 'Suspected'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Owner Guidance Card */}
              <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <User size={16} color="#1e40af" />
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af', fontWeight: 700 }}>
                    Owner Home Care & Discharge Guidance
                  </h4>
                </div>
                <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.86rem', lineHeight: 1.55 }}>
                  {summaryContent.owner_guidance ||
                    (followUp.monitoring_instructions && followUp.monitoring_instructions.length > 0
                      ? followUp.monitoring_instructions.join('. ')
                      : `Observe ${consultation?.pet_name || 'patient'} closely at home. Maintain access to fresh water and monitor appetite. Contact the clinic if condition changes.`)}
                </p>
              </div>

              {/* 6. Missing Information / Safety Guardrail Notice */}
              {missingAlerts.length > 0 && (
                <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '12px', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <AlertTriangle size={15} color="#d97706" />
                    <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#92400e' }}>
                      Clinical Safety & Information Checklist
                    </span>
                  </div>
                  <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.80rem', color: '#78350f' }}>
                    {missingAlerts.map((m, idx) => (
                      <li key={idx} style={{ marginBottom: '2px' }}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MEDICINE */}
          {activeTab === 'medicine' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {medications.length === 0 ? (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '32px 20px', textAlign: 'center' }}>
                  <Pill size={32} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ fontWeight: 600, color: '#475569', fontSize: '0.92rem', margin: 0 }}>
                    No prescription medications detected in consultation audio.
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>
                    If medications are needed, you can add them directly in the Prescription document tab.
                  </p>
                </div>
              ) : (
                medications.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0284c7' }}>
                        #{idx + 1} {item.medicine_name} {item.strength ? `(${item.strength})` : ''}
                      </span>
                      <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                        {item.route || 'Oral'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                      <div>
                        <strong style={{ color: '#64748b' }}>Dosage:</strong> {item.dosage || 'Standard'}
                      </div>
                      <div>
                        <strong style={{ color: '#64748b' }}>Frequency:</strong> {item.frequency || 'As directed'}
                      </div>
                      <div>
                        <strong style={{ color: '#64748b' }}>Duration:</strong> {item.duration || 'As directed'}
                      </div>
                    </div>

                    {item.special_instructions && (
                      <div style={{ marginTop: '10px', fontSize: '0.83rem', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                        <strong>Instructions:</strong> {item.special_instructions}
                      </div>
                    )}

                    {item.evidence && (
                      <div className="evidence-pill" style={{ marginTop: '10px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {labTests.length === 0 ? (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '32px 20px', textAlign: 'center' }}>
                  <FlaskConical size={32} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ fontWeight: 600, color: '#475569', fontSize: '0.92rem', margin: 0 }}>
                    No laboratory tests or diagnostic biomarkers ordered.
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>
                    Diagnostics can be requested or customized in the Lab Tests document tab.
                  </p>
                </div>
              ) : (
                labTests.map((test, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
                        #{idx + 1} {test.test_name}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>
                          {test.status || 'ORDERED'}
                        </span>
                        <span className={`badge ${test.priority === 'urgent' ? 'badge-danger' : 'badge-purple'}`} style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>
                          {test.priority || 'ROUTINE'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        <strong style={{ color: '#64748b' }}>Target Biomarker / Panel:</strong>{' '}
                        <span style={{ color: '#0284c7', fontWeight: 600 }}>{test.biomarker || 'Standard diagnostic panel'}</span>
                      </div>
                      {test.clinical_reason && (
                        <div>
                          <strong style={{ color: '#64748b' }}>Clinical Indication:</strong> {test.clinical_reason}
                        </div>
                      )}
                      {test.instructions && (
                        <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', fontSize: '0.82rem', color: '#475569' }}>
                          <strong>Patient Preparation:</strong> {test.instructions}
                        </div>
                      )}
                    </div>

                    {test.evidence && (
                      <div className="evidence-pill" style={{ marginTop: '8px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Timeframe Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <Clock size={20} color="#0284c7" />
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Recommended Re-check Schedule
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    {followUpContent.timeframe || followUp.timeframe || 'PRN (As needed or if symptoms persist)'}
                  </div>
                </div>
              </div>

              {/* Home Monitoring Instructions */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px 20px', background: '#ffffff' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                  Owner Monitoring Checklist
                </h4>
                {monitoring.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.86rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {monitoring.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Monitor appetite, activity level, hydration, and report any recurrence of symptoms.
                  </p>
                )}
              </div>

              {/* Emergency Red Flags */}
              <div style={{ border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#991b1b' }}>
                  <AlertTriangle size={18} />
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>
                    Emergency Red-Flag Warning Signs
                  </h4>
                </div>
                {redFlags.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#7f1d1d', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {redFlags.map((flag, idx) => (
                      <li key={idx}><strong>{flag}</strong> — Seek immediate emergency veterinary attention</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#7f1d1d' }}>
                    Seek immediate emergency veterinary care if the patient shows difficulty breathing, collapse, extreme lethargy, or uncontrolled vomiting.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Rejection Reason Prompt (Modal Level) ─── */}
        {showRejectBox && (
          <div style={{
            background: '#fff1f2',
            borderTop: '1px solid #fecdd3',
            borderBottom: '1px solid #fecdd3',
            padding: '12px 24px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#9f1239', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} color="#e11d48" /> Reject AI Clinical Documentation
              </span>
              <button
                type="button"
                onClick={() => setShowRejectBox(false)}
                style={{ background: 'none', border: 'none', color: '#9f1239', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#881337', margin: '0 0 8px 0' }}>
              Please specify why the AI draft is being rejected (e.g. incorrect medication, missing diagnosis, needs re-transcription):
            </p>
            <textarea
              className="form-control"
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Clinical reason for rejection..."
              style={{ fontSize: '0.82rem', marginBottom: '8px', background: '#ffffff' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowRejectBox(false)}
                style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#ffffff' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isRejectingAll}
                onClick={() => onRejectAll && onRejectAll(rejectReason || 'Clinician rejected AI clinical draft')}
                style={{ fontSize: '0.78rem', padding: '4px 12px', background: '#e11d48', borderColor: '#e11d48', color: '#ffffff' }}
              >
                {isRejectingAll ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Footer Action Bar ─── */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopySummary}
              style={{ fontSize: '0.82rem', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Summary'}
            </button>

            {onRegenerate && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onRegenerate}
                disabled={isGenerating}
                style={{ fontSize: '0.82rem', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Re-run AI extraction across current transcripts to update templates"
              >
                <Sparkles size={14} color="#0284c7" />
                {isGenerating ? 'Extracting with AI...' : 'Re-generate with AI'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ fontSize: '0.82rem', background: '#ffffff' }}
              title="Close modal to edit individual fields in right panel"
            >
              Edit in Workspace
            </button>

            {onRejectAll && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowRejectBox(true)}
                disabled={isRejectingAll || isApprovingAll}
                style={{
                  fontSize: '0.82rem',
                  background: '#e11d48',
                  borderColor: '#e11d48',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <X size={14} />
                {isRejectingAll ? 'Rejecting...' : 'Reject AI Draft'}
              </button>
            )}

            {onApproveAll && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onApproveAll}
                disabled={isApprovingAll || isRejectingAll}
                style={{
                  fontSize: '0.82rem',
                  background: '#059669',
                  borderColor: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
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

