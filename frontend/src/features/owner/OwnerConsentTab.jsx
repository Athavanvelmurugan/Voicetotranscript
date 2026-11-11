import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, FileCheck, PenTool, CheckCircle2, AlertCircle,
  RefreshCw, Eraser, Type, Lock, Info, Check
} from 'lucide-react';

export function OwnerConsentTab() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeConsentItem, setActiveConsentItem] = useState(null);

  // Signature state
  const [signMethod, setSignMethod] = useState('draw'); // 'draw' | 'type'
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/owner-portal/consent/pending');
      const data = await res.json();
      if (data.success) {
        setPending(data.data || []);
        if (data.data?.length > 0 && !activeConsentItem) {
          setActiveConsentItem(data.data[0]);
        }
      } else {
        setError(data.error || 'Failed to load pending consent items.');
      }
    } catch (err) {
      setError('Network error checking consent.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  // Canvas drawing handlers
  const getStrokeColor = () => {
    try {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();
      return color || '#0f172a';
    } catch {
      return '#0f172a';
    }
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawing.current = true;
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = getStrokeColor();
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSignConsent = async (e) => {
    e.preventDefault();
    if (!activeConsentItem) return;

    let signatureData = '';
    if (signMethod === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      signatureData = canvas.toDataURL('image/png');
    } else {
      if (!typedName.trim()) {
        setError('Please enter your full legal name to authorize.');
        return;
      }
      signatureData = `Typed Legal Signature: ${typedName.trim()} on ${new Date().toISOString()}`;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg('');

    try {
      const res = await fetch('/api/v1/owner-portal/consent/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: activeConsentItem.consultation_id,
          templateId: activeConsentItem.template_id || 1,
          signatureType: signMethod === 'draw' ? 'canvas_drawing' : 'typed_name',
          signatureData,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit digital consent.');
      }

      setSuccessMsg(`Consent successfully recorded and cryptographically sealed for ${activeConsentItem.pet_name}.`);
      setActiveConsentItem(null);
      clearCanvas();
      setTypedName('');
      await loadPending();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="owner-tab-content">
      <div className="owner-section-header">
        <div>
          <h2 className="owner-section-title">Digital Pre-Visit Recording Consent</h2>
          <p className="owner-section-subtitle">
            Authorize ambient AI clinical consultation recording and review veterinary medical privacy compliance disclosures.
          </p>
        </div>
      </div>

      {loading && (
        <div className="owner-state-card loading">
          <div className="verify-spinner" aria-hidden="true" />
          <p>Checking pending consent disclosures...</p>
        </div>
      )}

      {successMsg && (
        <div className="auth-alert success" role="status">
          <CheckCircle2 size={18} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-title">Consent Recorded</span>
            <p className="auth-alert-text">{successMsg}</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="auth-alert error" role="alert">
          <AlertCircle size={18} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-title">Consent Notice</span>
            <p className="auth-alert-text">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && pending.length === 0 && (
        <div className="owner-empty-card">
          <div className="owner-empty-icon-wrap success" aria-hidden="true">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="owner-empty-title">All Consents Up-To-Date</h3>
          <p className="owner-empty-desc">
            You have no pending recording or treatment consent disclosures requiring signature at this time.
          </p>
        </div>
      )}

      {!loading && activeConsentItem && (
        <div className="owner-consent-card">
          <div className="owner-consent-header">
            <div className="owner-consent-badge" aria-hidden="true">
              <PenTool size={22} />
            </div>
            <div>
              <h3 className="owner-consent-title">
                Digital Recording & Medical Scribing Consent
              </h3>
              <p className="owner-consent-patient-meta">
                Patient: <strong>{activeConsentItem.pet_name}</strong> • Scheduled Visit: <strong>{activeConsentItem.appointment_date || 'Upcoming'}</strong>
              </p>
            </div>
          </div>

          {/* Legal Notice Box */}
          <div className="owner-consent-notice-box">
            <h4>Veterinary Medical Privacy & Recording Disclosure</h4>
            <p>
              Central Valley Animal Hospital utilizes ambient artificial intelligence scribing technology (PetPulse) to transcribe and format clinical encounter summaries. By executing this authorization, you acknowledge and agree:
            </p>
            <ul>
              <li>Audio of the veterinary clinical consultation will be securely processed strictly for creating official medical documentation.</li>
              <li>Encrypted recordings are retained per statutory hospital policy and are never sold or shared with commercial third parties.</li>
              <li>You may request cessation of ambient audio recording at any time during your physical or virtual examination.</li>
            </ul>
          </div>

          <form onSubmit={handleSignConsent} className="owner-consent-form">
            {/* Signature Method Segmented Toggle */}
            <div className="signature-method-toggle" role="tablist">
              <button
                type="button"
                className={`auth-segmented-btn ${signMethod === 'draw' ? 'active' : ''}`}
                onClick={() => setSignMethod('draw')}
                role="tab"
                aria-selected={signMethod === 'draw'}
              >
                <PenTool size={16} />
                <span>Draw Signature (Pen / Touch)</span>
              </button>
              <button
                type="button"
                className={`auth-segmented-btn ${signMethod === 'type' ? 'active' : ''}`}
                onClick={() => setSignMethod('type')}
                role="tab"
                aria-selected={signMethod === 'type'}
              >
                <Type size={16} />
                <span>Type Legal Full Name</span>
              </button>
            </div>

            {signMethod === 'draw' ? (
              <div className="signature-canvas-container">
                <div className="canvas-header-bar">
                  <span className="canvas-guide-text">Draw your signature with mouse, stylus, or fingertip</span>
                  <button
                    type="button"
                    className="btn-canvas-clear"
                    onClick={clearCanvas}
                  >
                    <Eraser size={14} />
                    <span>Clear & Redo</span>
                  </button>
                </div>
                <div className="canvas-wrapper-box">
                  <canvas
                    ref={canvasRef}
                    width={520}
                    height={160}
                    className="signature-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <div className="signature-baseline-indicator" aria-hidden="true">
                    <span>Sign on the line above</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-group signature-type-group">
                <label className="form-label" htmlFor="typed-legal-name">
                  Full Legal Guardian Name *
                </label>
                <input
                  id="typed-legal-name"
                  type="text"
                  className="form-control typed-legal-input"
                  placeholder="e.g. Athavan Velmurugan"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  required
                  autoFocus
                />
                {typedName.trim() && (
                  <div className="typed-signature-preview">
                    <span className="typed-preview-label">Legal Signature Preview:</span>
                    <span className="typed-preview-cursive">{typedName}</span>
                  </div>
                )}
              </div>
            )}

            <div className="owner-consent-actions">
              <button
                type="submit"
                className="btn btn-primary btn-block owner-consent-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="btn-spinner" />
                    <span>Affixing Cryptographic Signature...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Authorize & Affix Cryptographic Signature</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
