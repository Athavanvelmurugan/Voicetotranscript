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
import { RegisterRoleSelector } from './RegisterRoleSelector';
import { HospitalSignupForm } from './HospitalSignupForm';
import { DoctorSignupForm } from './DoctorSignupForm';
import { PetOwnerSignupForm } from './PetOwnerSignupForm';
import { VerificationStep } from './VerificationStep';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import '../styles/auth.css';

export function AuthPage({ initialView = 'login', onViewChange }) {
  const [activeTab, setActiveTab] = useState(initialView); // 'login' | 'register'
  const [registerRole, setRegisterRole] = useState(null); // null | 'hospital' | 'doctor' | 'pet_owner'
  const [pendingVerification, setPendingVerification] = useState(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, verifyMfa } = useAuth();

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setRegisterRole(null);
    setPendingVerification(null);
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
        <div className={`auth-form-inner-wrapper ${activeTab === 'register' && registerRole ? 'auth-form-inner-wrapper--wide' : ''}`}>
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
              {activeTab === 'login'
                ? 'Welcome Back'
                : pendingVerification
                  ? 'Verify Your Account'
                  : registerRole === 'hospital'
                    ? 'Hospital Self-Registration'
                    : registerRole === 'doctor'
                      ? 'Doctor Self-Registration'
                      : registerRole === 'pet_owner'
                        ? 'Pet Owner Registration'
                        : 'Create Your Account'}
            </h2>
            <p className="auth-main-subtitle">
              {activeTab === 'login'
                ? 'Sign in to your PetCare AI workspace or guardian portal'
                : pendingVerification
                  ? 'Confirm your email or mobile number with the 6-digit OTP'
                  : registerRole
                    ? 'Complete your independent registration details below'
                    : 'Choose your account type to get started independently'}
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

              {/* Forgot Password Link */}
              <div className="auth-inline-actions">
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot password?
                </button>
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
                <span>New to PetCare AI? </span>
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => handleTabChange('register')}
                  data-testid="open-register-selector"
                >
                  Create Account (Hospital, Doctor or Pet Owner)
                </button>
              </div>

              {/* Pet Guardian link */}
              <div className="auth-bottom-switch auth-guardian-link-row">
                <span>Quick OTP lookup for your pet's records? </span>
                <button
                  type="button"
                  className="auth-link-btn"
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

          {/* ══════════════ TAB 2: INDEPENDENT MULTI-ROLE SELF-REGISTRATION ══════════════ */}
          {activeTab === 'register' && (
            pendingVerification ? (
              <VerificationStep
                pendingContext={pendingVerification}
                onBack={() => setPendingVerification(null)}
                onVerified={() => setPendingVerification(null)}
              />
            ) : !registerRole ? (
              <RegisterRoleSelector
                onSelectRole={(role) => setRegisterRole(role)}
                onSwitchToLogin={() => handleTabChange('login')}
              />
            ) : registerRole === 'hospital' ? (
              <HospitalSignupForm
                onBack={() => setRegisterRole(null)}
                onRegistered={(ctx) => setPendingVerification(ctx)}
                onSwitchToLogin={() => handleTabChange('login')}
              />
            ) : registerRole === 'doctor' ? (
              <DoctorSignupForm
                onBack={() => setRegisterRole(null)}
                onRegistered={(ctx) => setPendingVerification(ctx)}
                onSwitchToLogin={() => handleTabChange('login')}
              />
            ) : (
              <PetOwnerSignupForm
                onBack={() => setRegisterRole(null)}
                onRegistered={(ctx) => setPendingVerification(ctx)}
                onSwitchToLogin={() => handleTabChange('login')}
              />
            )
          )}
        </div>
      </section>

      <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />

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
