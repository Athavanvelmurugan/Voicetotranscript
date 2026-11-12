import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Stethoscope, Search, CheckCircle2, ArrowRight, RefreshCw, AlertCircle, Plus, Clock
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

export function PracticeAffiliationsTab() {
  const { user, switchPractice, checkSession } = useAuth();
  const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
  const hasIndependent = memberships.some((m) => m.practice_type === 'INDEPENDENT' && m.status === 'ACTIVE');

  const [invitations, setInvitations] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [newPracticeName, setNewPracticeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, reqRes, discRes] = await Promise.all([
        apiClient('/api/v1/practices/my-invitations'),
        apiClient('/api/v1/practices/my-join-requests'),
        apiClient(`/api/v1/practices/discover?type=HOSPITAL&q=${encodeURIComponent(searchQ.trim())}`),
      ]);
      const [invJson, reqJson, discJson] = await Promise.all([
        invRes.json(),
        reqRes.json(),
        discRes.json(),
      ]);
      if (invJson.success) setInvitations(invJson.data || []);
      if (reqJson.success) setJoinRequests(reqJson.data || []);
      if (discJson.success) setHospitals(discJson.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load practice affiliations.');
    } finally {
      setLoading(false);
    }
  }, [searchQ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSwitch = async (practiceId) => {
    setBusy(true);
    setError('');
    try {
      await switchPractice(practiceId);
      setStatusMsg('Switched active clinical workspace.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRequestJoin = async (hospitalPracticeId, hospitalName) => {
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient(`/api/v1/practices/${hospitalPracticeId}/join-requests`, {
        method: 'POST',
        body: JSON.stringify({ message: joinMessage.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Join request failed.');
      }
      setStatusMsg(`Join request sent to ${hospitalName}.`);
      setJoinMessage('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRespondInvitation = async (inviteId, action) => {
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient(`/api/v1/practices/invitations/${inviteId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not respond to invitation.');
      }
      setStatusMsg(action === 'ACCEPT' ? 'Hospital membership activated!' : 'Invitation declined.');
      await checkSession();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLaunchIndependent = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient('/api/v1/practices', {
        method: 'POST',
        body: JSON.stringify({
          practiceName: newPracticeName.trim() || `${user?.name || 'Dr. Veterinarian'} Independent Practice`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to launch independent practice.');
      }
      setStatusMsg('Independent practice workspace created! You can now switch between it and affiliated hospitals anytime.');
      setNewPracticeName('');
      await checkSession();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="doctor-tab-container">
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h1 className="doctor-tab-heading">My Practices &amp; Hospital Affiliations</h1>
          <p className="doctor-tab-subheading">
            Switch between your independent practice and affiliated hospitals, or request to join additional accredited hospitals.
          </p>
        </div>
        <div className="doctor-tab-header-actions">
          <button type="button" className="btn btn-outline" onClick={loadData} disabled={loading}>
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

      {/* 1. Active Practice Memberships */}
      <div className="admin-card portal-alert-gap">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Active Clinical Workspaces ({memberships.filter((m) => m.status === 'ACTIVE').length})</h3>
            <p className="admin-card-subtitle">Each workspace isolates patients, appointments, medical records, and prescriptions.</p>
          </div>
        </div>
        <div className="practice-cards-grid">
          {memberships.filter((m) => m.status === 'ACTIVE').map((m) => {
            const isCurrent = Number(user?.practiceId) === Number(m.practice_id);
            return (
              <div
                key={m.practice_id}
                className={`practice-discovery-card ${isCurrent ? 'practice-discovery-card--active' : ''}`}
              >
                <div className="portal-stack-sm">
                  <div className="practice-card-meta-row">
                    <span className="practice-type-chip">
                      {m.practice_type === 'INDEPENDENT' ? <Stethoscope size={13} /> : <Building2 size={13} />}
                      <span>{m.practice_type}</span>
                    </span>
                    <span className="admin-badge badge-active">{m.role}</span>
                  </div>
                  <h4 className="practice-card-title">{m.practice_name}</h4>
                  <p className="practice-card-sub">{[m.city, m.state].filter(Boolean).join(', ') || 'Verified Practice'}</p>
                </div>
                <button
                  type="button"
                  className={`btn ${isCurrent ? 'btn-outline' : 'btn-primary'}`}
                  disabled={isCurrent || busy}
                  onClick={() => handleSwitch(m.practice_id)}
                  data-testid={`switch-practice-btn-${m.practice_id}`}
                >
                  <span>{isCurrent ? 'Current Active Workspace' : 'Switch to This Practice'}</span>
                  {!isCurrent && <ArrowRight size={15} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Launch Independent Practice if doctor doesn't already own one */}
      {!hasIndependent && (
        <form className="admin-card portal-alert-gap" onSubmit={handleLaunchIndependent}>
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Create Independent Practice Workspace</h3>
              <p className="admin-card-subtitle">Maintain your own private practice alongside hospital affiliations—records stay strictly separate.</p>
            </div>
          </div>
          <div className="auth-fields-row">
            <div className="admin-form-group">
              <label htmlFor="launch-indep-name">Practice Name</label>
              <input
                id="launch-indep-name"
                type="text"
                className="admin-form-control"
                value={newPracticeName}
                onChange={(e) => setNewPracticeName(e.target.value)}
                placeholder={`${user?.name || 'Dr. Veterinarian'} Veterinary Care`}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Plus size={15} />
            <span>Launch Independent Practice</span>
          </button>
        </form>
      )}

      {/* 3. Pending Invitations */}
      {invitations.length > 0 && (
        <div className="admin-card portal-alert-gap">
          <h3 className="admin-card-title">Pending Hospital Invitations</h3>
          <div className="practice-cards-grid">
            {invitations.map((inv) => (
              <div key={inv.id} className="practice-discovery-card">
                <div className="portal-stack-sm">
                  <span className="practice-type-chip">{inv.role}</span>
                  <h4 className="practice-card-title">{inv.practice_name}</h4>
                </div>
                <div className="portal-row-wrap">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                  >
                    <CheckCircle2 size={15} />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    className="auth-secondary-btn"
                    disabled={busy}
                    onClick={() => handleRespondInvitation(inv.id, 'DECLINE')}
                  >
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Join Requests Sent */}
      {joinRequests.length > 0 && (
        <div className="admin-card portal-alert-gap">
          <h3 className="admin-card-title">Submitted Hospital Join Requests</h3>
          <div className="portal-stack-sm">
            {joinRequests.map((jr) => (
              <div key={jr.id} className="auth-hospital-option">
                <span className="auth-hospital-option-meta">
                  <span className="auth-hospital-option-name">{jr.hospital_name}</span>
                  <span className="auth-hospital-option-loc">{[jr.city, jr.state].filter(Boolean).join(', ')}</span>
                </span>
                <span className={`admin-badge ${jr.status === 'APPROVED' ? 'badge-active' : jr.status === 'PENDING' ? 'badge-pending' : 'badge-danger'}`}>
                  <Clock size={12} /> {jr.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Discover Hospitals to Join */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Discover Accredited Hospitals</h3>
            <p className="admin-card-subtitle">Submit a membership request to practice at a partner veterinary hospital.</p>
          </div>
        </div>
        <div className="auth-fields-row portal-alert-gap">
          <div className="admin-form-group">
            <label htmlFor="discover-hosp-q">Search Hospitals</label>
            <div className="auth-input-wrapper">
              <Search size={16} className="auth-input-lead-icon" />
              <input
                id="discover-hosp-q"
                type="text"
                className="auth-clean-input"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search by hospital name or city..."
              />
            </div>
          </div>
          <div className="admin-form-group">
            <label htmlFor="discover-join-note">Optional Intro Note</label>
            <input
              id="discover-join-note"
              type="text"
              className="admin-form-control"
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              placeholder="e.g. Available Tuesdays & Thursdays"
            />
          </div>
        </div>

        <div className="practice-cards-grid">
          {hospitals.map((h) => {
            const alreadyMember = memberships.some((m) => Number(m.practice_id) === Number(h.id) && m.status === 'ACTIVE');
            const alreadyRequested = joinRequests.some((jr) => Number(jr.practice_id) === Number(h.id) && jr.status === 'PENDING');
            return (
              <div key={h.id} className="practice-discovery-card">
                <div className="portal-stack-sm">
                  <div className="practice-card-meta-row">
                    <span className="practice-type-chip"><Building2 size={13} /> HOSPITAL</span>
                  </div>
                  <h4 className="practice-card-title">{h.name}</h4>
                  <p className="practice-card-sub">{[h.address, h.city, h.state].filter(Boolean).join(', ')}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || alreadyMember || alreadyRequested}
                  onClick={() => handleRequestJoin(h.id, h.name)}
                >
                  <span>{alreadyMember ? 'Already a Member' : alreadyRequested ? 'Request Pending' : 'Request to Join'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

