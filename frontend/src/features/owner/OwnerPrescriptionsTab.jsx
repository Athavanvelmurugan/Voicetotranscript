import React, { useState, useEffect } from 'react';
import {
  Pill, Download, ShieldCheck, ExternalLink, Calendar, Stethoscope,
  AlertCircle, RefreshCw, CheckCircle2, Lock
} from 'lucide-react';

export function OwnerPrescriptionsTab({ onOpenVerify }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    async function loadPrescriptions() {
      try {
        const res = await fetch('/api/v1/owner-portal/prescriptions');
        const data = await res.json();
        if (data.success) {
          setPrescriptions(data.data || []);
        } else {
          setError(data.error || 'Failed to load prescriptions.');
        }
      } catch (err) {
        setError('Network error loading prescriptions.');
      } finally {
        setLoading(false);
      }
    }
    loadPrescriptions();
  }, []);

  const handleDownloadPdf = async (docId, fileName) => {
    setDownloadingId(docId);
    try {
      const response = await fetch(`/api/v1/documents/${docId}/download-pdf`);
      if (!response.ok) {
        throw new Error('Failed to generate or download signed PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `Prescription_Doc_${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="owner-tab-content">
      <div className="owner-section-header">
        <div>
          <h2 className="owner-section-title">Active Prescriptions & Medications</h2>
          <p className="owner-section-subtitle">
            Digitally authorized veterinary prescriptions with embedded cryptographic authenticity QR seals.
          </p>
        </div>
      </div>

      {loading && (
        <div className="owner-state-card loading">
          <div className="verify-spinner" aria-hidden="true" />
          <p>Retrieving authorized prescriptions from medical records...</p>
        </div>
      )}

      {!loading && error && (
        <div className="auth-alert error" role="alert">
          <AlertCircle size={18} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-title">Prescriptions Notice</span>
            <p className="auth-alert-text">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && prescriptions.length === 0 && (
        <div className="owner-empty-card">
          <div className="owner-empty-icon-wrap" aria-hidden="true">
            <Pill size={36} />
          </div>
          <h3 className="owner-empty-title">No active prescriptions</h3>
          <p className="owner-empty-desc">
            There are no authorized prescriptions currently on file for your registered pets.
          </p>
        </div>
      )}

      {!loading && prescriptions.length > 0 && (
        <div className="owner-rx-grid">
          {prescriptions.map((rx) => {
            let rxContent = {};
            try {
              rxContent = typeof rx.content === 'string' ? JSON.parse(rx.content) : rx.content;
            } catch (_) {
              rxContent = { summary: rx.content };
            }

            const medications = Array.isArray(rxContent?.medications)
              ? rxContent.medications
              : [];

            const isDownloading = downloadingId === rx.document_id;

            return (
              <div key={rx.document_id} className="owner-rx-card">
                {/* Header */}
                <div className="owner-rx-card-header">
                  <div className="owner-rx-badge" aria-hidden="true">
                    <Pill size={22} />
                  </div>
                  <div className="owner-rx-header-text">
                    <div className="owner-rx-title-row">
                      <h3 className="owner-rx-title">
                        Official Rx • {rx.pet_name}
                      </h3>
                      <span className="owner-rx-approved-tag">
                        <ShieldCheck size={12} />
                        <span>Signed & Sealed</span>
                      </span>
                    </div>
                    <div className="owner-rx-meta">
                      <Stethoscope size={13} />
                      <span>{rx.doctor_name || 'Attending Doctor'} {rx.license_number ? `(Lic #${rx.license_number})` : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Body / Medications List */}
                <div className="owner-rx-body">
                  {medications.length > 0 ? (
                    <div className="owner-medications-list">
                      {medications.map((med, idx) => (
                        <div key={idx} className="owner-med-item">
                          <div className="owner-med-top">
                            <span className="owner-med-name">{med.name}</span>
                            <span className="owner-med-dosage">{med.dosage || med.strength}</span>
                          </div>
                          <div className="owner-med-instructions">
                            <span><strong>Frequency:</strong> {med.frequency || 'As directed'}</span>
                            {med.route && <span> • <strong>Route:</strong> {med.route}</span>}
                            {med.duration && <span> • <strong>Duration:</strong> {med.duration}</span>}
                          </div>
                          {med.specialInstructions && (
                            <div className="owner-med-special">
                              <span>⚠️ {med.specialInstructions}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="owner-med-raw">
                      <p>{rxContent?.summary || 'Medication directives issued per clinical visit.'}</p>
                    </div>
                  )}

                  {/* Refill & Expiry Info */}
                  <div className="owner-rx-dates-row">
                    <div className="rx-date-col">
                      <span className="rx-date-label">Prescribed Date</span>
                      <span className="rx-date-val">
                        {rx.created_at ? new Date(rx.created_at).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                    <div className="rx-date-col">
                      <span className="rx-date-label">Refill Status</span>
                      <span className="rx-date-val">
                        {rx.refills_allowed ? `${rx.refills_allowed} Refills Remaining` : 'No refills authorized'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="owner-rx-footer">
                  <button
                    type="button"
                    className="btn btn-primary owner-download-btn"
                    onClick={() => handleDownloadPdf(rx.document_id, `Prescription_${rx.pet_name}_${rx.document_id}.pdf`)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw size={15} className="btn-spinner" />
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download size={15} />
                        <span>Download Signed PDF</span>
                      </>
                    )}
                  </button>

                  {rx.ledger_hash && (
                    <button
                      type="button"
                      className="btn btn-outline owner-verify-btn"
                      onClick={() => onOpenVerify(rx.ledger_hash)}
                      title="Verify digital signature & RFC 8785 ledger seal"
                    >
                      <Lock size={14} />
                      <span>Verify Seal</span>
                      <ExternalLink size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
