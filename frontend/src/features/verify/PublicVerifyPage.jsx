import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, Copy, Check, ExternalLink, Stethoscope, Building2, Calendar, FileText } from 'lucide-react';

export function PublicVerifyPage({ initialHash, onBackToApp }) {
  const [hash, setHash] = useState(() => {
    if (initialHash) return initialHash;
    try {
      const path = window.location.pathname;
      const match = path.match(/\/verify\/([a-fA-F0-9]{64})/);
      if (match) return match[1];
      const params = new URLSearchParams(window.location.search);
      return params.get('verify') || params.get('ledgerHash') || '';
    } catch {
      return '';
    }
  });

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedLedger, setCopiedLedger] = useState(false);

  useEffect(() => {
    if (!hash) {
      setLoading(false);
      setError('No cryptographic verification hash provided in URL.');
      return;
    }

    async function verifyHash() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/verify/${hash}`);
        const json = await res.json();
        if (json.verified) {
          setData(json);
        } else {
          setError(json.error || 'Verification failed. Cryptographic seal does not match immutable ledger.');
        }
      } catch (err) {
        setError('Network error verifying document. Please check connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    verifyHash();
  }, [hash]);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'sha') {
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    } else {
      setCopiedLedger(true);
      setTimeout(() => setCopiedLedger(false), 2000);
    }
  };

  return (
    <div className="verify-page-wrapper">
      <div className="verify-card">
        {/* Header Branding */}
        <div className="verify-brand-header">
          <div className="verify-brand-icon">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="verify-brand-title">PetPulse Trust & Authenticity Seal</h1>
            <p className="verify-brand-subtitle">Cryptographic Verification of Clinical Records</p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="verify-state-box loading">
            <div className="verify-spinner" aria-hidden="true" />
            <p>Validating cryptographic hash chain against clinic ledger...</p>
          </div>
        )}

        {/* Error / Tampered State */}
        {!loading && error && (
          <div className="verify-state-box error">
            <div className="verify-status-badge invalid">
              <ShieldAlert size={28} />
              <span>UNVERIFIED / INVALID SEAL</span>
            </div>
            <p className="verify-error-msg">{error}</p>
            <p className="verify-warning-note">
              Warning: This document may be fraudulent, expired, or modified after issuance. Do not accept unauthorized alterations.
            </p>
          </div>
        )}

        {/* Verified State */}
        {!loading && data && data.verified && (
          <div className="verify-state-box success">
            <div className="verify-status-badge valid">
              <ShieldCheck size={28} />
              <span>AUTHENTICATED & CRYPTOGRAPHICALLY VERIFIED</span>
            </div>

            <p className="verify-summary-text">
              This document was issued by an authorized veterinary practitioner and cryptographically sealed into the clinic's immutable RFC 8785 audit ledger.
            </p>

            <div className="verify-details-grid">
              <div className="verify-detail-item">
                <span className="verify-label">Practice / Hospital</span>
                <span className="verify-value font-bold">{data.clinicName}</span>
              </div>

              <div className="verify-detail-item">
                <span className="verify-label">Attending Veterinarian</span>
                <span className="verify-value font-bold">{data.attendingDoctor}</span>
                {data.doctorLicense && (
                  <span className="verify-subvalue">Lic. #{data.doctorLicense}</span>
                )}
              </div>

              <div className="verify-detail-item">
                <span className="verify-label">Patient Record</span>
                <span className="verify-value">
                  {data.patientName} {data.patientSpecies ? `(${data.patientSpecies})` : ''}
                </span>
              </div>

              <div className="verify-detail-item">
                <span className="verify-label">Document Nature</span>
                <span className="verify-value">{data.documentType}</span>
                <span className="verify-subvalue">Version {data.documentVersion} • Approved</span>
              </div>

              <div className="verify-detail-item full-width">
                <span className="verify-label">Timestamp of Issuance</span>
                <span className="verify-value">
                  {data.issuedAt ? new Date(data.issuedAt).toUTCString() : 'Recorded in Audit Chain'}
                </span>
              </div>

              <div className="verify-detail-item full-width">
                <div className="verify-hash-header">
                  <span className="verify-label">PDF File SHA-256 Digest</span>
                  <button
                    type="button"
                    className="verify-copy-btn"
                    onClick={() => copyToClipboard(data.fileSha256, 'sha')}
                    aria-label="Copy SHA-256 Digest"
                  >
                    {copiedSha ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSha ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <code className="verify-hash-code">{data.fileSha256}</code>
              </div>

              <div className="verify-detail-item full-width">
                <div className="verify-hash-header">
                  <span className="verify-label">Cryptographic Audit Ledger Hash</span>
                  <button
                    type="button"
                    className="verify-copy-btn"
                    onClick={() => copyToClipboard(data.ledgerHash, 'ledger')}
                    aria-label="Copy Ledger Hash"
                  >
                    {copiedLedger ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLedger ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <code className="verify-hash-code">{data.ledgerHash}</code>
              </div>
            </div>

            <div className="verify-security-footer">
              <CheckCircle2 size={16} />
              <span>Zero-knowledge public verification: No confidential clinical notes or patient medical diagnoses are exposed.</span>
            </div>
          </div>
        )}

        {/* Back navigation */}
        {onBackToApp && (
          <div className="verify-card-footer">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onBackToApp}
            >
              Return to Practice Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

