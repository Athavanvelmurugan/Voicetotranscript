import React, { useState } from 'react';
import { Mail, Lock, X, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { validateEmail, validatePassword, validateConfirmPassword } from './validation';

export function ForgotPasswordModal({ isOpen, onClose }) {
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState('request'); // 'request' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    const check = validateEmail(email);
    if (!check.isValid) {
      setError(check.error);
      return;
    }

    setSubmitting(true);
    try {
      const data = await forgotPassword(email.trim());
      if (data?.resetToken) {
        setToken(data.resetToken);
        setInfo('A password reset token has been generated (pre-filled for demo verification).');
      } else {
        setInfo('If an account exists for that email, a password reset link & token have been sent.');
      }
      setStep('reset');
    } catch (err) {
      setError(err.message || 'Unable to process password reset request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError('Reset token is required.');
      return;
    }
    const passCheck = validatePassword(newPassword);
    if (!passCheck.isValid) {
      setError(passCheck.error);
      return;
    }
    const confCheck = validateConfirmPassword(newPassword, confirmPassword);
    if (!confCheck.isValid) {
      setError(confCheck.error);
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token.trim(), newPassword, confirmPassword);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('request');
    setError('');
    setInfo('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className="auth-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="forgot-pass-title">
      <div className="auth-modal-card">
        <div className="auth-modal-header">
          <h3 id="forgot-pass-title" className="auth-modal-title">Reset Password</h3>
          <button type="button" className="auth-back-btn" onClick={handleClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="form-alert-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="auth-info-banner">
            <CheckCircle2 size={16} />
            <span>{info}</span>
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequest} className="auth-clean-form" noValidate>
            <div className="auth-field-group">
              <label htmlFor="fp-email" className="auth-field-label">Registered Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-input-lead-icon" />
                <input
                  id="fp-email"
                  type="email"
                  className="auth-clean-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              <span>{submitting ? 'Sending Reset Token...' : 'Send Reset Instructions'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset} className="auth-clean-form" noValidate>
            <div className="auth-field-group">
              <label htmlFor="fp-token" className="auth-field-label">Reset Token *</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-lead-icon" />
                <input
                  id="fp-token"
                  type="text"
                  className="auth-clean-input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste reset token"
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="fp-newpass" className="auth-field-label">New Password *</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-lead-icon" />
                <input
                  id="fp-newpass"
                  type="password"
                  className="auth-clean-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 10 chars + symbol"
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="fp-confpass" className="auth-field-label">Confirm New Password *</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-lead-icon" />
                <input
                  id="fp-confpass"
                  type="password"
                  className="auth-clean-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              <span>{submitting ? 'Updating Password...' : 'Update Password'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="portal-stack-md">
            <div className="auth-success-banner">
              <CheckCircle2 size={16} />
              <span>Your password has been updated and active refresh sessions were rotated. You can now sign in.</span>
            </div>
            <button type="button" className="auth-submit-btn" onClick={handleClose}>
              <span>Return to Sign In</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

