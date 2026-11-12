import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, CheckCircle2, XCircle, RefreshCw, AlertCircle, Mail, ShieldCheck, Stethoscope
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

export function JoinRequestsTab() {
  const { user } = useAuth();
  const practiceId = user?.practiceId || user?.clinicId;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState({});

  // Invite doctor by email state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DOCTOR');
  const [inviting, setInviting] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient(`/api/v1/practices/${practiceId}/join-requests`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load doctor join requests.');
      }
      setRequests(json.data || []);
    } catch (err) {
      setError(err.message || 'Error fetching join requests.');
    } finally {
      setLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId, doctorName) => {
    setBusyId(requestId);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient(`/api/v1/practices/${practiceId}/join-requests/${requestId}/approve`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not approve request.');
      }
      setStatusMsg(`Approved ${doctorName || 'doctor'} as a member of your hospital.`);
      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requestId) => {
    setBusyId(requestId);
    setError('');
    setStatusMsg('');
    try {
      const reason = (rejectNotes[requestId] || '').trim() || 'Not accepting new affiliations at this time.';
      const res = await apiClient(`/api/v1/practices/${practiceId}/join-requests/${requestId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not reject request.');
      }
      setStatusMsg('Join request rejected.');
      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !practiceId) return;
    setInviting(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient(`/api/v1/practices/${practiceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Invitation failed.');
      }
      setStatusMsg(`Hospital invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="doctor-tab-container">
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h1 className="doctor-tab-heading">Doctor Join Requests &amp; Invitations</h1>
          <p className="doctor-tab-subheading">
            Review affiliation requests from verified veterinarians or invite existing doctors to practice at your hospital.
          </p>
        </div>
        <div className="doctor-tab-header-actions">
          <button type="button" className="btn btn-outline" onClick={loadRequests} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
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

      {/* Invite Registered Doctor / Staff Card */}
      <form className="admin-card portal-alert-gap" onSubmit={handleSendInvitation}>
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Invite Doctor or Staff to Hospital</h3>
            <p className="admin-card-subtitle">Doctors with existing independent or hospital accounts can accept directly from their portal.</p>
          </div>
        </div>
        <div className="auth-fields-row">
          <div className="admin-form-group">
            <label htmlFor="hospital-invite-email">Clinician Email *</label>
            <input
              id="hospital-invite-email"
              type="email"
              className="admin-form-control"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="doctor@example.com"
              required
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="hospital-invite-role">Practice Role</label>
            <select
              id="hospital-invite-role"
              className="admin-form-control"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="DOCTOR">Attending Doctor (DOCTOR)</option>
              <option value="ADMIN">Practice Admin (ADMIN)</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="STAFF">Clinical Staff</option>
            </select>
          </div>
        </div>
        <div className="portal-row-wrap">
          <button type="submit" className="btn btn-primary" disabled={inviting}>
            <Mail size={15} />
            <span>{inviting ? 'Sending Invitation...' : 'Send Practice Invitation'}</span>
          </button>
        </div>
      </form>

      {/* Incoming Doctor Join Requests */}
      {loading ? (
        <div className="admin-card">
          <p className="admin-card-subtitle">Loading join requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="admin-card">
          <h3 className="admin-card-title">No Join Requests Found</h3>
          <p className="admin-card-subtitle">When self-registered veterinarians request to join your hospital, they appear here for review.</p>
        </div>
      ) : (
        <div className="practice-cards-grid">
          {requests.map((req) => {
            const pending = String(req.status || '').toUpperCase() === 'PENDING';
            const busy = busyId === req.id;
            return (
              <div key={req.id} className="practice-discovery-card" data-testid={`join-request-card-${req.id}`}>
                <div className="portal-stack-sm">
                  <div className="practice-card-meta-row">
                    <span className="practice-type-chip">
                      <Stethoscope size={13} />
                      <span>VETERINARIAN</span>
                    </span>
                    <span className={`admin-badge ${pending ? 'badge-pending' : req.status === 'APPROVED' ? 'badge-active' : 'badge-danger'}`}>
                      {req.status}
                    </span>
                  </div>

                  <h4 className="practice-card-title">{req.doctor_name || req.doctor_email}</h4>
                  <p className="practice-card-sub">
                    {req.qualification || 'DVM'} &middot; {req.specialization || 'General Practice'} ({req.years_of_experience ?? 0} yrs)
                  </p>
                  <p className="practice-card-sub">
                    <ShieldCheck size={13} /> Reg: <strong>{req.registration_number || 'Verified'}</strong> &middot; {req.doctor_email}
                  </p>
                  {req.message && <p className="practice-card-sub">"{req.message}"</p>}
                </div>

                {pending && (
                  <div className="portal-stack-sm">
                    <input
                      type="text"
                      className="admin-form-control"
                      placeholder="Optional note if rejecting..."
                      value={rejectNotes[req.id] || ''}
                      onChange={(e) => setRejectNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    />
                    <div className="portal-row-wrap">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => handleApprove(req.id, req.doctor_name)}
                        data-testid={`approve-join-request-${req.id}`}
                      >
                        <CheckCircle2 size={15} />
                        <span>{busy ? 'Working...' : 'Approve Doctor'}</span>
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        disabled={busy}
                        onClick={() => handleReject(req.id)}
                        data-testid={`reject-join-request-${req.id}`}
                      >
                        <XCircle size={15} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

