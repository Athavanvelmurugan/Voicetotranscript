import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, ShieldAlert, CheckCircle2, Building2, Stethoscope,
  LogOut, RefreshCw, ArrowRight, AlertCircle
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { apiClient } from '../api/client';
import { VerificationStep } from './VerificationStep';

export function AccountStatusGate() {
  const { user, checkSession, logout } = useAuth();
  const [joinRequests, setJoinRequests] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [practiceName, setPracticeName] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const accountStatus = String(user?.status || 'ACTIVE').toUpperCase();
  const isDoctorRole = (user?.roles || []).includes('DOCTOR') || user?.role === 'doctor' || user?.role === 'veterinarian';

  const loadPendingDoctorItems = useCallback(async () => {
    if (!isDoctorRole) return;
    setLoading(true);
    try {
      const [reqRes, invRes] = await Promise.all([
        apiClient('/api/v1/practices/my-join-requests'),
        apiClient('/api/v1/practices/my-invitations'),
      ]);
      const [reqJson, invJson] = await Promise.all([reqRes.json(), invRes.json()]);
      if (reqJson.success) setJoinRequests(reqJson.data || []);
      if (invJson.success) setInvitations(invJson.data || []);
    } catch (_) {}
    finally {
      setLoading(false);
    }
  }, [isDoctorRole]);

  useEffect(() => {
    if (accountStatus === 'ACTIVE' && isDoctorRole) {
      loadPendingDoctorItems();
    }
  }, [accountStatus, isDoctorRole, loadPendingDoctorItems]);

  const handleLaunchIndependent = async () => {
    setError('');
    setLaunching(true);
    try {
      const res = await apiClient('/api/v1/practices', {
        method: 'POST',
        body: JSON.stringify({
          practiceName: practiceName.trim() || `${user?.name || 'Veterinary'} Practice`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not launch independent practice.');
      }
      await checkSession();
    } catch (err) {
      setError(err.message || 'Failed to launch independent practice.');
    } finally {
      setLaunching(false);
    }
  };

  const handleRespondInvitation = async (inviteId, action) => {
    setError('');
    try {
      const res = await apiClient(`/api/v1/practices/invitations/${inviteId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to respond to invitation.');
      }
      setStatusMessage(action === 'ACCEPT' ? 'Invitation accepted! Opening workspace...' : 'Invitation declined.');
      await checkSession();
      await loadPendingDoctorItems();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-gate-shell">
      <div className="auth-gate-card">
        <div className="auth-inline-actions">
          <span className="auth-step-pill">
            {accountStatus.replace(/_/g, ' ')}
          </span>
          <div className="portal-row-wrap">
            <button type="button" className="auth-secondary-btn" onClick={() => checkSession()}>
              <RefreshCw size={15} />
              <span>Refresh Status</span>
            </button>
            <button type="button" className="auth-secondary-btn" onClick={logout}>
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="form-alert-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="auth-success-banner">
            <CheckCircle2 size={16} />
            <span>{statusMessage}</span>
          </div>
        )}

        {accountStatus === 'PENDING_VERIFICATION' && (
          <div className="portal-stack-md">
            <div className="auth-gate-header">
              <h1 className="auth-gate-title">Verify Your Contact Information</h1>
              <p className="auth-gate-subtitle">
                Complete email or mobile verification for <strong>{user?.email}</strong> to proceed.
              </p>
            </div>
            <VerificationStep
              pendingContext={{ email: user?.email }}
              onVerified={() => checkSession()}
            />
          </div>
        )}

        {accountStatus === 'PENDING_APPROVAL' && (
          <div className="portal-stack-md">
            <div className="auth-gate-header">
              <h1 className="auth-gate-title">Hospital Application Under Review</h1>
              <p className="auth-gate-subtitle">
                Your hospital workspace (<strong>{user?.practiceName || user?.clinicName || user?.email}</strong>) is verified and awaiting Super Admin approval. Once approved, refresh or sign in to access your Hospital Admin Dashboard.
              </p>
            </div>
            <div className="auth-info-banner">
              <Clock size={18} />
              <span>Hospital registrations cannot self-activate automatically and require platform administrator accreditation review.</span>
            </div>
          </div>
        )}

        {(accountStatus === 'REJECTED' || accountStatus === 'SUSPENDED' || accountStatus === 'INACTIVE') && (
          <div className="portal-stack-md">
            <div className="auth-gate-header">
              <h1 className="auth-gate-title">Account Access Restricted ({accountStatus})</h1>
              <p className="auth-gate-subtitle">
                Your account or practice status is currently <strong>{accountStatus}</strong>. Contact PetCare AI support for assistance.
              </p>
            </div>
            <div className="form-alert-banner">
              <ShieldAlert size={18} />
              <span>Access to clinical workspaces is disabled while status is {accountStatus}.</span>
            </div>
          </div>
        )}

        {accountStatus === 'ACTIVE' && isDoctorRole && (
          <div className="portal-stack-md">
            <div className="auth-gate-header">
              <h1 className="auth-gate-title">Waiting for Hospital Approval — Or Start Independently</h1>
              <p className="auth-gate-subtitle">
                Your veterinary credentials are active, but your hospital affiliation is still pending approval. You do not have to wait for a hospital to begin practicing.
              </p>
            </div>

            {invitations.length > 0 && (
              <div className="portal-stack-sm">
                <span className="auth-field-label">Pending Hospital Invitations</span>
                {invitations.map((inv) => (
                  <div key={inv.id} className="practice-discovery-card">
                    <div>
                      <h4 className="practice-card-title">{inv.practice_name}</h4>
                      <p className="practice-card-sub">Invited as {inv.role}</p>
                    </div>
                    <div className="portal-row-wrap">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                      >
                        <CheckCircle2 size={15} />
                        <span>Accept &amp; Join</span>
                      </button>
                      <button
                        type="button"
                        className="auth-secondary-btn"
                        onClick={() => handleRespondInvitation(inv.id, 'DECLINE')}
                      >
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {joinRequests.length > 0 && (
              <div className="portal-stack-sm">
                <span className="auth-field-label">Hospital Join Requests</span>
                {joinRequests.map((jr) => (
                  <div key={jr.id} className="auth-hospital-option">
                    <span className="auth-hospital-option-meta">
                      <span className="auth-hospital-option-name">{jr.hospital_name}</span>
                      <span className="auth-hospital-option-loc">{[jr.city, jr.state].filter(Boolean).join(', ')}</span>
                    </span>
                    <span className="admin-badge badge-pending">{jr.status}</span>
                  </div>
                ))}
              </div>
            )}

            {!loading && joinRequests.length === 0 && invitations.length === 0 && (
              <div className="auth-info-banner">
                <Building2 size={16} />
                <span>No pending hospital requests found yet. Launch your own independent practice below to start right away.</span>
              </div>
            )}

            <div className="auth-section-divider">Launch Independent Practice Right Now</div>
            <div className="auth-field-group">
              <label htmlFor="gate-practice-name" className="auth-field-label">Independent Practice Name</label>
              <div className="auth-input-wrapper">
                <Stethoscope size={18} className="auth-input-lead-icon" />
                <input
                  id="gate-practice-name"
                  type="text"
                  className="auth-clean-input"
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  placeholder={`${user?.name || 'Dr. Veterinarian'} Practice`}
                />
              </div>
            </div>

            <button
              type="button"
              className="auth-submit-btn"
              onClick={handleLaunchIndependent}
              disabled={launching}
            >
              <span>{launching ? 'Provisioning Workspace...' : 'Create Independent Practice Workspace'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

