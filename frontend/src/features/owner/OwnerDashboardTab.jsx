import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart, Calendar, Stethoscope, Building2, ShieldCheck,
  Clock, ArrowRight, Plus, RefreshCw, AlertCircle, FileText
} from 'lucide-react';
import { ownerFetch } from '../../api/ownerClient';

export function OwnerDashboardTab({ owner, onNavigateTab }) {
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, petsRes, apptsRes, consultsRes] = await Promise.all([
        ownerFetch('/api/v1/owner-portal/me'),
        ownerFetch('/api/v1/owner-portal/pets'),
        ownerFetch('/api/v1/owner-portal/appointments?limit=5'),
        ownerFetch('/api/v1/owner-portal/consultations'),
      ]);

      const parseJsonSafe = async (res) => {
        try {
          const text = await res.text();
          return text ? JSON.parse(text) : { success: false };
        } catch (_) {
          return { success: false };
        }
      };

      const [profileData, petsData, apptsData, consultsData] = await Promise.all([
        parseJsonSafe(profileRes),
        parseJsonSafe(petsRes),
        parseJsonSafe(apptsRes),
        parseJsonSafe(consultsRes),
      ]);

      if (profileData.success) setProfile(profileData.data);
      if (petsData.success) setPets(petsData.data || []);
      if (apptsData.success) setAppointments(apptsData.data || []);
      if (consultsData.success) setConsultations(consultsData.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const upcomingAppts = appointments.filter((a) => a.status === 'scheduled' || a.status === 'confirmed');

  return (
    <div className="owner-tab-pane">
      {/* Clinician Welcome Hero */}
      <div className="owner-hero-banner">
        <div className="owner-hero-content">
          <div className="hero-status-pill">
            <span className="live-dot" aria-hidden="true" />
            <span>Verified Guardian Access • Active</span>
          </div>
          <h1 className="owner-hero-title">
            Welcome back, {owner?.name || 'Pet Guardian'}
          </h1>
          <p className="owner-hero-subtitle">
            {profile?.clinic_name
              ? `Affiliated with ${profile.clinic_name} • Comprehensive Health & Ambient Notes`
              : 'Direct Veterinary Health Access, Ambient Consultations & Prescription Records'}
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => onNavigateTab && onNavigateTab('appointments')}
        >
          <Calendar size={16} aria-hidden="true" />
          <span>Book Appointment</span>
        </button>
      </div>

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={fetchDashboardData} className="doctor-retry-btn">Retry</button>
        </div>
      )}

      {/* Trends Metrics Cards Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-green">
            <Heart size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : pets.length}</h3>
            <p>Active Companions</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-blue">
            <Calendar size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : upcomingAppts.length}</h3>
            <p>Confirmed Visits</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-orange">
            <Stethoscope size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : consultations.length}</h3>
            <p>Completed Visits</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-purple">
            <Building2 size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3 style={{ fontSize: 'var(--text-lg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
              {profile?.clinic_name || 'Care Network'}
            </h3>
            <p>Primary Hospital</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Upcoming Visits + Pets */}
      <div className="admin-dashboard-two-col">
        {/* Upcoming Appointments */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Upcoming Appointments Roster</h3>
              <p className="admin-card-subtitle">Confirmed visits with your hospital veterinarians.</p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-outline admin-btn-sm"
              onClick={() => onNavigateTab && onNavigateTab('appointments')}
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="admin-card-body">
            {loading ? (
              <p className="table-empty-message">Loading appointment schedule...</p>
            ) : upcomingAppts.length === 0 ? (
              <div className="doctor-empty-state" style={{ padding: 'var(--space-5) var(--space-3)' }}>
                <Clock size={28} />
                <h4 style={{ margin: 'var(--space-2) 0' }}>No upcoming appointments scheduled</h4>
                <p>Book a consultation slot with your doctor whenever your pet needs veterinary attention.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={() => onNavigateTab && onNavigateTab('appointments')}
                  style={{ marginTop: 'var(--space-2)' }}
                >
                  <Plus size={14} />
                  <span>Book Consultation Slot</span>
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Companion</th>
                      <th>Doctor</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingAppts.slice(0, 4).map((apt) => (
                      <tr key={apt.id}>
                        <td>
                          <strong>{new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                          <div className="admin-meta-sub">{new Date(apt.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                        </td>
                        <td><strong>{apt.pet_name}</strong></td>
                        <td>{apt.doctor_name || 'Attending DVM'}</td>
                        <td>{apt.reason || 'General Checkup'}</td>
                        <td>
                          <span className="admin-badge badge-active">{apt.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Registered Companions */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Registered Family Companions</h3>
              <p className="admin-card-subtitle">Active pets linked to your guardian health profile.</p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-outline admin-btn-sm"
              onClick={() => onNavigateTab && onNavigateTab('pets')}
            >
              <span>Manage Pets</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="admin-card-body">
            {loading ? (
              <p className="table-empty-message">Loading pet details...</p>
            ) : pets.length === 0 ? (
              <div className="doctor-empty-state" style={{ padding: 'var(--space-5) var(--space-3)' }}>
                <Heart size={28} />
                <h4 style={{ margin: 'var(--space-2) 0' }}>No pets registered yet</h4>
                <p>Register your animal companions to track health records, allergies, and prescriptions.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={() => onNavigateTab && onNavigateTab('pets')}
                  style={{ marginTop: 'var(--space-2)' }}
                >
                  <Plus size={14} />
                  <span>Register First Pet</span>
                </button>
              </div>
            ) : (
              <div className="owner-pets-mini-list">
                {pets.slice(0, 4).map((pet) => (
                  <div key={pet.id} className="owner-pet-mini-item">
                    <div className="pet-mini-avatar">🐾</div>
                    <div className="pet-mini-info">
                      <strong>{pet.name}</strong>
                      <span className="admin-meta-sub">{pet.species} • {pet.breed || 'Companion'}</span>
                    </div>
                    <span className="admin-badge badge-info">{pet.age_years ? `${pet.age_years} yrs` : 'Active'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
