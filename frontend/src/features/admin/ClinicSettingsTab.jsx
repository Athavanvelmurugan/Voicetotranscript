import React, { useState, useEffect } from 'react';
import { Settings, Clock, Shield, Palette, Save, CheckCircle, AlertTriangle } from 'lucide-react';

export function ClinicSettingsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable fields
  const [slotDuration, setSlotDuration] = useState(15);
  const [bufferMin, setBufferMin] = useState(5);
  const [retentionDays, setRetentionDays] = useState(30);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/v1/clinic-settings');
        const data = await res.json();
        if (data.success) {
          setSettings(data.data);
          setSlotDuration(data.data.slot_duration_min || 15);
          setBufferMin(data.data.buffer_min || 5);
          setRetentionDays(data.data.audio_retention_days || 30);
          setDisplayName(data.data.branding?.display_name || data.data.clinic_name || '');
        }
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/clinic-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_duration_min: parseInt(slotDuration, 10),
          buffer_min: parseInt(bufferMin, 10),
          audio_retention_days: parseInt(retentionDays, 10),
          branding: {
            ...settings?.branding,
            display_name: displayName,
          },
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update settings');

      setSettings(data.data);
      setSuccessMsg('Clinic configuration updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="table-empty-message">Loading clinic settings...</p>;
  }

  return (
    <div className="admin-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Hospital &amp; Practice Configuration</h3>
          <p>Scheduling buffers, clinical audio retention policies, and branding.</p>
        </div>
      </div>

      {successMsg && (
        <div className="admin-badge badge-active admin-alert-banner">
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="admin-settings-card">
        {/* Practice Identity */}
        <div className="admin-section-header-row">
          <h4>Clinic Brand &amp; Practice Identity</h4>
          <span className="admin-meta-sub">Tenant #{settings?.clinic_id} ({settings?.clinic_slug})</span>
        </div>

        <div className="admin-form-group">
          <label htmlFor="clinic-display-name">Hospital / Practice Display Name</label>
          <input
            id="clinic-display-name"
            type="text"
            className="admin-form-control"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        {/* Scheduling Engine Defaults */}
        <div className="admin-section-header-row">
          <h4>Scheduling Defaults &amp; Conflict Engine</h4>
        </div>

        <div className="admin-stats-grid">
          <div className="admin-form-group">
            <label htmlFor="slot-duration">Default Slot Duration (Minutes)</label>
            <select
              id="slot-duration"
              className="admin-form-control"
              value={slotDuration}
              onChange={(e) => setSlotDuration(e.target.value)}
            >
              <option value={10}>10 Minutes</option>
              <option value={15}>15 Minutes</option>
              <option value={20}>20 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={45}>45 Minutes</option>
              <option value={60}>60 Minutes</option>
            </select>
          </div>

          <div className="admin-form-group">
            <label htmlFor="buffer-min">Buffer Between Appointments (Minutes)</label>
            <select
              id="buffer-min"
              className="admin-form-control"
              value={bufferMin}
              onChange={(e) => setBufferMin(e.target.value)}
            >
              <option value={0}>0 Minutes (Back-to-back)</option>
              <option value={5}>5 Minutes</option>
              <option value={10}>10 Minutes</option>
              <option value={15}>15 Minutes</option>
            </select>
          </div>
        </div>

        {/* Audio Retention & HIPAA/GDPR Compliance */}
        <div className="admin-section-header-row">
          <h4>Audio Retention Policy &amp; Storage</h4>
        </div>

        <div className="admin-form-group">
          <label htmlFor="retention-days">Audio Chunks Auto-Purge Policy</label>
          <select
            id="retention-days"
            className="admin-form-control"
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
          >
            <option value={7}>7 Days (Strict Minimal Retention)</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days (Standard Clinical Practice)</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
          </select>
          <span className="admin-meta-sub">
            Raw audio chunks older than this threshold will be scheduled for permanent erasure.
          </span>
        </div>

        <div>
          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

