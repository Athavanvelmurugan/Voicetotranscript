import React, { useState } from 'react';
import {
  Building2, Mail, Phone, MapPin, ShieldCheck, UserCheck,
  Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle
} from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateClinicName,
  validateLicenseNumber,
  validateRequiredText,
  validatePinCode,
} from './validation';

export function HospitalSignupForm({ onBack, onRegistered, onSwitchToLogin }) {
  const { registerHospital } = useAuth();
  const [form, setForm] = useState({
    hospitalName: '',
    hospitalEmail: '',
    contactNumber: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    registrationNumber: '',
    adminName: '',
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
    if (field === 'hospitalName') res = validateClinicName(val);
    else if (field === 'hospitalEmail') res = validateEmail(val);
    else if (field === 'contactNumber') res = validatePhone(val);
    else if (field === 'address') res = validateRequiredText(val, 'Complete address', 5, 250);
    else if (field === 'city') res = validateRequiredText(val, 'City', 2, 100);
    else if (field === 'state') res = validateRequiredText(val, 'State', 2, 100);
    else if (field === 'pinCode') res = validatePinCode(val);
    else if (field === 'registrationNumber') res = validateLicenseNumber(val);
    else if (field === 'adminName') res = validateRequiredText(val, 'Administrator name', 2, 100);
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

    const fields = Object.keys(form);
    const results = fields.map((f) => validateField(f, form[f], form));
    if (results.some((ok) => !ok)) return;

    setSubmitting(true);
    try {
      const data = await registerHospital(form);
      onRegistered({
        email: data.email || form.hospitalEmail.trim().toLowerCase(),
        mobileNumber: data.mobileNumber || form.contactNumber.trim(),
        demoCode: data.demoCode,
        accountType: 'HOSPITAL',
        title: form.hospitalName.trim(),
      });
    } catch (err) {
      setApiError(err.message || 'Hospital registration failed.');
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
        <span className="auth-step-pill">Hospital Registration</span>
      </div>

      {apiError && (
        <div className="form-alert-banner" role="alert">
          <AlertCircle size={16} />
          <span>{apiError}</span>
        </div>
      )}

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="hosp-name" className="auth-field-label">Hospital Name *</label>
          <div className="auth-input-wrapper">
            <Building2 size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-name"
              type="text"
              className="auth-clean-input"
              value={form.hospitalName}
              onChange={(e) => handleChange('hospitalName', e.target.value)}
              onBlur={() => validateField('hospitalName', form.hospitalName)}
              placeholder="Green Valley Vet Hospital"
              required
            />
          </div>
          {errors.hospitalName && <span className="auth-field-error"><AlertCircle size={13} />{errors.hospitalName}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="hosp-license" className="auth-field-label">Registration / License No. *</label>
          <div className="auth-input-wrapper">
            <ShieldCheck size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-license"
              type="text"
              className="auth-clean-input"
              value={form.registrationNumber}
              onChange={(e) => handleChange('registrationNumber', e.target.value)}
              onBlur={() => validateField('registrationNumber', form.registrationNumber)}
              placeholder="VET-HOSP-2026-01"
              required
            />
          </div>
          {errors.registrationNumber && <span className="auth-field-error"><AlertCircle size={13} />{errors.registrationNumber}</span>}
        </div>
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="hosp-email" className="auth-field-label">Hospital Email *</label>
          <div className="auth-input-wrapper">
            <Mail size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-email"
              type="email"
              className="auth-clean-input"
              value={form.hospitalEmail}
              onChange={(e) => handleChange('hospitalEmail', e.target.value)}
              onBlur={() => validateField('hospitalEmail', form.hospitalEmail)}
              placeholder="admin@hospital.com"
              required
            />
          </div>
          {errors.hospitalEmail && <span className="auth-field-error"><AlertCircle size={13} />{errors.hospitalEmail}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="hosp-contact" className="auth-field-label">Contact Number *</label>
          <div className="auth-input-wrapper">
            <Phone size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-contact"
              type="tel"
              className="auth-clean-input"
              value={form.contactNumber}
              onChange={(e) => handleChange('contactNumber', e.target.value)}
              onBlur={() => validateField('contactNumber', form.contactNumber)}
              placeholder="9876543210"
              required
            />
          </div>
          {errors.contactNumber && <span className="auth-field-error"><AlertCircle size={13} />{errors.contactNumber}</span>}
        </div>
      </div>

      <div className="auth-field-group">
        <label htmlFor="hosp-address" className="auth-field-label">Complete Address *</label>
        <div className="auth-input-wrapper">
          <MapPin size={18} className="auth-input-lead-icon" />
          <input
            id="hosp-address"
            type="text"
            className="auth-clean-input"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            onBlur={() => validateField('address', form.address)}
            placeholder="420 Veterinary Parkway, Suite 200"
            required
          />
        </div>
        {errors.address && <span className="auth-field-error"><AlertCircle size={13} />{errors.address}</span>}
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="hosp-city" className="auth-field-label">City *</label>
          <div className="auth-input-wrapper">
            <MapPin size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-city"
              type="text"
              className="auth-clean-input"
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
              onBlur={() => validateField('city', form.city)}
              placeholder="Bengaluru"
              required
            />
          </div>
          {errors.city && <span className="auth-field-error"><AlertCircle size={13} />{errors.city}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="hosp-state" className="auth-field-label">State *</label>
          <div className="auth-input-wrapper">
            <MapPin size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-state"
              type="text"
              className="auth-clean-input"
              value={form.state}
              onChange={(e) => handleChange('state', e.target.value)}
              onBlur={() => validateField('state', form.state)}
              placeholder="Karnataka"
              required
            />
          </div>
          {errors.state && <span className="auth-field-error"><AlertCircle size={13} />{errors.state}</span>}
        </div>
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="hosp-pin" className="auth-field-label">PIN Code *</label>
          <div className="auth-input-wrapper">
            <MapPin size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-pin"
              type="text"
              className="auth-clean-input"
              value={form.pinCode}
              onChange={(e) => handleChange('pinCode', e.target.value)}
              onBlur={() => validateField('pinCode', form.pinCode)}
              placeholder="560001"
              required
            />
          </div>
          {errors.pinCode && <span className="auth-field-error"><AlertCircle size={13} />{errors.pinCode}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="hosp-admin" className="auth-field-label">Administrator Name *</label>
          <div className="auth-input-wrapper">
            <UserCheck size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-admin"
              type="text"
              className="auth-clean-input"
              value={form.adminName}
              onChange={(e) => handleChange('adminName', e.target.value)}
              onBlur={() => validateField('adminName', form.adminName)}
              placeholder="Dr. Kavita Rao"
              required
            />
          </div>
          {errors.adminName && <span className="auth-field-error"><AlertCircle size={13} />{errors.adminName}</span>}
        </div>
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="hosp-pass" className="auth-field-label">Password *</label>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-pass"
              type={showPassword ? 'text' : 'password'}
              className="auth-clean-input"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => validateField('password', form.password)}
              placeholder="Min 10 chars, upper, lower, symbol"
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
          <label htmlFor="hosp-confirm" className="auth-field-label">Confirm Password *</label>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-lead-icon" />
            <input
              id="hosp-confirm"
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
        <ShieldCheck size={16} />
        <span>Hospitals verify email first, then await Super Admin accreditation review before dashboard access.</span>
      </div>

      <button type="submit" className="auth-submit-btn auth-margin-top-sm" disabled={submitting}>
        <span>{submitting ? 'Submitting Hospital Application...' : 'Register Hospital'}</span>
        <ArrowRight size={16} />
      </button>

      <div className="auth-bottom-switch">
        <span>Already have an account? </span>
        <button type="button" className="auth-link-btn" onClick={onSwitchToLogin}>
          Sign In Here
        </button>
      </div>
    </form>
  );
}

