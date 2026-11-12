import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { validatePassword, validateConfirmPassword } from './validation';

export function ResetPasswordPage({ initialToken = '', onDone }) {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError('Reset token is required.');
      return;
    }
    const p = validatePassword(newPassword);
    if (!p.isValid) {
      setError(p.error);
      return;
    }
    const c = validateConfirmPassword(newPassword, confirmPassword);
    if (!c.isValid) {
      setError(c.error);
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token.trim(), newPassword, confirmPassword);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-gate-shell">
      <div className="auth-gate-card">
        <div className="auth-gate-header">
          <h1 className="auth-gate-title">Choose a New Password</h1>
          <p className="auth-gate-subtitle">Set a strong password to regain access to your PetCare AI workspace.</p>
        </div>

        {error && (
          <div className="form-alert-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {done ? (
          <div className="portal-stack-md">
            <div className="auth-success-banner">
              <CheckCircle2 size={16} />
              <span>Password reset successful. Sign in with your new credentials.</span>
            </div>
            <button type="button" className="auth-submit-btn" onClick={onDone}>
              <span>Go to Sign In</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-clean-form" noValidate>
            {!initialToken && (
              <div className="auth-field-group">
                <label htmlFor="reset-token" className="auth-field-label">Reset Token *</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-lead-icon" />
                  <input
                    id="reset-token"
                    type="text"
                    className="auth-clean-input"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="auth-field-group">
              <label htmlFor="reset-pass" className="auth-field-label">New Password *</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-lead-icon" />
                <input
                  id="reset-pass"
                  type="password"
                  className="auth-clean-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="reset-confirm" className="auth-field-label">Confirm Password *</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-lead-icon" />
                <input
                  id="reset-confirm"
                  type="password"
                  className="auth-clean-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              <span>{submitting ? 'Updating...' : 'Save New Password'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

