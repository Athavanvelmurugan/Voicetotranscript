import React, { useState } from 'react';
import {
  User, ShieldCheck, Stethoscope, Sliders, Lock,
  CheckCircle, AlertCircle, Save, Globe, Volume2, Sparkles, Building2
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiClient } from '../../api/client';

export function DoctorSettingsTab() {
  const { user } = useAuth();

  // Clinician Profile local state
  const [specialty, setSpecialty] = useState('Small Animal Medicine & Surgery');
  const [scribeLanguage, setScribeLanguage] = useState(() => {
    return localStorage.getItem('petcare_scribe_lang') || 'en';
  });
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [autoGenerateSOAP, setAutoGenerateSOAP] = useState(true);
  const [dualPassVerification, setDualPassVerification] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Preference save state
  const [prefSaved, setPrefSaved] = useState(false);

  const handleSavePreferences = (e) => {
    e.preventDefault();
    localStorage.setItem('petcare_scribe_lang', scribeLanguage);
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 3000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await apiClient('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswordSuccess('Password successfully updated.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'Failed to update password.');
      }
    } catch (err) {
      setPasswordError(err.message || 'Network error updating password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="doctor-tab-container">
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h1 className="doctor-tab-heading">Doctor Profile & Clinical Preferences</h1>
          <p className="doctor-tab-subheading">
            Manage your veterinary credentials, AI ambient scribe speech settings, and account security.
          </p>
        </div>
      </div>

      <div className="doctor-settings-grid">
        {/* Card 1: Clinician Credentials & Verification */}
        <div className="doctor-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-box">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="settings-card-title">Clinician Profile & DVM Credentials</h2>
              <span className="settings-card-sub">Verified veterinary licensing and practice affiliation</span>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="settings-profile-badge-row">
              <div className="settings-avatar-circle">
                <span>{(user?.name || 'D')[0].toUpperCase()}</span>
              </div>
              <div className="settings-profile-meta">
                <span className="settings-doctor-name">Dr. {user?.name || 'Veterinarian'}</span>
                <span className="settings-doctor-email">{user?.email || 'doctor@petcare.vet'}</span>
                <div className="verified-credential-chip">
                  <CheckCircle size={13} aria-hidden="true" />
                  <span>Licensed Attending Veterinarian</span>
                </div>
              </div>
            </div>

            <div className="settings-info-grid">
              <div className="settings-info-item">
                <span className="info-label">DVM License Number</span>
                <span className="info-value">
                  {user?.licenseNumber ? `#${user.licenseNumber}` : '#VET-CA-88910 (Verified)'}
                </span>
              </div>

              <div className="settings-info-item">
                <span className="info-label">Practice Affiliation</span>
                <span className="info-value">
                  {user?.clinicName || 'Central Valley Animal Hospital'}
                </span>
              </div>

              <div className="settings-info-item">
                <span className="info-label">Clinical Role</span>
                <span className="info-value">Staff Veterinary Practitioner</span>
              </div>

              <div className="settings-info-item">
                <span className="info-label">Specialty / Department</span>
                <span className="info-value">{specialty}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: AI Ambient Scribe Preferences */}
        <div className="doctor-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-box">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="settings-card-title">AI Ambient Scribe Preferences</h2>
              <span className="settings-card-sub">Transcription models, languages, and auto-synthesis</span>
            </div>
          </div>

          <form onSubmit={handleSavePreferences} className="settings-card-body">
            <div className="settings-form-group">
              <label htmlFor="scribe-language-select" className="settings-form-label">
                <Globe size={15} aria-hidden="true" />
                <span>Primary Consultation Audio Language</span>
              </label>
              <select
                id="scribe-language-select"
                className="doctor-input"
                value={scribeLanguage}
                onChange={(e) => setScribeLanguage(e.target.value)}
              >
                <option value="en">English (US/UK Veterinary Medical Lexicon)</option>
                <option value="ta">தமிழ் (Tamil Clinical Dialect)</option>
                <option value="en-ta">Tanglish (Tamil + English Bilingual Mixed)</option>
                <option value="es">Español (Spanish Veterinary Terms)</option>
              </select>
              <span className="settings-form-help">
                Specifies the default acoustic Whisper dictionary for your clinical live audio streams.
              </span>
            </div>

            <div className="settings-toggle-list">
              <label className="settings-toggle-item">
                <div className="toggle-text-group">
                  <span className="toggle-title">Acoustic Noise Suppression</span>
                  <span className="toggle-desc">Filter ambient background animal vocalizations and HVAC noise</span>
                </div>
                <input
                  type="checkbox"
                  className="settings-switch"
                  checked={noiseSuppression}
                  onChange={(e) => setNoiseSuppression(e.target.checked)}
                />
              </label>

              <label className="settings-toggle-item">
                <div className="toggle-text-group">
                  <span className="toggle-title">Auto-Generate SOAP Note on Stop</span>
                  <span className="toggle-desc">Automatically trigger LLM clinical document extraction when recording stops</span>
                </div>
                <input
                  type="checkbox"
                  className="settings-switch"
                  checked={autoGenerateSOAP}
                  onChange={(e) => setAutoGenerateSOAP(e.target.checked)}
                />
              </label>

              <label className="settings-toggle-item">
                <div className="toggle-text-group">
                  <span className="toggle-title">Dual-Pass Transcription Verification</span>
                  <span className="toggle-desc">Block final sign-off until both real-time stream and post-visit pass converge</span>
                </div>
                <input
                  type="checkbox"
                  className="settings-switch"
                  checked={dualPassVerification}
                  onChange={(e) => setDualPassVerification(e.target.checked)}
                />
              </label>
            </div>

            {prefSaved && (
              <div className="doctor-alert doctor-alert-success" role="status">
                <CheckCircle size={16} aria-hidden="true" />
                <span>Preferences saved successfully.</span>
              </div>
            )}

            <div className="settings-form-actions">
              <button type="submit" className="btn btn-primary">
                <Save size={15} aria-hidden="true" />
                <span>Save Scribe Preferences</span>
              </button>
            </div>
          </form>
        </div>

        {/* Card 3: Account Security & Password */}
        <div className="doctor-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-box">
              <Lock size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="settings-card-title">Account Security & Credentials</h2>
              <span className="settings-card-sub">Update your clinical account password</span>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="settings-card-body">
            {passwordError && (
              <div className="doctor-alert doctor-alert-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="doctor-alert doctor-alert-success" role="status">
                <CheckCircle size={16} aria-hidden="true" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div className="settings-form-group">
              <label htmlFor="current-pwd-input" className="settings-form-label">
                Current Password
              </label>
              <input
                id="current-pwd-input"
                type="password"
                className="doctor-input"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="settings-form-row">
              <div className="settings-form-group">
                <label htmlFor="new-pwd-input" className="settings-form-label">
                  New Password
                </label>
                <input
                  id="new-pwd-input"
                  type="password"
                  className="doctor-input"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="settings-form-group">
                <label htmlFor="confirm-pwd-input" className="settings-form-label">
                  Confirm New Password
                </label>
                <input
                  id="confirm-pwd-input"
                  type="password"
                  className="doctor-input"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="settings-form-actions">
              <button
                type="submit"
                className="btn btn-outline"
                disabled={isUpdatingPassword}
              >
                <Lock size={15} aria-hidden="true" />
                <span>{isUpdatingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

