import React, { useState, useEffect } from 'react';
import {
  X, Heart, Stethoscope, Pill, Clock, AlertTriangle, ShieldCheck,
  User, Calendar, CheckCircle, FileText, ArrowRight, ArrowLeft, Activity, Plus, Sparkles
} from 'lucide-react';
import { apiClient } from '../../api/client';

export function PatientClinicalChart({ petId, onClose, onLaunchConsultation, isInline = false }) {
  const [activeSubTab, setActiveSubTab] = useState('details'); // 'details' | 'summary' | 'live-consult' | 'prescriptions' | 'timeline'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!petId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchChart() {
      try {
        const res = await apiClient(`/api/v1/pets/${petId}/clinical-chart`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json.data);
        } else if (isMounted) {
          setError(json.error || 'Failed to load patient clinical chart.');
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Error fetching chart.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchChart();
    return () => { isMounted = false; };
  }, [petId]);

  if (!petId) return null;

  const patient = data?.patient;
  const targetPetId = patient?.id || petId;
  const hasAllergies = patient?.allergies && patient.allergies.length > 0;
  const allergyList = Array.isArray(patient?.allergies)
    ? patient.allergies
    : typeof patient?.allergies === 'string'
    ? [patient.allergies]
    : [];

  const getSpeciesEmoji = (species = '') => {
    const s = species.toLowerCase();
    if (s.includes('cat') || s.includes('feline')) return '🐱';
    if (s.includes('bird') || s.includes('avian')) return '🦜';
    if (s.includes('rabbit')) return '🐰';
    if (s.includes('horse')) return '🐴';
    return '🐶';
  };

  const chartInner = (
    <div className={isInline ? 'patient-chart-inline-card' : 'patient-chart-modal'} onClick={(e) => e.stopPropagation()}>
      {/* Top Back Breadcrumbs for Inline View */}
      {isInline && (
        <div className="patient-chart-inline-topbar">
          <button
            type="button"
            className="admin-btn admin-btn-outline patient-back-to-list-btn"
            onClick={onClose}
            title="Return to full patient directory"
          >
            <ArrowLeft size={16} />
            <span>Back to Patient Directory</span>
          </button>
          <div className="patient-chart-inline-crumb">
            <span>Patients</span>
            <span>/</span>
            <strong className="crumb-active">{patient?.name || 'Patient Chart'}</strong>
          </div>
        </div>
      )}

      {/* Modal / Card Header */}
      <div className="patient-chart-header">
        <div className="patient-chart-hero">
          <div className="patient-avatar-circle">
            {getSpeciesEmoji(patient?.species || '')}
          </div>
          <div className="patient-hero-info">
            <div className="patient-hero-title-row">
              <h2>{patient?.name || (loading ? 'Loading Patient...' : 'Patient Chart')}</h2>
              {patient?.species && (
                <span className="patient-species-pill">
                  {patient.species} {patient.breed && `• ${patient.breed}`}
                </span>
              )}
              {hasAllergies ? (
                <span className="badge-critical-allergy" title={allergyList.join(', ')}>
                  <AlertTriangle size={13} />
                  <span>Allergies: {allergyList.join(', ')}</span>
                </span>
              ) : (
                <span className="badge-no-allergies">
                  <CheckCircle size={13} /> No Known Allergies
                </span>
              )}
            </div>
            <div className="patient-hero-meta">
              <span>{patient?.age_years ? `${patient.age_years} yrs` : 'Age N/A'}</span>
              <span>•</span>
              <span>{patient?.weight_kg ? `${patient.weight_kg} kg` : 'Weight N/A'}</span>
              <span>•</span>
              <span>Guardian: <strong>{patient?.owner_name || 'Pet Owner'}</strong> {patient?.owner_phone && `(${patient.owner_phone})`}</span>
              {patient?.microchip_no && (
                <>
                  <span>•</span>
                  <span className="patient-microchip">Chip: {patient.microchip_no}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="patient-chart-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary patient-launch-consult-btn"
            onClick={() => onLaunchConsultation && onLaunchConsultation(targetPetId)}
            title="Initiate Live Audio Consultation with AI Scribe for this patient"
          >
            <Stethoscope size={16} />
            <span>Start Live Consultation</span>
          </button>
          {!isInline && (
            <button
              type="button"
              className="patient-chart-close-btn"
              onClick={onClose}
              aria-label="Close patient chart"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="patient-chart-nav-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'details'}
          className={`patient-nav-tab ${activeSubTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('details')}
        >
          <Heart size={15} />
          <span>Patient Detail</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'summary'}
          className={`patient-nav-tab ${activeSubTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('summary')}
        >
          <Activity size={15} />
          <span>AI Clinical Summary</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'live-consult'}
          className={`patient-nav-tab ${activeSubTab === 'live-consult' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('live-consult')}
        >
          <Stethoscope size={15} />
          <span>Patient Live Consultation</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'prescriptions'}
          className={`patient-nav-tab ${activeSubTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('prescriptions')}
        >
          <Pill size={15} />
          <span>Prescriptions ({data?.prescriptions?.length || 0})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'timeline'}
          className={`patient-nav-tab ${activeSubTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('timeline')}
        >
          <Clock size={15} />
          <span>Timeline ({data?.timeline?.length || 0})</span>
        </button>
      </div>

      {/* Tab Body Content */}
      <div className="patient-chart-body">
        {loading ? (
          <div className="patient-chart-loading">
            <div className="chart-spinner" />
            <p>Synthesizing patient clinical chart and AI summaries...</p>
          </div>
        ) : error ? (
          <div className="doctor-error-banner" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* ─── TAB 1: PATIENT DETAIL ─── */}
            {activeSubTab === 'details' && (
              <div className="chart-section">
                <div className="chart-demographics-grid">
                  <div className="chart-detail-box">
                    <h4>Patient Profile &amp; Demographics</h4>
                    <div className="detail-row">
                      <span className="detail-key">Pet Name:</span>
                      <span className="detail-val">{patient?.name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Species:</span>
                      <span className="detail-val">{patient?.species}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Breed:</span>
                      <span className="detail-val">{patient?.breed || 'Not specified'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Sex:</span>
                      <span className="detail-val">{patient?.sex || 'Unknown'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Age:</span>
                      <span className="detail-val">{patient?.age_years ? `${patient.age_years} years` : 'Not recorded'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Weight:</span>
                      <span className="detail-val">{patient?.weight_kg ? `${patient.weight_kg} kg` : 'Not recorded'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Microchip:</span>
                      <span className="detail-val">{patient?.microchip_no || 'None registered'}</span>
                    </div>
                  </div>

                  <div className="chart-detail-box">
                    <h4>Pet Guardian Contact</h4>
                    <div className="detail-row">
                      <span className="detail-key">Owner Name:</span>
                      <span className="detail-val">{patient?.owner_name || 'No owner linked'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Phone:</span>
                      <span className="detail-val">{patient?.owner_phone || 'None'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Email:</span>
                      <span className="detail-val">{patient?.owner_email || 'None'}</span>
                    </div>

                    <h4 className="chart-detail-section-title">Medical Alerts &amp; Safety</h4>
                    <div className="detail-row">
                      <span className="detail-key">Known Allergies:</span>
                      <span className={`detail-val ${hasAllergies ? 'text-danger' : ''}`}>
                        {hasAllergies ? allergyList.join(', ') : 'None documented'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Chronic Conditions:</span>
                      <span className="detail-val">
                        {patient?.chronic_conditions && patient.chronic_conditions.length > 0
                          ? (Array.isArray(patient.chronic_conditions) ? patient.chronic_conditions.join(', ') : patient.chronic_conditions)
                          : 'None reported'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 2: AI CLINICAL SUMMARY ─── */}
            {activeSubTab === 'summary' && (
              <div className="chart-section">
                {/* Latest Diagnostic Highlights from Consultation Extractions */}
                {data?.latestExtraction && (
                  <div className="chart-ai-highlights-grid">
                    <div className="chart-highlight-card">
                      <span className="highlight-label">Chief Concerns</span>
                      <div className="highlight-content">
                        {data.latestExtraction.chief_complaints && data.latestExtraction.chief_complaints.length > 0 ? (
                          data.latestExtraction.chief_complaints.map((cc, i) => (
                            <span key={i} className="highlight-tag">{cc}</span>
                          ))
                        ) : (
                          <span className="text-muted">None documented</span>
                        )}
                      </div>
                    </div>

                    <div className="chart-highlight-card">
                      <span className="highlight-label">Primary Diagnoses</span>
                      <div className="highlight-content">
                        {data.latestExtraction.diagnoses && data.latestExtraction.diagnoses.length > 0 ? (
                          data.latestExtraction.diagnoses.map((d, i) => (
                            <span key={i} className="highlight-tag highlight-diag">
                              {typeof d === 'object' ? d.condition : d}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">No formal diagnosis</span>
                        )}
                      </div>
                    </div>

                    <div className="chart-highlight-card">
                      <span className="highlight-label">Symptoms Noted</span>
                      <div className="highlight-content">
                        {data.latestExtraction.symptoms && data.latestExtraction.symptoms.length > 0 ? (
                          data.latestExtraction.symptoms.map((s, i) => (
                            <span key={i} className="highlight-tag">
                              {typeof s === 'object' ? s.symptom : s}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">None noted</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Visit Summaries extracted from consultation summaries */}
                <div className="chart-summaries-list">
                  <div className="chart-subhead-row">
                    <h4>AI Visit Summaries (From Consultation Summary)</h4>
                    <span className="admin-meta-sub">Synthesized from Attending Scribe Transcripts</span>
                  </div>

                  {data?.summaries?.length === 0 ? (
                    <div className="chart-empty-box">
                      <FileText size={32} className="chart-empty-icon" />
                      <p>No consultation summaries generated for this patient yet.</p>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        onClick={() => onLaunchConsultation && onLaunchConsultation(targetPetId)}
                      >
                        <Stethoscope size={14} /> Start First Consultation
                      </button>
                    </div>
                  ) : (
                    data.summaries.map((sum) => {
                      const summaryText = typeof sum.content === 'object' && sum.content?.summary
                        ? sum.content.summary
                        : typeof sum.content === 'string'
                        ? sum.content
                        : 'Visit summary recorded.';

                      return (
                        <div key={sum.id} className="chart-summary-card">
                          <div className="chart-summary-top">
                            <div className="chart-summary-date">
                              <Calendar size={14} />
                              <span>{new Date(sum.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span className="chart-doctor-tag">Dr. {sum.doctor_name || 'Attending Clinician'}</span>
                            </div>
                            <span className="admin-badge badge-active">Consultation #{sum.consultation_id}</span>
                          </div>
                          <p className="chart-summary-body">{summaryText}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 3: PATIENT LIVE CONSULTATION ─── */}
            {activeSubTab === 'live-consult' && (
              <div className="chart-section">
                <div className="chart-live-consult-launcher">
                  <div className="live-consult-hero-box">
                    <div className="live-consult-icon-badge">
                      <Stethoscope size={32} />
                    </div>
                    <h3>Start Live Clinical Consultation</h3>
                    <p>
                      Open the AI Scribe workspace to begin ambient voice capture, real-time transcription, and automated medical notes generation for <strong>{patient?.name}</strong>.
                    </p>

                    <div className="live-consult-meta-list">
                      <div className="meta-item">
                        <CheckCircle size={15} className="meta-check-icon" />
                        <span>Patient profile and known allergies pre-loaded</span>
                      </div>
                      <div className="meta-item">
                        <CheckCircle size={15} className="meta-check-icon" />
                        <span>Whisper AI ambient veterinary transcription ready</span>
                      </div>
                      <div className="meta-item">
                        <CheckCircle size={15} className="meta-check-icon" />
                        <span>Automated SOAP &amp; Prescription generation</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="admin-btn admin-btn-primary live-consult-action-btn"
                      onClick={() => onLaunchConsultation && onLaunchConsultation(targetPetId)}
                    >
                      <Stethoscope size={18} />
                      <span>Launch Live Consultation with {patient?.name || 'Patient'}</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 4: PRESCRIPTIONS ─── */}
            {activeSubTab === 'prescriptions' && (
              <div className="chart-section">
                <div className="chart-subhead-row">
                  <h4>Clinical Medication &amp; Prescriptions</h4>
                  <span className="admin-meta-sub">Issued across consultations</span>
                </div>

                {data?.prescriptions?.length === 0 ? (
                  <div className="chart-empty-box">
                    <Pill size={32} className="chart-empty-icon" />
                    <p>No prescriptions have been issued for {patient?.name} yet.</p>
                  </div>
                ) : (
                  <div className="chart-prescriptions-list">
                    {data.prescriptions.map((rx) => {
                      const content = rx.content || {};
                      const meds = content.medications || [];

                      return (
                        <div key={rx.id} className="chart-prescription-card">
                          <div className="chart-rx-header">
                            <div className="chart-rx-title">
                              <Pill size={16} />
                              <strong>Rx Document #{rx.id} (Consultation #{rx.consultation_id})</strong>
                            </div>
                            <span className="admin-badge badge-active">{rx.status}</span>
                          </div>

                          <div className="chart-rx-doctor-meta">
                            <span>Prescribing Clinician: Dr. {rx.doctor_name || 'Veterinarian'}</span>
                            <span>•</span>
                            <span>Issued: {new Date(rx.created_at).toLocaleDateString()}</span>
                          </div>

                          {meds.length > 0 ? (
                            <table className="chart-meds-table">
                              <thead>
                                <tr>
                                  <th>Medication</th>
                                  <th>Dosage</th>
                                  <th>Frequency</th>
                                  <th>Duration</th>
                                </tr>
                              </thead>
                              <tbody>
                                {meds.map((m, idx) => (
                                  <tr key={idx}>
                                    <td><strong>{m.name || m.drug}</strong></td>
                                    <td>{m.dosage || m.dose || 'Standard'}</td>
                                    <td>{m.frequency || m.sig || 'Daily'}</td>
                                    <td>{m.duration || 'As directed'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="chart-summary-body">{rx.doctor_notes || 'Prescription instructions documented in consultation.'}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 5: TIMELINE ─── */}
            {activeSubTab === 'timeline' && (
              <div className="chart-section">
                <div className="chart-subhead-row">
                  <h4>Clinical Visit Timeline</h4>
                  <span className="admin-meta-sub">Chronological Medical History</span>
                </div>

                {data?.timeline?.length === 0 ? (
                  <div className="chart-empty-box">
                    <Clock size={32} className="chart-empty-icon" />
                    <p>No historical medical events found for this patient.</p>
                  </div>
                ) : (
                  <div className="chart-timeline-track">
                    {data.timeline.map((ev, idx) => (
                      <div key={ev.id || idx} className="chart-timeline-item">
                        <div className={`chart-timeline-dot dot-${ev.type}`}>
                          {ev.type === 'consultation' ? (
                            <Stethoscope size={13} />
                          ) : ev.type === 'prescription' ? (
                            <Pill size={13} />
                          ) : (
                            <FileText size={13} />
                          )}
                        </div>
                        <div className="chart-timeline-content">
                          <div className="chart-timeline-meta">
                            <strong>{ev.title}</strong>
                            <span className="chart-timeline-time">
                              {new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                              {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="chart-timeline-desc">{ev.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return <div className="patient-chart-inline-view">{chartInner}</div>;
  }

  return (
    <div className="patient-chart-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      {chartInner}
    </div>
  );
}
