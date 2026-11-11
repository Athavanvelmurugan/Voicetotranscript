import React, { useState, useEffect } from 'react';
import { UserCheck, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from './AuthContext';
import {
  validatePassword,
  validateConfirmPassword,
  validatePhone,
  validateLicenseNumber,
} from './validation';
import '../styles/auth.css';

export function AcceptInvitePage({ inviteToken, onNavigateLogin }) {
  const { checkSession } = useAuth();

  const [inviteData, setInviteData] = useState(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    async function fetchInvite() {
      try {
        setIsLoadingInvite(true);
        const res = await apiClient(`/api/v1/invitations/verify?token=${encodeURIComponent(inviteToken)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setInviteData(data.data);
        } else {
          setInviteError(data.error || 'Invalid or expired invitation link.');
        }
      } catch (err) {
        setInviteError('Failed to load invitation. Please check your network connection.');
      } finally {
        setIsLoadingInvite(false);
      }
    }

    if (inviteToken) {
      fetchInvite();
    } else {
      setInviteError('No invitation token provided in URL.');
      setIsLoadingInvite(false);
    }
  }, [inviteToken]);

  const validate = (field, value) => {
    let result = { isValid: true, error: '' };

    switch (field) {
      case 'name':
        if (!value || value.trim().length < 2) {
          result = { isValid: false, error: 'Full name is required.' };
        }
        break;
      case 'phone':
        result = validatePhone(value);
        break;
      case 'licenseNumber':
        if (inviteData?.role === 'doctor') {
          result = validateLicenseNumber(value);
        }
        break;
      case 'password':
        result = validatePassword(value);
        break;
      case 'confirmPassword':
        result = validateConfirmPassword(password, value);
        break;
      default:
        break;
    }

    setErrors((prev) => ({
      ...prev,
      [field]: result.isValid ? '' : result.error,
    }));

    return result.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fields = ['name', 'phone', 'password', 'confirmPassword'];
    if (inviteData?.role === 'doctor') fields.push('licenseNumber');

    let allValid = true;
    fields.forEach((f) => {
      let val = '';
      if (f === 'name') val = name;
      if (f === 'phone') val = phone;
      if (f === 'licenseNumber') val = licenseNumber;
      if (f === 'password') val = password;
      if (f === 'confirmPassword') val = confirmPassword;

      const isValid = validate(f, val);
      if (!isValid) allValid = false;
    });

    setTouched(fields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));

    if (!allValid) {
      setFormError('Please resolve all validation errors before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await apiClient('/api/v1/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: inviteToken,
          name,
          phone,
          licenseNumber: inviteData?.role === 'doctor' ? licenseNumber : undefined,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept invitation.');
      }

      // Refresh session
      await checkSession();
    } catch (err) {
      setFormError(err.message || 'Invitation acceptance failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInvite) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p className="auth-subtitle">Verifying your hospital invitation...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-brand-icon" style={{ backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
            <AlertCircle size={24} />
          </div>
          <h2 className="auth-title">Invitation Invalid</h2>
          <p className="auth-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
            {inviteError}
          </p>
          <button type="button" className="btn-primary" onClick={onNavigateLogin}>
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="auth-brand-icon">
            <UserCheck size={24} />
          </div>
          <h1 className="auth-title">Join {inviteData?.clinic_name}</h1>
          <p className="auth-subtitle">
            You've been invited as a <strong>{inviteData?.role === 'doctor' ? 'Veterinary Doctor' : 'Clinic Staff'}</strong>. Complete your profile to activate your account.
          </p>
        </div>

        {formError && (
          <div className="form-banner-alert form-banner-danger" style={{ marginBottom: 'var(--space-4)' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label">Invited Email</label>
            <input
              type="text"
              className="form-input"
              value={inviteData?.email || ''}
              disabled
              style={{ opacity: 0.7 }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="inv-name" className="form-label">Full Name *</label>
              <input
                id="inv-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (touched.name) validate('name', e.target.value);
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, name: true }));
                  validate('name', name);
                }}
                placeholder="Dr. Maya Patel"
                aria-invalid={!!errors.name}
                required
              />
              {errors.name && <span className="form-error-msg"><AlertCircle size={14} />{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="inv-phone" className="form-label">Phone Number (10 Digits) *</label>
              <input
                id="inv-phone"
                type="tel"
                className="form-input"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (touched.phone) validate('phone', e.target.value);
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, phone: true }));
                  validate('phone', phone);
                }}
                placeholder="9876543210"
                aria-invalid={!!errors.phone}
                required
              />
              {errors.phone && <span className="form-error-msg"><AlertCircle size={14} />{errors.phone}</span>}
            </div>
          </div>

          {inviteData?.role === 'doctor' && (
            <div className="form-group">
              <label htmlFor="inv-license" className="form-label">
                Veterinary Medical License / Registration No. *
              </label>
              <input
                id="inv-license"
                type="text"
                className="form-input"
                value={licenseNumber}
                onChange={(e) => {
                  setLicenseNumber(e.target.value);
                  if (touched.licenseNumber) validate('licenseNumber', e.target.value);
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, licenseNumber: true }));
                  validate('licenseNumber', licenseNumber);
                }}
                placeholder="VET-REG-2026-9812"
                aria-invalid={!!errors.licenseNumber}
                required
              />
              {errors.licenseNumber && (
                <span className="form-error-msg"><AlertCircle size={14} />{errors.licenseNumber}</span>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="inv-password" className="form-label">Password (Min 10 Chars) *</label>
              <input
                id="inv-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) validate('password', e.target.value);
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, password: true }));
                  validate('password', password);
                }}
                placeholder="••••••••••••"
                aria-invalid={!!errors.password}
                required
              />
              {errors.password && <span className="form-error-msg"><AlertCircle size={14} />{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="inv-confirmPassword" className="form-label">Confirm Password *</label>
              <input
                id="inv-confirmPassword"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (touched.confirmPassword) validate('confirmPassword', e.target.value);
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, confirmPassword: true }));
                  validate('confirmPassword', confirmPassword);
                }}
                placeholder="••••••••••••"
                aria-invalid={!!errors.confirmPassword}
                required
              />
              {errors.confirmPassword && (
                <span className="form-error-msg"><AlertCircle size={14} />{errors.confirmPassword}</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
            style={{ marginTop: 'var(--space-2)' }}
          >
            {isSubmitting ? 'Activating Profile...' : (
              <>
                <span>Join Hospital Workspace</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

