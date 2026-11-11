import React, { useState } from 'react';
import { Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateOtp } from './validation';

export function MfaModal({ isOpen, tempToken, onVerify, onCancel }) {
  const [otp, setOtp] = useState('123456'); // Default filled with staging master OTP for rapid developer testing
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateOtp(otp);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onVerify(tempToken, otp);
    } catch (err) {
      setError(err.message || 'MFA Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="mfa-title">
      <div className="modal-dialog">
        <div className="auth-header">
          <div className="auth-brand-icon">
            <Shield size={24} />
          </div>
          <h2 id="mfa-title" className="auth-title">Two-Factor Authentication</h2>
          <p className="auth-subtitle">
            Enter the 6-digit security verification code.
          </p>
        </div>

        <div className="form-banner-alert form-banner-info" style={{ marginBottom: 'var(--space-4)' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span><strong>Staging Mode Active:</strong> You can enter <code>123456</code> or <code>1,2,3,4,5,6</code>.</span>
        </div>

        {error && (
          <div className="form-banner-alert form-banner-danger" style={{ marginBottom: 'var(--space-4)' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="otp-input" className="form-label">
              Verification Code (6 Digits)
            </label>
            <div className="form-input-container">
              <input
                id="otp-input"
                type="text"
                className="form-input"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value);
                  if (error) setError('');
                }}
                placeholder="123456"
                maxLength={12}
                autoFocus
                aria-invalid={!!error}
                aria-describedby={error ? 'otp-error' : undefined}
                required
              />
            </div>
            {error && <span id="otp-error" className="form-error-msg"><AlertCircle size={14} />{error}</span>}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !otp.trim()}
          >
            {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <button
            type="button"
            className="auth-link"
            onClick={onCancel}
            style={{ marginTop: 'var(--space-2)', textAlign: 'center' }}
          >
            Cancel and Return
          </button>
        </form>
      </div>
    </div>
  );
}

