import React, { useState, useEffect } from 'react';
import { ShieldCheck, Mail, Phone, ArrowRight, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { validateOtp } from './validation';

export function VerificationStep({ pendingContext, onBack, onVerified }) {
  const { verifyEmail, verifyMobile, resendVerification } = useAuth();
  const [channel, setChannel] = useState('email'); // 'email' | 'mobile'
  const [code, setCode] = useState('');
  const [demoHint, setDemoHint] = useState(pendingContext?.demoCode || '');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const identifier = channel === 'mobile'
    ? pendingContext?.mobileNumber
    : pendingContext?.email;

  const handleSwitchChannel = async (nextChannel) => {
    setChannel(nextChannel);
    setError('');
    setInfoMsg('');
    const target = nextChannel === 'mobile' ? pendingContext?.mobileNumber : pendingContext?.email;
    if (!target) return;
    try {
      const data = await resendVerification(nextChannel, target);
      if (data?.demoCode) setDemoHint(data.demoCode);
      setInfoMsg(`Verification code sent to ${target}.`);
      setCooldown(15);
    } catch (err) {
      setError(err.message || 'Unable to send verification code.');
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !identifier) return;
    setError('');
    try {
      const data = await resendVerification(channel, identifier);
      if (data?.demoCode) setDemoHint(data.demoCode);
      setInfoMsg(`New verification code sent to ${identifier}.`);
      setCooldown(30);
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const check = validateOtp(code);
    if (!check.isValid) {
      setError(check.error);
      return;
    }

    setSubmitting(true);
    try {
      const cleanCode = code.replace(/[\s,-]/g, '');
      const result = channel === 'mobile'
        ? await verifyMobile(pendingContext.mobileNumber, cleanCode)
        : await verifyEmail(pendingContext.email, cleanCode);

      if (onVerified) onVerified(result);
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-clean-form" noValidate>
      {onBack && (
        <div className="auth-back-row">
          <button type="button" className="auth-back-btn" onClick={onBack}>
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <span className="auth-step-pill">Verify Contact</span>
        </div>
      )}

      <div className="auth-info-banner">
        <ShieldCheck size={16} />
        <span>
          Enter the 6-digit verification code sent to <strong>{identifier}</strong> to activate your PetCare AI session.
        </span>
      </div>

      {demoHint && (
        <div className="auth-success-banner">
          <CheckCircle2 size={16} />
          <span>Staging / Demo Code: <strong>{demoHint}</strong></span>
        </div>
      )}

      {infoMsg && (
        <div className="auth-success-banner">
          <CheckCircle2 size={16} />
          <span>{infoMsg}</span>
        </div>
      )}

      {error && (
        <div className="form-alert-banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {pendingContext?.mobileNumber && pendingContext?.email && (
        <div className="auth-inline-actions">
          <button
            type="button"
            className="auth-secondary-btn"
            onClick={() => handleSwitchChannel('email')}
            disabled={channel === 'email'}
          >
            <Mail size={15} />
            <span>Verify Email</span>
          </button>
          <button
            type="button"
            className="auth-secondary-btn"
            onClick={() => handleSwitchChannel('mobile')}
            disabled={channel === 'mobile'}
          >
            <Phone size={15} />
            <span>Verify Mobile</span>
          </button>
        </div>
      )}

      <div className="auth-field-group">
        <label htmlFor="verify-otp-code" className="auth-field-label">6-Digit Verification Code *</label>
        <div className="auth-input-wrapper">
          <ShieldCheck size={18} className="auth-input-lead-icon" />
          <input
            id="verify-otp-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="auth-clean-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 6-digit code"
            required
          />
        </div>
      </div>

      <button type="submit" className="auth-submit-btn" disabled={submitting}>
        <span>{submitting ? 'Verifying...' : 'Verify & Continue'}</span>
        <ArrowRight size={16} />
      </button>

      <div className="auth-inline-actions">
        <button
          type="button"
          className="auth-link-btn"
          onClick={handleResend}
          disabled={cooldown > 0}
        >
          <RefreshCw size={13} />{' '}
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification code'}
        </button>
      </div>
    </form>
  );
}

