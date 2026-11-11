import React, { useState } from 'react';
import {
  Building2, User, Lock, Globe, Phone, MapPin, CheckCircle2,
  AlertCircle, Eye, EyeOff, Save, ArrowRight
} from 'lucide-react';
import { apiClient } from '../../api/client';

export function SuperAdminHospitalAddTab({ onHospitalCreated }) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    address: '',
    phone: '',
    timezone: 'Asia/Kolkata',
    isEmergency: false,
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
      setError('Hospital Name, Administrator Email, and Administrator Password are required.');
      return;
    }

    if (form.adminPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient('/api/v1/super-admin/clinics', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          address: form.address.trim(),
          phone: form.phone.trim(),
          timezone: form.timezone,
          adminName: form.adminName.trim() || `${form.name} Administrator`,
          adminEmail: form.adminEmail.trim(),
          adminPassword: form.adminPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Hospital "${data.data.clinic.name}" and Admin account successfully provisioned.`);
        setForm({
          name: '',
          slug: '',
          address: '',
          phone: '',
          timezone: 'Asia/Kolkata',
          isEmergency: false,
          adminName: '',
          adminEmail: '',
          adminPassword: '',
        });
        setTimeout(() => {
          if (onHospitalCreated) onHospitalCreated();
        }, 1500);
      } else {
        setError(data.error || 'Failed to provision hospital tenant.');
      }
    } catch (err) {
      setError(err.message || 'Network error provisioning hospital tenant.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="doctor-tab-container">
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h1 className="doctor-tab-heading">Onboard New Veterinary Hospital</h1>
          <p className="doctor-tab-subheading">
            Provision a new accredited hospital tenant, initialize operational settings, and establish primary hospital administrator credentials.
          </p>
        </div>
      </div>

      <div className="doctor-settings-grid">
        <form onSubmit={handleSubmit} className="doctor-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-box">
              <Building2 size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="settings-card-title">Hospital Tenant Details & Credentials</h2>
              <span className="settings-card-sub">Accreditation information and initial master administrator credentials</span>
            </div>
          </div>

          <div className="settings-card-body">
            {error && (
              <div className="doctor-alert doctor-alert-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="doctor-alert doctor-alert-success" role="status">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{success}</span>
              </div>
            )}

            {/* Section 1: Hospital Parameters */}
            <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
              1. Hospital / Practice Information
            </h3>

            <div className="settings-form-row">
              <div className="settings-form-group">
                <label className="settings-form-label">Hospital Name *</label>
                <input
                  type="text"
                  className="doctor-input"
                  placeholder="e.g. Blossom Valley Veterinary Hospital"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Registration Slug (Optional)</label>
                <input
                  type="text"
                  className="doctor-input"
                  placeholder="e.g. blossom-valley"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
            </div>

            <div className="settings-form-row">
              <div className="settings-form-group">
                <label className="settings-form-label">Practice Address</label>
                <input
                  type="text"
                  className="doctor-input"
                  placeholder="e.g. 1024 Medical Plaza Blvd, Suite 400"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Hospital Contact Phone</label>
                <input
                  type="text"
                  className="doctor-input"
                  placeholder="e.g. +1 (408) 555-0199"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="settings-form-row">
              <div className="settings-form-group">
                <label className="settings-form-label">Operating Timezone</label>
                <select
                  className="doctor-input"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>

              <div className="settings-form-group" style={{ justifyContent: 'center' }}>
                <label className="settings-toggle-item" style={{ marginTop: 'var(--space-4)' }}>
                  <span className="toggle-title">24/7 Emergency & Trauma Hospital</span>
                  <input
                    type="checkbox"
                    className="settings-switch"
                    checked={form.isEmergency}
                    onChange={(e) => setForm({ ...form, isEmergency: e.target.checked })}
                  />
                </label>
              </div>
            </div>

            {/* Section 2: Hospital Administrator Credentials */}
            <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
              <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                2. Hospital Administrator Master Account & Password
              </h3>

              <div className="settings-form-row">
                <div className="settings-form-group">
                  <label className="settings-form-label">Administrator Full Name</label>
                  <input
                    type="text"
                    className="doctor-input"
                    placeholder="e.g. Dr. Arthur Vance, Hospital Director"
                    value={form.adminName}
                    onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  />
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">Administrator Email *</label>
                  <input
                    type="email"
                    className="doctor-input"
                    placeholder="admin@hospital.com"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="settings-form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="settings-form-label">Administrator Initial Password *</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="doctor-input"
                    placeholder="Min 8 characters, secure password"
                    value={form.adminPassword}
                    onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="settings-form-help">
                  This password will be securely hashed with bcrypt and used for initial practice admin sign-in.
                </span>
              </div>
            </div>

            <div className="settings-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                <Save size={16} aria-hidden="true" />
                <span>{submitting ? 'Provisioning Hospital...' : 'Provision Hospital & Credentials'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
