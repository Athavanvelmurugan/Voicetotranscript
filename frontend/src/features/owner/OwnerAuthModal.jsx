import React, { useState } from 'react';
import {
  Heart, Mail, Phone, KeyRound, ArrowRight, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, Lock, ArrowLeft,
  User, Sparkles, PlusCircle
} from 'lucide-react';

export function OwnerAuthModal({ onLoginSuccess, onCancel }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authMethod, setAuthMethod] = useState('email'); // 'email' | 'phone'
  const [step, setStep] = useState('identifier'); // 'identifier' | 'otp'

  // Login form state
  const [identifier, setIdentifier] = useState('');

  // Signup form state
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [showPetForm, setShowPetForm] = useState(true);
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');

  // OTP verification state
  const [code, setCode] = useState('');
  const [activeIdentifier, setActiveIdentifier] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // 1. Handle Login (Send OTP)
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setError(
        authMethod === 'email'
          ? 'Please enter a valid email address.'
          : 'Please enter a valid mobile phone number.'
      );
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/v1/owner-auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setActiveIdentifier(identifier.trim());
      setInfoMessage(data.message || 'Verification code sent. Use 123456 in staging.');
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Signup (Register Owner + First Pet -> Send OTP)
  const handleSignup = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Please provide your full legal name.');
      return;
    }
    if (!signupEmail.trim() && !signupPhone.trim()) {
      setError('Please provide at least an email address or mobile phone.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const target = signupEmail.trim() || signupPhone.trim();
      const res = await fetch('/api/v1/owner-auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: signupEmail.trim() || null,
          phone: signupPhone.trim() || null,
          petName: petName.trim() || null,
          species: species || 'Dog',
          breed: breed.trim() || 'Mixed Breed',
          clinicId: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create guardian account.');
      }

      setActiveIdentifier(target);
      setInfoMessage(data.message || 'Account created! Enter the verification code below.');
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!code.trim() || code.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/owner-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: activeIdentifier || identifier.trim(),
          code: code.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid verification code.');
      }

      if (data.data?.owner) {
        localStorage.setItem('petcare_owner_session', JSON.stringify(data.data.owner));
        onLoginSuccess(data.data.owner);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    if (step === 'identifier') {
      if (authMode === 'login') {
        setIdentifier('athavanvelmurugan@gmail.com');
        setAuthMethod('email');
      } else {
        setName('Alex Vance');
        setSignupEmail('alex.vance@example.com');
        setSignupPhone('+1 (555) 345-6789');
        setPetName('Bella');
        setSpecies('Cat');
        setBreed('Siamese');
      }
      setError('');
    } else {
      setCode('123456');
      setError('');
    }
  };

  return (
    <div className="owner-auth-page-wrapper">
      {/* Top PetPulse Brand Header */}
      <div className="owner-auth-brand-banner">
        <img src="/petpulse-logo.png" alt="PetPulse Logo" className="owner-auth-logo" />
        <div className="owner-auth-brand-text">
          <span className="owner-auth-brand-title">PetPulse</span>
          <span className="owner-auth-hospital-tag">Accredited Veterinary Healthcare Network</span>
        </div>
      </div>

      <div className="owner-auth-card" role="dialog" aria-modal="true" aria-labelledby="owner-auth-title">
        {/* Card Header */}
        <div className="owner-auth-header">
          <div className="owner-auth-badge" aria-hidden="true">
            <Heart size={24} />
          </div>
          <h1 id="owner-auth-title" className="owner-auth-title">
            Pet Guardian Portal
          </h1>
          <p className="owner-auth-subtitle">
            Book appointments across accredited animal hospitals, access verified clinical summaries, and manage prescriptions.
          </p>
        </div>

        {/* Dual Mode Switcher: Sign In vs Create Account */}
        {step === 'identifier' && (
          <div className="auth-mode-segmented-bar" role="tablist" aria-label="Authentication Mode">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'login'}
              className={`auth-mode-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setError('');
                setInfoMessage('');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'signup'}
              className={`auth-mode-btn ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signup');
                setError('');
                setInfoMessage('');
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Alerts Banner */}
        {error && (
          <div className="auth-alert error" role="alert">
            <AlertCircle size={18} className="auth-alert-icon" />
            <div className="auth-alert-content">
              <span className="auth-alert-title">Notice</span>
              <p className="auth-alert-text">{error}</p>
            </div>
          </div>
        )}

        {infoMessage && (
          <div className="auth-alert info" role="status">
            <CheckCircle2 size={18} className="auth-alert-icon" />
            <div className="auth-alert-content">
              <span className="auth-alert-title">Verification Code Sent</span>
              <p className="auth-alert-text">{infoMessage}</p>
            </div>
          </div>
        )}

        {/* VIEW 1: SIGN IN FORM */}
        {step === 'identifier' && authMode === 'login' && (
          <form onSubmit={handleSendOtp} className="owner-auth-form" noValidate>
            {/* Segmented Auth Method Toggle (Email vs Phone) */}
            <div className="auth-method-segmented" role="tablist" aria-label="Sign in method">
              <button
                type="button"
                role="tab"
                aria-selected={authMethod === 'email'}
                className={`auth-segmented-btn ${authMethod === 'email' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMethod('email');
                  setError('');
                }}
              >
                <Mail size={16} />
                <span>Email Address</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMethod === 'phone'}
                className={`auth-segmented-btn ${authMethod === 'phone' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMethod('phone');
                  setError('');
                }}
              >
                <Phone size={16} />
                <span>Mobile Phone</span>
              </button>
            </div>

            {/* Input Group */}
            <div className="form-group">
              <label htmlFor="owner-identifier" className="form-label">
                {authMethod === 'email' ? 'Registered Email Address' : 'Mobile Phone Number'}
              </label>
              <div className="input-with-icon">
                {authMethod === 'email' ? (
                  <Mail size={18} className="input-icon" aria-hidden="true" />
                ) : (
                  <Phone size={18} className="input-icon" aria-hidden="true" />
                )}
                <input
                  id="owner-identifier"
                  type={authMethod === 'email' ? 'email' : 'tel'}
                  className="form-control"
                  placeholder={
                    authMethod === 'email'
                      ? 'e.g. athavanvelmurugan@gmail.com'
                      : 'e.g. 555-0199 or (555) 234-5678'
                  }
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  autoComplete={authMethod === 'email' ? 'email' : 'tel'}
                  autoFocus
                  required
                />
              </div>
              <span className="form-help">
                We'll dispatch a 6-digit one-time code to authenticate your guardian account securely.
              </span>
            </div>

            {/* Quick Demo Credentials Pill */}
            <div className="auth-demo-helper-box">
              <div className="auth-demo-helper-text">
                <ShieldCheck size={14} />
                <span>Staging Environment Demo</span>
              </div>
              <button
                type="button"
                className="btn-demo-fill"
                onClick={handleQuickDemoFill}
                title="Fill with test guardian email"
              >
                Auto-fill Demo
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-block owner-auth-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="btn-spinner" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW 2: SIGN UP FORM */}
        {step === 'identifier' && authMode === 'signup' && (
          <form onSubmit={handleSignup} className="owner-auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="signup-name" className="form-label">
                Guardian Full Name
              </label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" aria-hidden="true" />
                <input
                  id="signup-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Athavan Velmurugan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="form-row-dual">
              <div className="form-group">
                <label htmlFor="signup-email" className="form-label">
                  Email Address
                </label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" aria-hidden="true" />
                  <input
                    id="signup-email"
                    type="email"
                    className="form-control"
                    placeholder="e.g. athavan@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-phone" className="form-label">
                  Mobile Phone
                </label>
                <div className="input-with-icon">
                  <Phone size={18} className="input-icon" aria-hidden="true" />
                  <input
                    id="signup-phone"
                    type="tel"
                    className="form-control"
                    placeholder="e.g. +91 98765 43210"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Optional Pet Onboarding Card */}
            <div className="signup-pet-card">
              <div className="signup-pet-header">
                <div className="signup-pet-badge">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="signup-pet-title">First Patient Profile (Optional)</h3>
                  <span className="signup-pet-sub">Register your pet now for faster consultation booking</span>
                </div>
              </div>

              <div className="form-row-dual">
                <div className="form-group">
                  <label htmlFor="pet-name" className="form-label">Pet Name</label>
                  <input
                    id="pet-name"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Charlie"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pet-species" className="form-label">Species</label>
                  <select
                    id="pet-species"
                    className="form-control"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    disabled={loading}
                  >
                    <option value="Dog">Dog (Canine)</option>
                    <option value="Cat">Cat (Feline)</option>
                    <option value="Bird">Bird (Avian)</option>
                    <option value="Rabbit">Rabbit / Small Mammal</option>
                    <option value="Reptile">Reptile</option>
                    <option value="Other">Other Species</option>
                  </select>
                </div>
              </div>

              <div className="form-group mt-2">
                <label htmlFor="pet-breed" className="form-label">Breed</label>
                <input
                  id="pet-breed"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Golden Retriever, Labrador, Persian"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Quick Demo Fill Helper */}
            <div className="auth-demo-helper-box">
              <div className="auth-demo-helper-text">
                <ShieldCheck size={14} />
                <span>Test Profile Generator</span>
              </div>
              <button
                type="button"
                className="btn-demo-fill"
                onClick={handleQuickDemoFill}
              >
                Auto-fill New Guardian
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-block owner-auth-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="btn-spinner" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Guardian Account</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW 3: OTP VERIFICATION FORM */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="owner-auth-form" noValidate>
            {/* Target Display Header */}
            <div className="otp-target-card">
              <div className="otp-target-meta">
                <span className="otp-target-label">Verification code sent to</span>
                <span className="otp-target-value">{activeIdentifier}</span>
              </div>
              <button
                type="button"
                className="btn-link-sm"
                onClick={() => {
                  setStep('identifier');
                  setCode('');
                  setError('');
                }}
                disabled={loading}
              >
                Change
              </button>
            </div>

            {/* 6-Digit Code Input */}
            <div className="form-group">
              <label htmlFor="owner-otp" className="form-label">
                One-Time 6-Digit Security Code
              </label>
              <div className="input-with-icon">
                <KeyRound size={18} className="input-icon" aria-hidden="true" />
                <input
                  id="owner-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="form-control otp-input"
                  placeholder="• • • • • •"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Staging Hint Box with 1-Click Code Injection */}
            <div className="otp-staging-hint">
              <div className="otp-hint-content">
                <Lock size={14} />
                <span>Staging default passcode: <strong>123456</strong></span>
              </div>
              <button
                type="button"
                className="btn-demo-fill"
                onClick={handleQuickDemoFill}
              >
                Insert 123456
              </button>
            </div>

            {/* Primary Action Button */}
            <div className="owner-auth-actions">
              <button
                type="submit"
                className="btn btn-primary btn-block owner-auth-btn"
                disabled={loading || code.length < 6}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="btn-spinner" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Verification & Enter</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-text btn-block"
                onClick={authMode === 'login' ? handleSendOtp : handleSignup}
                disabled={loading}
              >
                Didn't receive the code? Resend
              </button>
            </div>
          </form>
        )}

        {/* Portal Footer / Back Switch */}
        {onCancel && (
          <div className="owner-auth-cancel">
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={onCancel}
            >
              <ArrowLeft size={16} />
              <span>Back to Practice Scribe</span>
            </button>
          </div>
        )}

        {/* Security Compliance Micro-Footer */}
        <div className="owner-auth-trust-footer">
          <ShieldCheck size={13} />
          <span>256-Bit Encrypted • Tamper-Evident Medical Records</span>
        </div>
      </div>
    </div>
  );
}
