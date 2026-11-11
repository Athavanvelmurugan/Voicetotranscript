import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
  User,
  Phone,
  Globe,
  AlertCircle,
  HeartPulse,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateClinicName,
  validateClinicSlug,
  generateSlug,
} from './validation';
import { MfaModal } from './MfaModal';
import '../styles/auth.css';

export function AuthPage({ initialView = 'login', onViewChange }) {
  const [activeTab, setActiveTab] = useState(initialView); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login, verifyMfa, registerClinic } = useAuth();

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onViewChange) {
      onViewChange(tab);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. LOGIN STATE & HANDLERS
  // ─────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('mouni@gmail.com');
  const [loginPassword, setLoginPassword] = useState('Password123!');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginErrors, setLoginErrors] = useState({ email: '', password: '', form: '' });
  const [mfaChallenge, setMfaChallenge] = useState({ active: false, tempToken: '' });

  const validateLoginField = (field, value) => {
    let result;
    if (field === 'email') result = validateEmail(value);
    if (field === 'password') result = validatePassword(value);

    setLoginErrors((prev) => ({
      ...prev,
      [field]: result?.isValid ? '' : result?.error || '',
      form: '',
    }));
    return result?.isValid;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const isEmailValid = validateLoginField('email', loginEmail);
    const isPasswordValid = validateLoginField('password', loginPassword);

    if (!isEmailValid || !isPasswordValid) return;

    setLoginSubmitting(true);
    setLoginErrors((prev) => ({ ...prev, form: '' }));

    try {
      const res = await login(loginEmail, loginPassword);
      if (res?.mfaRequired) {
        setMfaChallenge({ active: true, tempToken: res.tempToken });
      }
    } catch (err) {
      setLoginErrors((prev) => ({
        ...prev,
        form: err.message || 'Login failed. Please check your credentials.',
      }));
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleMfaVerify = async (tempToken, totpCode) => {
    await verifyMfa(tempToken, totpCode);
    setMfaChallenge({ active: false, tempToken: '' });
  };

  // ─────────────────────────────────────────────────────────────
  // 2. REGISTER STATE & HANDLERS
  // ─────────────────────────────────────────────────────────────
  const [regData, setRegData] = useState({
    clinicName: '',
    clinicSlug: '',
    adminName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [regErrors, setRegErrors] = useState({});
  const [regTouched, setRegTouched] = useState({});
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regApiError, setRegApiError] = useState('');

  const validateRegField = (field, value, allData = regData) => {
    let result = { isValid: true, error: '' };

    switch (field) {
      case 'clinicName':
        result = validateClinicName(value);
        break;
      case 'clinicSlug':
        result = validateClinicSlug(value);
        break;
      case 'adminName':
        if (!value || value.trim().length < 3) {
          result = { isValid: false, error: 'Administrator full name is required (min 3 chars).' };
        }
        break;
      case 'email':
        result = validateEmail(value);
        break;
      case 'phone':
        result = validatePhone(value);
        break;
      case 'password':
        result = validatePassword(value);
        break;
      case 'confirmPassword':
        result = validateConfirmPassword(allData.password, value);
        break;
      default:
        break;
    }

    setRegErrors((prev) => ({
      ...prev,
      [field]: result.isValid ? '' : result.error,
    }));

    return result.isValid;
  };

  const handleRegChange = (field, value) => {
    const updated = { ...regData, [field]: value };

    if (field === 'clinicName' && !regTouched.clinicSlug) {
      updated.clinicSlug = generateSlug(value);
      validateRegField('clinicSlug', updated.clinicSlug, updated);
    }

    setRegData(updated);

    if (regTouched[field]) {
      validateRegField(field, value, updated);
    }
  };

  const handleRegBlur = (field) => {
    setRegTouched((prev) => ({ ...prev, [field]: true }));
    validateRegField(field, regData[field]);
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();

    const fields = ['clinicName', 'clinicSlug', 'adminName', 'email', 'phone', 'password', 'confirmPassword'];
    let allValid = true;

    fields.forEach((f) => {
      const isValid = validateRegField(f, regData[f], regData);
      if (!isValid) allValid = false;
    });

    setRegTouched(fields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));

    if (!allValid) {
      setRegApiError('Please fix the validation errors below before submitting.');
      return;
    }

    setRegSubmitting(true);
    setRegApiError('');

    try {
      await registerClinic({
        clinicName: regData.clinicName,
        clinicSlug: regData.clinicSlug,
        adminName: regData.adminName,
        email: regData.email,
        password: regData.password,
        phone: regData.phone,
      });
    } catch (err) {
      setRegApiError(err.message || 'Registration failed. Please check form inputs.');
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div className="auth-split-wrapper">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: CLEAN LIGHT BRAND HERO
          Logo Big + Application Name (PetPulse) + Motto
          NO dark color, NO radar circle.
          ───────────────────────────────────────────────────────────── */}
      <section className="auth-hero-pane" aria-label="PetPulse Brand Overview">
        <div className="auth-hero-center-box">
          {/* Top Application Name & Motto */}
          <div className="auth-hero-app-header">
            <div className="auth-hero-app-title-wrap">
              <h1 className="auth-hero-app-title">PetPulse</h1>
              <HeartPulse size={28} className="auth-pulse-icon" />
            </div>
            <p className="auth-hero-app-motto">Every heartbeat, every record.</p>
          </div>

          {/* Big Cute Dog & Cat Logo */}
          <div className="auth-hero-big-logo-wrap">
            <img
              src="/petpulse-logo.png"
              alt="PetPulse Cute Dog and Cat Logo"
              className="auth-hero-big-logo"
            />
          </div>

          {/* Clean Sub-badge */}
          <div className="auth-hero-badge-pill">
            <Stethoscope size={16} />
            <span>Veterinary Clinical Intelligence Suite</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: CLEAN FORM
          ───────────────────────────────────────────────────────────── */}
      <section className="auth-form-pane" aria-label="Authentication Form Area">
        {/* Centered Form Wrapper */}
        <div className="auth-form-inner-wrapper">
          {/* Form Brand Header (Logo + PetPulse + Motto) */}
          <div className="auth-form-brand-header">
            <div className="auth-form-brand-badge-wrap">
              <img
                src="/petpulse-badge.png"
                alt="PetPulse Logo"
                className="auth-form-badge-img"
              />
            </div>
            <div className="auth-form-brand-text">
              <div className="auth-form-title-row">
                <span className="auth-form-brand-title">PetPulse</span>
                <HeartPulse size={16} className="auth-pulse-icon" />
              </div>
              <span className="auth-form-brand-motto">Every heartbeat, every record.</span>
            </div>
          </div>

          {/* Form Title & Subtitle */}
          <div className="auth-form-titles">
            <h2 className="auth-main-title">
              {activeTab === 'login' ? 'Welcome Back' : 'Register Clinic'}
            </h2>
            <p className="auth-main-subtitle">
              {activeTab === 'login'
                ? 'Sign in to your account to continue'
                : 'Set up your practice workspace to continue'}
            </p>
          </div>

          {/* ══════════════ TAB 1: LOGIN FORM ══════════════ */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-clean-form" noValidate>
              {loginErrors.form && (
                <div className="form-alert-banner" role="alert">
                  <AlertCircle size={16} />
                  <span>{loginErrors.form}</span>
                </div>
              )}

              {/* Email Address */}
              <div className="auth-field-group">
                <label htmlFor="login-email" className="auth-field-label">
                  Email address
                </label>
                <div className="auth-input-wrapper">
                  <Mail size={18} className="auth-input-lead-icon" />
                  <input
                    id="login-email"
                    type="email"
                    className="auth-clean-input"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginErrors.email) validateLoginField('email', e.target.value);
                    }}
                    onBlur={(e) => validateLoginField('email', e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                  />
                </div>
                {loginErrors.email && (
                  <span className="auth-field-error">
                    <AlertCircle size={13} />
                    {loginErrors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="auth-field-group">
                <label htmlFor="login-password" className="auth-field-label">
                  Password
                </label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-lead-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-clean-input"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginErrors.password) validateLoginField('password', e.target.value);
                    }}
                    onBlur={(e) => validateLoginField('password', e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginErrors.password && (
                  <span className="auth-field-error">
                    <AlertCircle size={13} />
                    {loginErrors.password}
                  </span>
                )}
                <div className="auth-field-staging-hint">
                  Default staging: <code>Password123!</code>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loginSubmitting || !!loginErrors.email || !!loginErrors.password}
              >
                <span>{loginSubmitting ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </button>

              {/* Bottom switch link */}
              <div className="auth-bottom-switch">
                <span>Need to register a new clinic? </span>
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => handleTabChange('register')}
                >
                  Register Clinic
                </button>
              </div>

              {/* Pet Guardian link */}
              <div className="auth-bottom-switch auth-guardian-link-row">
                <span>Looking for your pet's records? </span>
                <button
                  type="button"
                  className="auth-link-btn font-bold text-primary"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('portal', 'owner');
                    window.location.href = url.toString();
                  }}
                >
                  Pet Guardian Portal &rarr;
                </button>
              </div>
            </form>
          )}

          {/* ══════════════ TAB 2: REGISTER CLINIC FORM ══════════════ */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegSubmit} className="auth-clean-form" noValidate>
              {regApiError && (
                <div className="form-alert-banner" role="alert">
                  <AlertCircle size={16} />
                  <span>{regApiError}</span>
                </div>
              )}

              {/* Clinic Name & Slug Row */}
              <div className="auth-fields-row">
                <div className="auth-field-group">
                  <label htmlFor="reg-clinicName" className="auth-field-label">
                    Clinic / Hospital Name *
                  </label>
                  <div className="auth-input-wrapper">
                    <Building2 size={18} className="auth-input-lead-icon" />
                    <input
                      id="reg-clinicName"
                      type="text"
                      className="auth-clean-input"
                      value={regData.clinicName}
                      onChange={(e) => handleRegChange('clinicName', e.target.value)}
                      onBlur={() => handleRegBlur('clinicName')}
                      placeholder="Central Valley Animal Hospital"
                      required
                    />
                  </div>
                  {regErrors.clinicName && (
                    <span className="auth-field-error">
                      <AlertCircle size={13} />
                      {regErrors.clinicName}
                    </span>
                  )}
                </div>

                <div className="auth-field-group">
                  <label htmlFor="reg-clinicSlug" className="auth-field-label">
                    Workspace URL Slug *
                  </label>
                  <div className="auth-input-wrapper">
                    <Globe size={18} className="auth-input-lead-icon" />
                    <input
                      id="reg-clinicSlug"
                      type="text"
                      className="auth-clean-input"
                      value={regData.clinicSlug}
                      onChange={(e) => handleRegChange('clinicSlug', e.target.value)}
                      onBlur={() => handleRegBlur('clinicSlug')}
                      placeholder="central-valley"
                      required
                    />
                  </div>
                  {regErrors.clinicSlug && (
                    <span className="auth-field-error">
                      <AlertCircle size={13} />
                      {regErrors.clinicSlug}
                    </span>
                  )}
                </div>
              </div>

              {/* Admin Name & Phone Row */}
              <div className="auth-fields-row">
                <div className="auth-field-group">
                  <label htmlFor="reg-adminName" className="auth-field-label">
                    Administrator Name *
                  </label>
                  <div className="auth-input-wrapper">
                    <User size={18} className="auth-input-lead-icon" />
                    <input
                      id="reg-adminName"
                      type="text"
                      className="auth-clean-input"
                      value={regData.adminName}
                      onChange={(e) => handleRegChange('adminName', e.target.value)}
                      onBlur={() => handleRegBlur('adminName')}
                      placeholder="Dr. Maya Patel"
                      required
                    />
                  </div>
                  {regErrors.adminName && (
                    <span className="auth-field-error">
                      <AlertCircle size={13} />
                      {regErrors.adminName}
                    </span>
                  )}
                </div>

                <div className="auth-field-group">
                  <label htmlFor="reg-phone" className="auth-field-label">
                    Mobile Phone *
                  </label>
                  <div className="auth-input-wrapper">
                    <Phone size={18} className="auth-input-lead-icon" />
                    <input
                      id="reg-phone"
                      type="tel"
                      className="auth-clean-input"
                      value={regData.phone}
                      onChange={(e) => handleRegChange('phone', e.target.value)}
                      onBlur={() => handleRegBlur('phone')}
                      placeholder="9876543210"
                      required
                    />
                  </div>
                  {regErrors.phone && (
                    <span className="auth-field-error">
                      <AlertCircle size={13} />
                      {regErrors.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Admin Email */}
              <div className="auth-field-group">
                <label htmlFor="reg-email" className="auth-field-label">
                  Hospital Admin Email *
                </label>
                <div className="auth-input-wrapper">
                  <Mail size={18} className="auth-input-lead-icon" />
                  <input
                    id="reg-email"
                    type="email"
                    className="auth-clean-input"
                    value={regData.email}
                    onChange={(e) => handleRegChange('email', e.target.value)}
                    onBlur={() => handleRegBlur('email')}
                    placeholder="admin@centralvalleyvet.com"
                    required
                  />
                </div>
                {regErrors.email && (
                  <span className="auth-field-error">
                    <AlertCircle size={13} />
                    {regErrors.email}
                  </span>
                )}
              </div>

              {/* Password & Confirm Password Row */}
              <div className="auth-fields-row">
                <div className="auth-field-group">
                  <label htmlFor="reg-password" className="auth-field-label">
                    Password *
                  </label>
                  <div className="auth-input-wrapper">
                    <Lock size={18} className="auth-input-lead-icon" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      className="auth-clean-input"
                      value={regData.password}
                      onChange={(e) => handleRegChange('password', e.target.value)}
                      onBlur={() => handleRegBlur('password')}
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {regErrors.password && (
                    <span className="auth-field-error">
                      <AlertCircle size={13} />
                      {regErrors.password}
                    </span>
                  )}
                </div>

                <div className="auth-field-group">
                  <label htmlFor="reg-confirmPassword" className="auth-field-label">
                    Confirm Password *
                  </label>
                  <div className="auth-input-wrapper">
                    <Lock size={18} className="auth-input-lead-icon" />
                    <input
                      id="reg-confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="auth-clean-input"
                      value={regData.confirmPassword}
                      onChange={(e) => handleRegChange('confirmPassword', e.target.value)}
                      onBlur={() => handleRegBlur('confirmPassword')}
                      placeholder="Confirm password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-password-toggle-btn"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {regErrors.confirmPassword && (
                    <span className="auth-field-error">
                      <AlertCircle size={13} />
                      {regErrors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={regSubmitting}
                style={{ marginTop: 'var(--space-2)' }}
              >
                <span>{regSubmitting ? 'Creating Clinic Workspace...' : 'Create Clinic Workspace'}</span>
                <ArrowRight size={16} />
              </button>

              {/* Bottom switch link */}
              <div className="auth-bottom-switch">
                <span>Already registered your clinic? </span>
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => handleTabChange('login')}
                >
                  Sign In Here
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* MFA Modal */}
      <MfaModal
        isOpen={mfaChallenge.active}
        tempToken={mfaChallenge.tempToken}
        onVerify={handleMfaVerify}
        onCancel={() => setMfaChallenge({ active: false, tempToken: '' })}
      />
    </div>
  );
}
