import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, Mail, Phone, Award, ShieldCheck, Briefcase,
  Building2, Search, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle2, Camera
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { apiClient } from '../api/client';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateLicenseNumber,
  validateRequiredText,
  validateYearsOfExperience,
} from './validation';

const SPECIALIZATIONS = [
  'General Veterinary Practice',
  'Small Animal Medicine',
  'Canine & Feline Surgery',
  'Emergency & Critical Care',
  'Veterinary Dermatology',
  'Cardiology & Internal Medicine',
  'Orthopedics',
  'Exotic & Avian Medicine',
];

export function DoctorSignupForm({ onBack, onRegistered, onSwitchToLogin }) {
  const { registerDoctor } = useAuth();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    qualification: '',
    registrationNumber: '',
    specialization: 'General Veterinary Practice',
    yearsOfExperience: '',
    photoKey: '',
    practiceMode: 'INDEPENDENT', // Mandatory choice: 'INDEPENDENT' | 'HOSPITAL_AFFILIATED'
    practiceName: '',
    hospitalPracticeId: '',
    joinMessage: '',
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Hospital search for HOSPITAL_AFFILIATED mode
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [searchingHospitals, setSearchingHospitals] = useState(false);

  const loadHospitals = useCallback(async (q) => {
    setSearchingHospitals(true);
    try {
      const params = new URLSearchParams({ type: 'HOSPITAL', limit: '30' });
      if (q && q.trim()) params.set('q', q.trim());
      const res = await apiClient(`/api/v1/practices/discover?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setHospitals(json.data || []);
      }
    } catch (_) {
      setHospitals([]);
    } finally {
      setSearchingHospitals(false);
    }
  }, []);

  useEffect(() => {
    if (form.practiceMode === 'HOSPITAL_AFFILIATED') {
      const timer = setTimeout(() => loadHospitals(hospitalQuery), 200);
      return () => clearTimeout(timer);
    }
  }, [form.practiceMode, hospitalQuery, loadHospitals]);

  const validateField = (field, val, current = form) => {
    let res = { isValid: true, error: '' };
    if (field === 'fullName') res = validateRequiredText(val, 'Full name', 2, 100);
    else if (field === 'email') res = validateEmail(val);
    else if (field === 'mobileNumber') res = validatePhone(val);
    else if (field === 'password') res = validatePassword(val);
    else if (field === 'confirmPassword') res = validateConfirmPassword(current.password, val);
    else if (field === 'qualification') res = validateRequiredText(val, 'Veterinary qualification', 2, 120);
    else if (field === 'registrationNumber') res = validateLicenseNumber(val);
    else if (field === 'specialization') res = validateRequiredText(val, 'Specialization', 2, 120);
    else if (field === 'yearsOfExperience') res = validateYearsOfExperience(val);
    else if (field === 'hospitalPracticeId' && current.practiceMode === 'HOSPITAL_AFFILIATED') {
      if (!val) res = { isValid: false, error: 'Please select a hospital to request membership.' };
    }

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

  const handlePhotoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setApiError('Profile photo must be smaller than 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleChange('photoKey', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const requiredFields = [
      'fullName', 'email', 'mobileNumber', 'password', 'confirmPassword',
      'qualification', 'registrationNumber', 'specialization', 'yearsOfExperience',
    ];
    if (form.practiceMode === 'HOSPITAL_AFFILIATED') {
      requiredFields.push('hospitalPracticeId');
    }

    const ok = requiredFields.map((f) => validateField(f, form[f], form)).every(Boolean);
    if (!ok) return;

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        qualification: form.qualification.trim(),
        registrationNumber: form.registrationNumber.trim(),
        specialization: form.specialization.trim(),
        yearsOfExperience: Number(form.yearsOfExperience),
        photoKey: form.photoKey || undefined,
        practiceMode: form.practiceMode,
        practiceName: form.practiceMode === 'INDEPENDENT' && form.practiceName.trim()
          ? form.practiceName.trim()
          : undefined,
        hospitalPracticeId: form.practiceMode === 'HOSPITAL_AFFILIATED'
          ? Number(form.hospitalPracticeId)
          : undefined,
        joinMessage: form.practiceMode === 'HOSPITAL_AFFILIATED' && form.joinMessage.trim()
          ? form.joinMessage.trim()
          : undefined,
      };

      const data = await registerDoctor(payload);
      onRegistered({
        email: data.email || form.email.trim().toLowerCase(),
        mobileNumber: data.mobileNumber || form.mobileNumber.trim(),
        demoCode: data.demoCode,
        accountType: 'DOCTOR',
        practiceMode: form.practiceMode,
        title: form.fullName.trim(),
      });
    } catch (err) {
      setApiError(err.message || 'Doctor registration failed.');
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
        <span className="auth-step-pill">Doctor Registration</span>
      </div>

      {apiError && (
        <div className="form-alert-banner" role="alert">
          <AlertCircle size={16} />
          <span>{apiError}</span>
        </div>
      )}

      {/* Personal Details */}
      <div className="auth-section-divider">Personal Details</div>

      <div className="auth-field-group">
        <label htmlFor="doc-fullname" className="auth-field-label">Full Name *</label>
        <div className="auth-input-wrapper">
          <Stethoscope size={18} className="auth-input-lead-icon" />
          <input
            id="doc-fullname"
            type="text"
            className="auth-clean-input"
            value={form.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            onBlur={() => validateField('fullName', form.fullName)}
            placeholder="Dr. Meera Nair"
            required
          />
        </div>
        {errors.fullName && <span className="auth-field-error"><AlertCircle size={13} />{errors.fullName}</span>}
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="doc-email" className="auth-field-label">Email *</label>
          <div className="auth-input-wrapper">
            <Mail size={18} className="auth-input-lead-icon" />
            <input
              id="doc-email"
              type="email"
              className="auth-clean-input"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => validateField('email', form.email)}
              placeholder="doctor@example.com"
              required
            />
          </div>
          {errors.email && <span className="auth-field-error"><AlertCircle size={13} />{errors.email}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="doc-mobile" className="auth-field-label">Mobile Number *</label>
          <div className="auth-input-wrapper">
            <Phone size={18} className="auth-input-lead-icon" />
            <input
              id="doc-mobile"
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
          <label htmlFor="doc-password" className="auth-field-label">Password *</label>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-lead-icon" />
            <input
              id="doc-password"
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
          <label htmlFor="doc-confirm" className="auth-field-label">Confirm Password *</label>
          <div className="auth-input-wrapper">
            <Lock size={18} className="auth-input-lead-icon" />
            <input
              id="doc-confirm"
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

      {/* Professional Details */}
      <div className="auth-section-divider">Professional Credentials</div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="doc-qual" className="auth-field-label">Veterinary Qualification *</label>
          <div className="auth-input-wrapper">
            <Award size={18} className="auth-input-lead-icon" />
            <input
              id="doc-qual"
              type="text"
              className="auth-clean-input"
              value={form.qualification}
              onChange={(e) => handleChange('qualification', e.target.value)}
              onBlur={() => validateField('qualification', form.qualification)}
              placeholder="BVSc & AH, MVSc"
              required
            />
          </div>
          {errors.qualification && <span className="auth-field-error"><AlertCircle size={13} />{errors.qualification}</span>}
        </div>

        <div className="auth-field-group">
          <label htmlFor="doc-regno" className="auth-field-label">Professional Registration No. *</label>
          <div className="auth-input-wrapper">
            <ShieldCheck size={18} className="auth-input-lead-icon" />
            <input
              id="doc-regno"
              type="text"
              className="auth-clean-input"
              value={form.registrationNumber}
              onChange={(e) => handleChange('registrationNumber', e.target.value)}
              onBlur={() => validateField('registrationNumber', form.registrationNumber)}
              placeholder="VCI-REG-88412"
              required
            />
          </div>
          {errors.registrationNumber && <span className="auth-field-error"><AlertCircle size={13} />{errors.registrationNumber}</span>}
        </div>
      </div>

      <div className="auth-fields-row">
        <div className="auth-field-group">
          <label htmlFor="doc-spec" className="auth-field-label">Specialization *</label>
          <div className="auth-input-wrapper">
            <Briefcase size={18} className="auth-input-lead-icon" />
            <select
              id="doc-spec"
              className="auth-clean-input"
              value={form.specialization}
              onChange={(e) => handleChange('specialization', e.target.value)}
            >
              {SPECIALIZATIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="auth-field-group">
          <label htmlFor="doc-exp" className="auth-field-label">Years of Experience *</label>
          <div className="auth-input-wrapper">
            <Briefcase size={18} className="auth-input-lead-icon" />
            <input
              id="doc-exp"
              type="number"
              min="0"
              max="70"
              className="auth-clean-input"
              value={form.yearsOfExperience}
              onChange={(e) => handleChange('yearsOfExperience', e.target.value)}
              onBlur={() => validateField('yearsOfExperience', form.yearsOfExperience)}
              placeholder="6"
              required
            />
          </div>
          {errors.yearsOfExperience && <span className="auth-field-error"><AlertCircle size={13} />{errors.yearsOfExperience}</span>}
        </div>
      </div>

      <div className="auth-field-group">
        <label htmlFor="doc-photo" className="auth-field-label">Profile Photograph (Optional)</label>
        <div className="auth-photo-upload-row">
          {form.photoKey ? (
            <img src={form.photoKey} alt="Doctor preview" className="auth-photo-preview" />
          ) : (
            <span className="auth-role-icon" aria-hidden="true"><Camera size={18} /></span>
          )}
          <input
            id="doc-photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handlePhotoFile}
          />
        </div>
      </div>

      {/* Practice Type - Mandatory Selection */}
      <div className="auth-section-divider">Practice Mode (Mandatory Selection)</div>

      <div className="auth-practice-mode-grid" role="radiogroup" aria-label="Doctor Practice Mode">
        <button
          type="button"
          className={`auth-role-card ${form.practiceMode === 'INDEPENDENT' ? 'auth-role-card--active' : ''}`}
          onClick={() => handleChange('practiceMode', 'INDEPENDENT')}
          data-testid="doctor-mode-independent"
        >
          <span className="auth-role-icon" aria-hidden="true"><Stethoscope size={20} /></span>
          <span className="auth-role-body">
            <span className="auth-role-title">Work Independently</span>
            <span className="auth-role-desc">
              Launch your own standalone practice workspace. Full access to patients, appointments, Whisper Scribe &amp; AI Copilot—no hospital needed.
            </span>
          </span>
        </button>

        <button
          type="button"
          className={`auth-role-card ${form.practiceMode === 'HOSPITAL_AFFILIATED' ? 'auth-role-card--active' : ''}`}
          onClick={() => handleChange('practiceMode', 'HOSPITAL_AFFILIATED')}
          data-testid="doctor-mode-hospital"
        >
          <span className="auth-role-icon" aria-hidden="true"><Building2 size={20} /></span>
          <span className="auth-role-body">
            <span className="auth-role-title">Join a Hospital</span>
            <span className="auth-role-desc">
              Search active accredited hospitals and submit a membership request. Access activates after Hospital Admin approval.
            </span>
          </span>
        </button>
      </div>

      {form.practiceMode === 'INDEPENDENT' && (
        <div className="auth-field-group">
          <label htmlFor="doc-practice-name" className="auth-field-label">
            Independent Clinic / Practice Name (Optional)
          </label>
          <div className="auth-input-wrapper">
            <Building2 size={18} className="auth-input-lead-icon" />
            <input
              id="doc-practice-name"
              type="text"
              className="auth-clean-input"
              value={form.practiceName}
              onChange={(e) => handleChange('practiceName', e.target.value)}
              placeholder={`e.g. ${form.fullName || 'Dr. Nair'} Veterinary Clinic`}
            />
          </div>
        </div>
      )}

      {form.practiceMode === 'HOSPITAL_AFFILIATED' && (
        <div className="portal-stack-sm">
          <div className="auth-field-group">
            <label htmlFor="doc-hospital-search" className="auth-field-label">Search Registered Hospital *</label>
            <div className="auth-input-wrapper">
              <Search size={18} className="auth-input-lead-icon" />
              <input
                id="doc-hospital-search"
                type="text"
                className="auth-clean-input"
                value={hospitalQuery}
                onChange={(e) => setHospitalQuery(e.target.value)}
                placeholder="Search by hospital name or city..."
              />
            </div>
          </div>

          <div className="auth-hospital-search-results" role="listbox" aria-label="Registered Hospitals">
            {searchingHospitals && <span className="auth-field-staging-hint">Searching hospitals...</span>}
            {!searchingHospitals && hospitals.length === 0 && (
              <span className="auth-field-staging-hint">No active hospitals matched your search. You can also Work Independently!</span>
            )}
            {hospitals.map((h) => {
              const selected = String(form.hospitalPracticeId) === String(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`auth-hospital-option ${selected ? 'auth-hospital-option--selected' : ''}`}
                  onClick={() => handleChange('hospitalPracticeId', h.id)}
                >
                  <span className="auth-hospital-option-meta">
                    <span className="auth-hospital-option-name">{h.name}</span>
                    <span className="auth-hospital-option-loc">
                      {[h.city, h.state].filter(Boolean).join(', ') || h.address || 'Active Hospital'}
                    </span>
                  </span>
                  {selected && <CheckCircle2 size={18} className="auth-input-lead-icon" />}
                </button>
              );
            })}
          </div>
          {errors.hospitalPracticeId && (
            <span className="auth-field-error"><AlertCircle size={13} />{errors.hospitalPracticeId}</span>
          )}

          <div className="auth-field-group">
            <label htmlFor="doc-join-msg" className="auth-field-label">Note to Hospital Administrator (Optional)</label>
            <textarea
              id="doc-join-msg"
              className="auth-textarea"
              value={form.joinMessage}
              onChange={(e) => handleChange('joinMessage', e.target.value)}
              placeholder="Briefly introduce your credentials or preferred department..."
            />
          </div>
        </div>
      )}

      <button type="submit" className="auth-submit-btn auth-margin-top-sm" disabled={submitting}>
        <span>{submitting ? 'Creating Doctor Account...' : 'Create Doctor Account'}</span>
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

