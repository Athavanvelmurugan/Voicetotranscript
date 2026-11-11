import React, { useState } from 'react';
import {
  Stethoscope, UserPlus, CheckCircle, AlertTriangle, Key, Mail,
  ShieldCheck, Phone, Award, ArrowRight, RefreshCw, Copy, Check, Sparkles
} from 'lucide-react';
import { apiClient } from '../../api/client';

export function DoctorOnboardingTab({ onNavigateTab }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    licenseNumber: '',
    specialty: 'General Veterinary Practice',
    phone: '',
    autoVerifyLicense: true,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const specialties = [
    'General Veterinary Practice',
    'Feline Internal Medicine',
    'Canine Orthopedic Surgery',
    'Emergency & Critical Care',
    'Veterinary Dermatology',
    'Cardiology & Pulmonology',
    'Ophthalmology',
    'Exotic & Avian Medicine',
  ];

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = 'Dr!';
    for (let i = 0; i < 9; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: generated }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errorMsg) setErrorMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.name.trim()) {
      setErrorMsg('Doctor full name is required.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('A valid professional email is required.');
      return;
    }
    if (formData.password && formData.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password || undefined,
        licenseNumber: formData.licenseNumber.trim() || undefined,
        specialty: formData.specialty,
        phone: formData.phone.trim() || undefined,
        autoVerifyLicense: formData.autoVerifyLicense,
      };

      const res = await apiClient('/api/v1/staff/onboard', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to onboard doctor.');
      }

      setSuccessData(data.data);
      setFormData({
        name: '',
        email: '',
        password: '',
        licenseNumber: '',
        specialty: 'General Veterinary Practice',
        phone: '',
        autoVerifyLicense: true,
      });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successData) return;
    const credsText = `PetPulse Clinical Portal Login:
Doctor: ${successData.name}
Email: ${successData.email}
Temporary Password: ${successData.initialPassword}
Role: Attending Veterinarian`;
    navigator.clipboard.writeText(credsText);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  return (
    <div className="admin-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Doctor Onboarding</h3>
          <p>Directly onboard attending veterinarians, issue practice credentials, and grant immediate clinical scribing permissions.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successData ? (
        <div className="admin-settings-card admin-onboarding-success-card">
          <div className="admin-onboarding-success-icon">
            <CheckCircle size={32} />
          </div>
          <div className="admin-section-header-row">
            <h4>Doctor Onboarded Successfully!</h4>
            <span className="admin-badge badge-active">Active &amp; Verified</span>
          </div>
          <p className="admin-onboarding-success-text">
            <strong>{successData.name}</strong> has been provisioned as an attending clinician. Direct credentials are ready to share with the doctor.
          </p>

          <div className="admin-onboarding-creds-box">
            <div className="creds-row">
              <span className="creds-label">Attending Doctor:</span>
              <span className="creds-val">{successData.name} (#{successData.id})</span>
            </div>
            <div className="creds-row">
              <span className="creds-label">Login Email:</span>
              <span className="creds-val">{successData.email}</span>
            </div>
            <div className="creds-row">
              <span className="creds-label">Initial Password:</span>
              <span className="creds-val creds-code">{successData.initialPassword}</span>
            </div>
            {successData.license_number && (
              <div className="creds-row">
                <span className="creds-label">Medical License:</span>
                <span className="creds-val">{successData.license_number}</span>
              </div>
            )}
            {successData.specialty && (
              <div className="creds-row">
                <span className="creds-label">Specialty:</span>
                <span className="creds-val">{successData.specialty}</span>
              </div>
            )}
          </div>

          <div className="admin-onboarding-actions-row">
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={handleCopyCredentials}
            >
              {copiedCreds ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedCreds ? 'Credentials Copied!' : 'Copy Login Details'}</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => onNavigateTab && onNavigateTab('staff')}
            >
              <span>View in Staff Roster</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setSuccessData(null)}
            >
              <UserPlus size={16} />
              <span>Onboard Another Doctor</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-settings-card">
          <div className="admin-section-header-row">
            <h4>Veterinarian Profile &amp; Clinical Information</h4>
            <span className="admin-meta-sub">Direct Account Provisioning</span>
          </div>

          <div className="admin-stats-grid">
            {/* Full Name */}
            <div className="admin-form-group">
              <label htmlFor="doc-name">Doctor Full Name *</label>
              <div className="admin-input-icon-wrap">
                <Stethoscope size={16} className="admin-input-icon" aria-hidden="true" />
                <input
                  id="doc-name"
                  type="text"
                  className="admin-form-control admin-control-with-icon"
                  placeholder="e.g. Dr. Sarah Connor, DVM"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="admin-form-group">
              <label htmlFor="doc-email">Professional Email *</label>
              <div className="admin-input-icon-wrap">
                <Mail size={16} className="admin-input-icon" aria-hidden="true" />
                <input
                  id="doc-email"
                  type="email"
                  className="admin-form-control admin-control-with-icon"
                  placeholder="e.g. sarah.connor@hospital.vet"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="admin-stats-grid">
            {/* Password */}
            <div className="admin-form-group">
              <div className="admin-label-row">
                <label htmlFor="doc-password">Initial Login Password</label>
                <button
                  type="button"
                  className="admin-link-action"
                  onClick={handleGeneratePassword}
                  title="Generate a secure temporary password"
                >
                  <Sparkles size={13} />
                  <span>Generate Password</span>
                </button>
              </div>
              <div className="admin-input-icon-wrap">
                <Key size={16} className="admin-input-icon" aria-hidden="true" />
                <input
                  id="doc-password"
                  type="text"
                  className="admin-form-control admin-control-with-icon"
                  placeholder="Leave blank for auto-generated password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                />
              </div>
            </div>

            {/* Veterinary Medical License */}
            <div className="admin-form-group">
              <label htmlFor="doc-license">Veterinary License Number</label>
              <div className="admin-input-icon-wrap">
                <Award size={16} className="admin-input-icon" aria-hidden="true" />
                <input
                  id="doc-license"
                  type="text"
                  className="admin-form-control admin-control-with-icon"
                  placeholder="e.g. VET-CA-88910"
                  value={formData.licenseNumber}
                  onChange={(e) => handleChange('licenseNumber', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="admin-stats-grid">
            {/* Specialty */}
            <div className="admin-form-group">
              <label htmlFor="doc-specialty">Clinical Practice Specialty</label>
              <select
                id="doc-specialty"
                className="admin-form-control"
                value={formData.specialty}
                onChange={(e) => handleChange('specialty', e.target.value)}
              >
                {specialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone Number */}
            <div className="admin-form-group">
              <label htmlFor="doc-phone">Direct Contact Phone</label>
              <div className="admin-input-icon-wrap">
                <Phone size={16} className="admin-input-icon" aria-hidden="true" />
                <input
                  id="doc-phone"
                  type="tel"
                  className="admin-form-control admin-control-with-icon"
                  placeholder="e.g. +1 (555) 234-5678"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Immediate License Verification Toggle */}
          <div className="admin-checkbox-card">
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={formData.autoVerifyLicense}
                onChange={(e) => handleChange('autoVerifyLicense', e.target.checked)}
                className="admin-checkbox-input"
              />
              <div className="admin-checkbox-text">
                <span className="admin-checkbox-title">
                  <ShieldCheck size={16} /> Auto-Verify License &amp; Activate Immediately
                </span>
                <span className="admin-checkbox-desc">
                  Grants instant clinical access to the live audio consultation workspace, automated AI scribe, and medical documentation signing.
                </span>
              </div>
            </label>
          </div>

          {/* Form Submit Footer */}
          <div className="admin-form-footer">
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Onboarding Clinician...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Onboard Doctor &amp; Issue Access</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

