import React, { useState } from 'react';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, Heart
} from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateRequiredText,
} from './validation';

export function PetOwnerSignupForm({ onBack, onRegistered, onSwitchToLogin }) {
  const { registerPetOwner } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validateField = (field, val, current = form) => {
    let res = { isValid: true, error: '' };
    if (field === 'fullName') res = validateRequiredText(val, 'Full name', 2, 100);
    else if (field === 'email') res = validateEmail(val);
    else if (field === 'mobileNumber') res = validatePhone(val);
    else if (field === 'password') res = validatePassword(val);
    else if (field === 'confirmPassword') res = validateConfirmPassword(current.password, val);

    setErrors((prev) => ({ ...prev, [field]: res.isValid ? '' : res.error }));
    return res.isValid;
  };

  const handleChange = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (errors[field]) validateField(field, value, next);
    if (field === 'password' && next.confirmPassword) {
      validateField('confirmPassword', next.confirmPassword, next);
    }
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const ok = Object.keys(form).map((f) => validateField(f, form[f], form)).every(Boolean);
    if (!ok) return;

    setSubmitting(true);
    try {
      const data = await registerPetOwner(form);
      onRegistered({
        email: data.email || form.email.trim().toLowerCase(),
        mobileNumber: data.mobileNumber || form.mobileNumber.trim(),
        demoCode: data.demoCode,
        accountType: 'PET_OWNER',
        title: form.fullName.trim(),
      });
    } catch (err) {
      setApiError(err.message || 'Pet owner registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-clean-form" noValidate>
      <div className="auth-back-row">
        <button type="button" className="auth-back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          <span>Choose Role</span>
        </button>
        <span className="auth-step-pill">Pet Owner Registration</span>
      </div>

      {apiError && (
        <div className="form-alert-banner" role="alert">
          <AlertCircle size={16} />
          <span>{apiError}</span>
        </div>
      )}

      <div className="auth-field-group">
        <label htmlFor="owner-reg-name" className="auth-field-label">Full Name *</label>
        <div className="auth-input-wrapper">
          <User size={18} className="auth-input-lead-icon" />
          <input
            id="owner-reg-name"
            type="text"
            className="auth-clean-input"
            value={form.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            onBlur={() => validateField('fullName', form.fullName)}
            placeholder="Alex Morgan"
            required
          />
        </div>
        {errors.fullName && <span className="auth-field-error"><AlertCircle size={13} />{errors.fullName}</span>}
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="owner-reg-email" className="auth-field-label">Email *</label>
          <div className="auth-input-wrapper">
            <Mail size={18} className="auth-input-lead-icon" />
            <input
              id="owner-reg-email"
              type="email"
              className="auth-clean-input"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => validateField('email', form.email)}
              placeholder="alex@example.com"
              required
            />
          </div>
          {errors.email && <span className="auth-field-error"><AlertCircle size={13} />{errors.email}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="owner-reg-mobile" className="auth-field-label">Mobile Number *</label>
          <div className="auth-input-wrapper">
            <Phone size={18} className="auth-input-lead-icon" />
            <input
              id="owner-reg-mobile"
              type="tel"
              className="auth-clean-input"
              value={form.mobileNumber}
              onChange={(e) => handleChange('mobileNumber', e.target.value)}
              onBlur={() => validateField('mobileNumber', form.mobileNumber)}
              placeholder="9876543210"
              required
            />
          </div>
          {errors.mobileNumber && <span className="auth-field-error"><AlertCircle size={13} />{errors.mobileNumber}</span>}
        </div>
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="owner-reg-pass" className="auth-field-label">Password *</label>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-lead-icon" />
            <input
              id="owner-reg-pass"
              type={showPassword ? 'text' : 'password'}
              className="auth-clean-input"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => validateField('password', form.password)}
              placeholder="Min 10 chars + symbol"
              required
            />
            <button
              type="button"
              className="auth-password-toggle-btn"
              onClick={() => setShowPassword((p) => !p)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <span className="auth-field-error"><AlertCircle size={13} />{errors.password}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="owner-reg-confirm" className="auth-field-label">Confirm Password *</label>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-lead-icon" />
            <input
              id="owner-reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              className="auth-clean-input"
              value={form.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              onBlur={() => validateField('confirmPassword', form.confirmPassword)}
              placeholder="Confirm password"
              required
            />
            <button
              type="button"
              className="auth-password-toggle-btn"
              onClick={() => setShowConfirm((p) => !p)}
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && <span className="auth-field-error"><AlertCircle size={13} />{errors.confirmPassword}</span>}
        </div>
      </div>

      <div className="auth-info-banner">
        <Heart size={16} />
        <span>No hospital invite needed. Register multiple pets and book visits with any hospital or independent doctor.</span>
      </div>

      <button type="submit" className="auth-submit-btn auth-margin-top-sm" disabled={submitting}>
        <span>{submitting ? 'Creating Guardian Account...' : 'Register as Pet Owner'}</span>
        <ArrowRight size={16} />
      </button>

      <div className="auth-bottom-switch">
        <span>Already registered? </span>
        <button type="button" className="auth-link-btn" onClick={onSwitchToLogin}>
          Sign In Here
        </button>
      </div>
    </form>
  );
}

