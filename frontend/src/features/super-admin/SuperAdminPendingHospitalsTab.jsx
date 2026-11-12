import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, CheckCircle2, XCircle, RefreshCw, AlertCircle, MapPin, ShieldCheck, Phone, Mail
} from 'lucide-react';
import { apiClient } from '../../api/client';

export function SuperAdminPendingHospitalsTab({ onHospitalReviewed }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient('/api/v1/admin/hospitals/pending');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load pending hospital applications.');
      }
      setApplications(json.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load pending applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleApprove = async (practiceId, hospitalName) => {
    setBusyId(practiceId);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient(`/api/v1/admin/hospitals/${practiceId}/approve`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Approval failed.');
      }
      setStatusMsg(`Approved ${hospitalName}. Hospital workspace and admin credentials are now ACTIVE.`);
      await loadPending();
      if (onHospitalReviewed) onHospitalReviewed();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (practiceId, hospitalName) => {
    const reason = (rejectReasons[practiceId] || '').trim() || 'Accreditation verification incomplete.';
    setBusyId(practiceId);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient(`/api/v1/admin/hospitals/${practiceId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Rejection failed.');
      }
      setStatusMsg(`Rejected application for ${hospitalName}.`);
      await loadPending();
      if (onHospitalReviewed) onHospitalReviewed();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="doctor-tab-container">
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h1 className="doctor-tab-heading">Pending Hospital Approvals</h1>
          <p className="doctor-tab-subheading">
            Review verified self-registered veterinary hospital applications before granting dashboard &amp; clinician invitation access.
          </p>
        </div>
        <div className="doctor-tab-header-actions">
          <button type="button" className="btn btn-outline" onClick={loadPending} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner portal-alert-gap" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {statusMsg && (
        <div className="admin-badge badge-active admin-alert-banner portal-alert-gap">
          <CheckCircle2 size={16} />
          <span>{statusMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="admin-card">
          <p className="admin-card-subtitle">Loading pending hospital queue...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">All Caught Up</h3>
              <p className="admin-card-subtitle">No hospitals are currently awaiting Super Admin approval.</p>
            </div>
            <span className="admin-badge badge-active">0 Pending</span>
          </div>
        </div>
      ) : (
        <div className="practice-cards-grid">
          {applications.map((item) => {
            const pId = item.practice_id || item.id;
            const busy = busyId === pId;
            return (
              <div key={pId} className="practice-discovery-card" data-testid={`pending-hospital-card-${pId}`}>
                <div className="portal-stack-sm">
                  <div className="practice-card-meta-row">
                    <span className="practice-type-chip">
                      <Building2 size={13} />
                      <span>HOSPITAL</span>
                    </span>
                    <span className="admin-badge badge-pending">{item.practice_status || item.status || 'PENDING_APPROVAL'}</span>
                  </div>

                  <h3 className="practice-card-title">{item.hospital_name || item.name}</h3>
                  <p className="practice-card-sub">
                    <ShieldCheck size={13} /> License: <strong>{item.registration_number || 'N/A'}</strong> &middot; Admin: {item.admin_name || item.owner_name || 'N/A'}
                  </p>
                  <p className="practice-card-sub">
                    <Mail size={13} /> {item.hospital_email || item.owner_email || 'N/A'} &middot; <Phone size={13} /> {item.contact_number || 'N/A'}
                  </p>
                  <p className="practice-card-sub">
                    <MapPin size={13} /> {[item.address, item.city, item.state, item.pin_code].filter(Boolean).join(', ')}
                  </p>
                </div>

                <div className="portal-stack-sm">
                  <input
                    type="text"
                    className="admin-form-control"
                    placeholder="Optional rejection reason..."
                    value={rejectReasons[pId] || ''}
                    onChange={(e) => setRejectReasons((prev) => ({ ...prev, [pId]: e.target.value }))}
                  />
                  <div className="portal-row-wrap">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => handleApprove(pId, item.hospital_name || item.name)}
                      data-testid={`approve-hospital-${pId}`}
                    >
                      <CheckCircle2 size={15} />
                      <span>{busy ? 'Working...' : 'Approve Hospital'}</span>
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      disabled={busy}
                      onClick={() => handleReject(pId, item.hospital_name || item.name)}
                      data-testid={`reject-hospital-${pId}`}
                    >
                      <XCircle size={15} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

