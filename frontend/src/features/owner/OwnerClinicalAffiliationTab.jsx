import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Stethoscope, ShieldCheck, CheckCircle2,
  AlertTriangle, Trash2, ArrowRight, UserCheck, RefreshCw, FileText
} from 'lucide-react';
import { ownerFetch } from '../../api/ownerClient';

export function OwnerClinicalAffiliationTab({ owner, onAffiliationChanged }) {
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Form Selection State
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchProfileAndHospitals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, hospRes] = await Promise.all([
        ownerFetch('/api/v1/owner-portal/me'),
        ownerFetch('/api/v1/owner-portal/hospitals'),
      ]);

      const [profData, hospData] = await Promise.all([
        profRes.json(),
        hospRes.json(),
      ]);

      if (profData.success) {
        setProfile(profData.data);
        if (profData.data.clinic_id) {
          setSelectedHospitalId(String(profData.data.clinic_id));
        }
      }
      if (hospData.success) {
        setHospitals(hospData.data || []);
        if (!profData.data?.clinic_id && hospData.data?.length > 0) {
          setSelectedHospitalId(String(hospData.data[0].id));
        }
      }
    } catch (err) {
      setError(err.message || 'Error fetching affiliation details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileAndHospitals();
  }, [fetchProfileAndHospitals]);

  // When selected hospital changes, load doctors
  useEffect(() => {
    if (!selectedHospitalId) return;
    ownerFetch(`/api/v1/owner-portal/hospitals/${selectedHospitalId}/doctors`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.length > 0) {
          setDoctors(d.data);
          setSelectedDoctorId(String(d.data[0].id));
        } else {
          setDoctors([]);
          setSelectedDoctorId('');
        }
      })
      .catch(() => {});
  }, [selectedHospitalId]);

  // Handle Affiliate Submit
  const handleConfirmAffiliation = async (e) => {
    e.preventDefault();
    if (!selectedHospitalId || !consentAgreed) {
      setError('Please select a hospital and agree to the required hospital consent terms.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await ownerFetch('/api/v1/owner-portal/affiliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: parseInt(selectedHospitalId, 10),
          doctorId: selectedDoctorId ? parseInt(selectedDoctorId, 10) : null,
          consentAgreed: true,
        }),
      });

      const d = await res.json();
      if (d.success) {
        setSuccessMsg('Hospital and attending veterinarian affiliation successfully established!');
        await fetchProfileAndHospitals();
        if (onAffiliationChanged) onAffiliationChanged();
      } else {
        setError(d.error || 'Failed to establish clinical affiliation.');
      }
    } catch (err) {
      setError(err.message || 'Error processing affiliation request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Disaffiliate / Remove Affiliation
  const handleRemoveAffiliation = async () => {
    if (!window.confirm('Are you sure you want to remove your clinical affiliation with this hospital and doctor?')) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await ownerFetch('/api/v1/owner-portal/affiliation', {
        method: 'DELETE',
      });
      const d = await res.json();
      if (d.success) {
        setSuccessMsg('Hospital affiliation removed.');
        await fetchProfileAndHospitals();
        setSelectedHospitalId('');
        setSelectedDoctorId('');
        setConsentAgreed(false);
        if (onAffiliationChanged) onAffiliationChanged();
      } else {
        setError(d.error || 'Failed to remove affiliation.');
      }
    } catch (err) {
      setError(err.message || 'Error removing affiliation.');
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentlyAffiliated = Boolean(profile?.clinic_id);

  return (
    <div className="owner-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Clinical Hospital &amp; Doctor Affiliation</h3>
          <p>
            Connect your guardian profile to an accredited veterinary hospital, select your attending clinician, and manage digital consent governance.
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={fetchProfileAndHospitals}
          disabled={loading}
          title="Refresh Affiliation Status"
        >
          <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {successMsg && (
        <div className="admin-badge badge-active admin-alert-banner">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 1. CURRENT ACTIVE AFFILIATION CARD */}
      {isCurrentlyAffiliated && (
        <div className="admin-card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="admin-card-header">
            <div>
              <div className="hero-status-pill" style={{ marginBottom: 'var(--space-1)' }}>
                <span className="live-dot" aria-hidden="true" />
                <span>Primary Care Affiliation Active</span>
              </div>
              <h3 className="admin-card-title">{profile.clinic_name}</h3>
              <p className="admin-card-subtitle">{profile.address || 'Veterinary Clinical Center'}</p>
            </div>

            <button
              type="button"
              className="admin-btn admin-btn-danger admin-btn-sm"
              onClick={handleRemoveAffiliation}
              disabled={submitting}
              title="Remove hospital and doctor affiliation"
            >
              <Trash2 size={14} />
              <span>Disaffiliate / Remove</span>
            </button>
          </div>

          <div className="admin-card-body">
            <div className="doctor-dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div className="owner-affil-info-box">
                <span className="info-label">Accredited Facility</span>
                <strong>{profile.clinic_name}</strong>
                <span className="admin-meta-sub">{profile.phone || 'Phone on record'}</span>
              </div>

              <div className="owner-affil-info-box">
                <span className="info-label">Consent &amp; Legal Compliance</span>
                <div className="audit-proof-pill" style={{ marginTop: 'var(--space-1)' }}>
                  <ShieldCheck size={14} className="audit-check-icon" />
                  <span className="text-xs">Digital Consent Executed &amp; Immutable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. AFFILIATION / RE-AFFILIATION FORM */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">
              {isCurrentlyAffiliated ? 'Transfer or Update Hospital Affiliation' : 'Select Hospital & Attending Doctor'}
            </h3>
            <p className="admin-card-subtitle">
              Choose your veterinary clinic, review institutional consent terms, and confirm affiliation.
            </p>
          </div>
        </div>

        <div className="admin-card-body">
          <form onSubmit={handleConfirmAffiliation}>
            <div className="owner-booking-grid">
              {/* Select Hospital */}
              <div className="admin-form-group">
                <label htmlFor="affil-hospital">Veterinary Hospital / Clinic *</label>
                <select
                  id="affil-hospital"
                  className="admin-form-control"
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  required
                >
                  <option value="">Choose Hospital...</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.is_emergency ? '🚨 (Emergency)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Doctor inside Hospital */}
              <div className="admin-form-group">
                <label htmlFor="affil-doctor">Attending Clinician / Doctor</label>
                <select
                  id="affil-doctor"
                  className="admin-form-control"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  {doctors.length === 0 ? (
                    <option value="">No specific doctor selected (General Staff)</option>
                  ) : (
                    doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.license_number ? `(DVM #${d.license_number})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Mandatory Hospital Consent Form */}
            <div className="owner-consent-review-box" style={{ marginTop: 'var(--space-5)', padding: 'var(--space-5)', background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-primary-border)' }}>
              <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-primary)' }}>
                <FileText size={18} />
                <span style={{ fontWeight: 'var(--weight-bold)' }}>Hospital Digital Consent &amp; Telehealth Agreement</span>
              </h4>
              <p className="admin-meta-sub" style={{ margin: '0 0 var(--space-4) 0', lineHeight: '1.6', color: 'var(--color-text)' }}>
                By establishing affiliation with this veterinary practice, you authorize attending clinicians to maintain your companions' electronic medical records, utilize ambient veterinary scribe transcription during consultations, and generate cryptographic proof seals for prescriptions.
              </p>

              <label className="admin-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                <input
                  type="checkbox"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  required
                  style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                />
                <span>I acknowledge and agree to all hospital terms, clinical consent clauses, and data governance policies.</span>
              </label>
            </div>

            {/* Confirmation Action */}
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={submitting || !selectedHospitalId || !consentAgreed}
              >
                {submitting ? 'Connecting...' : (
                  <>
                    <UserCheck size={16} />
                    <span>Confirm &amp; Establish Affiliation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

