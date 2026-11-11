import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, Heart, UserPlus, Calendar, Clock,
  CheckCircle, ArrowUpRight, Activity, AlertCircle,
  RefreshCw, ChevronRight, User, Phone, Sparkles
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiClient } from '../../api/client';

export function DoctorDashboardTab({ onNavigateTab, onStartConsultation, onOpenPatientChart }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    todayAppointments: 0,
    totalPatients: 0,
    completedConsultations: 0,
    openSlots: 0,
  });
  const [todayQueue, setTodayQueue] = useState([]);
  const [recentConsultations, setRecentConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [consultRes, petsRes, apptRes, slotsRes] = await Promise.all([
        apiClient('/api/v1/consultations'),
        apiClient('/api/v1/pets'),
        apiClient('/api/v1/scheduling/appointments').catch(() => ({ json: async () => ({ success: false }) })),
        apiClient('/api/v1/scheduling/slots').catch(() => ({ json: async () => ({ success: false }) })),
      ]);

      const consultData = await consultRes.json();
      const petsData = await petsRes.json();
      const apptData = await apptRes.json();
      const slotsData = await slotsRes.json();

      const consults = consultData.success ? consultData.data || [] : [];
      const pets = petsData.success ? petsData.data || [] : [];
      const appts = apptData.success ? apptData.data || [] : [];
      const slots = slotsData.success ? slotsData.data || [] : [];

      const todayStr = new Date().toISOString().split('T')[0];
      const todayAppts = appts.filter(a => a.scheduled_at && a.scheduled_at.startsWith(todayStr));
      const completed = consults.filter(c => c.status === 'completed');
      const openSlots = slots.filter(s => s.is_available);

      setStats({
        todayAppointments: todayAppts.length || consults.length,
        totalPatients: pets.length,
        completedConsultations: completed.length,
        openSlots: openSlots.length,
      });

      // Prepare queue from today's appointments or latest scheduled consultations
      if (todayAppts.length > 0) {
        setTodayQueue(todayAppts.slice(0, 5));
      } else {
        // Fallback to active/scheduled consultations
        const activeQueue = consults
          .filter(c => c.status === 'scheduled' || c.status === 'recording' || c.status === 'processing')
          .slice(0, 5);
        setTodayQueue(activeQueue);
      }

      setRecentConsultations(consults.slice(0, 5));
    } catch (err) {
      console.error('[DoctorDashboardTab] Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load clinical dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Format clinician display name cleanly without duplicate Dr. prefix
  const doctorDisplayName = user?.name
    ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`)
    : 'Dr. Veterinarian';

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="doctor-tab-container">
      {/* Clinician Welcome Hero */}
      <section className="doctor-dashboard-hero" aria-label="Attending Veterinarian Welcome">
        <div className="dashboard-hero-content">
          <div className="hero-status-pill">
            <span className="live-dot" aria-hidden="true" />
            <span>Clinical Shift Active • {todayFormatted}</span>
          </div>
          <h1 className="dashboard-hero-title">
            Welcome back, {doctorDisplayName}
          </h1>
          <p className="dashboard-hero-sub">
            {user?.clinicName || 'Central Valley Animal Hospital'} • {user?.licenseNumber ? `DVM License #${user.licenseNumber}` : 'Licensed Attending Clinician'}
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigateTab('consultation')}
          >
            <Stethoscope size={16} aria-hidden="true" />
            <span>Start Live Scribe</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchDashboardData}
            title="Refresh Metrics"
            aria-label="Refresh clinical dashboard data"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </section>

      {error && (
        <div className="doctor-alert doctor-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Metric Cards */}
      <section className="dashboard-metrics-grid" aria-label="Key Clinical Statistics">
        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">Today's Appointments</span>
            <div className="metric-icon-box metric-icon-primary">
              <Calendar size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{stats.todayAppointments}</span>
            <span className="metric-badge metric-badge-info">Agenda</span>
          </div>
          <span className="metric-caption">Scheduled clinical consultations</span>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">Registered Patients</span>
            <div className="metric-icon-box metric-icon-success">
              <Heart size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{stats.totalPatients}</span>
            <span className="metric-badge metric-badge-success">Hospital Roster</span>
          </div>
          <span className="metric-caption">Enrolled pets under clinic care</span>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">Completed Consultations</span>
            <div className="metric-icon-box metric-icon-accent">
              <CheckCircle size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{stats.completedConsultations}</span>
            <span className="metric-badge metric-badge-success">SOAP Signed</span>
          </div>
          <span className="metric-caption">Finalized veterinary notes</span>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">Available Slots Today</span>
            <div className="metric-icon-box metric-icon-warning">
              <Clock size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{stats.openSlots}</span>
            <span className="metric-badge metric-badge-info">Open</span>
          </div>
          <span className="metric-caption">Time blocks open for bookings</span>
        </div>
      </section>

      {/* Quick Launchers */}
      <section className="dashboard-quick-actions" aria-label="Clinical Quick Actions">
        <h2 className="dashboard-section-heading">Clinical Fast Actions</h2>
        <div className="dashboard-actions-grid">
          <button
            type="button"
            className="action-launcher-card"
            onClick={() => onNavigateTab('consultation')}
          >
            <div className="launcher-icon launcher-icon-primary">
              <Stethoscope size={20} aria-hidden="true" />
            </div>
            <div className="launcher-text">
              <span className="launcher-title">Live Consultation & AI Scribe</span>
              <span className="launcher-desc">Real-time Whisper capture, SOAP generator & prescriptions</span>
            </div>
            <ArrowUpRight size={18} className="launcher-arrow" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="action-launcher-card"
            onClick={() => onNavigateTab('add-patient')}
          >
            <div className="launcher-icon launcher-icon-success">
              <UserPlus size={20} aria-hidden="true" />
            </div>
            <div className="launcher-text">
              <span className="launcher-title">Register New Patient</span>
              <span className="launcher-desc">Enroll animal patient, vitals, microchip ID & guardian</span>
            </div>
            <ArrowUpRight size={18} className="launcher-arrow" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="action-launcher-card"
            onClick={() => onNavigateTab('patients')}
          >
            <div className="launcher-icon launcher-icon-accent">
              <Heart size={20} aria-hidden="true" />
            </div>
            <div className="launcher-text">
              <span className="launcher-title">Patient Medical Charts</span>
              <span className="launcher-desc">Clinical summaries, timeline, prescriptions & allergies</span>
            </div>
            <ArrowUpRight size={18} className="launcher-arrow" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="action-launcher-card"
            onClick={() => onNavigateTab('schedule')}
          >
            <div className="launcher-icon launcher-icon-warning">
              <Calendar size={20} aria-hidden="true" />
            </div>
            <div className="launcher-text">
              <span className="launcher-title">Calendar & Available Slots</span>
              <span className="launcher-desc">Configure daily consultation blocks & booking schedule</span>
            </div>
            <ArrowUpRight size={18} className="launcher-arrow" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Two Column Grid: Today's Queue & Recent Consultations */}
      <div className="dashboard-split-grid">
        {/* Left Column: Today's Clinical Queue */}
        <section className="dashboard-panel" aria-label="Today's Patient Queue">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Today's Patient Queue</h2>
              <span className="dashboard-panel-sub">Waiting for attending examination</span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigateTab('appointments')}
            >
              <span>View Full Queue</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="dashboard-queue-list">
            {todayQueue.length === 0 ? (
              <div className="dashboard-empty-box">
                <Clock size={28} className="empty-icon" aria-hidden="true" />
                <p className="empty-title">No patients waiting in queue</p>
                <p className="empty-sub">Scheduled appointments for today will automatically appear here.</p>
              </div>
            ) : (
              todayQueue.map((item) => {
                const petName = item.pet_name || item.name || 'Patient';
                const species = item.pet_species || item.species || 'Canine';
                const breed = item.pet_breed || item.breed || 'Companion';
                const owner = item.owner_name || 'Guardian';
                const time = item.scheduled_at
                  ? new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Today';

                return (
                  <div key={item.id} className="queue-item-card">
                    <div className="queue-patient-avatar">
                      {petName.charAt(0).toUpperCase()}
                    </div>
                    <div className="queue-patient-info">
                      <div className="queue-patient-name-row">
                        <span className="queue-patient-name">{petName}</span>
                        <span className="badge badge-species">{species}</span>
                      </div>
                      <span className="queue-patient-sub">
                        {breed} • Owner: {owner}
                      </span>
                    </div>
                    <div className="queue-patient-time">
                      <Clock size={13} aria-hidden="true" />
                      <span>{time}</span>
                    </div>
                    <div className="queue-patient-action">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onStartConsultation(item.pet_id || item.id)}
                        title={`Start Live Consultation for ${petName}`}
                      >
                        <Stethoscope size={13} aria-hidden="true" />
                        <span>Consult</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Recent Consultations & SOAP Records */}
        <section className="dashboard-panel" aria-label="Recent Consultations">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Recent Clinical Records</h2>
              <span className="dashboard-panel-sub">Transcriptions & signed SOAP notes</span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigateTab('patients')}
            >
              <span>All Patients</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="dashboard-recent-list">
            {recentConsultations.length === 0 ? (
              <div className="dashboard-empty-box">
                <Stethoscope size={28} className="empty-icon" aria-hidden="true" />
                <p className="empty-title">No recent consultations recorded</p>
                <p className="empty-sub">Launch a consultation session to record ambient clinical notes.</p>
              </div>
            ) : (
              recentConsultations.map((c) => {
                const dateStr = c.created_at
                  ? new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : 'Recent';

                return (
                  <div key={c.id} className="recent-consult-card">
                    <div className="recent-consult-main">
                      <div className="recent-patient-row">
                        <span className="recent-patient-name">{c.pet_name || `Patient #${c.pet_id}`}</span>
                        <span className={`badge ${c.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                          {c.status || 'scheduled'}
                        </span>
                      </div>
                      <span className="recent-patient-meta">
                        {c.pet_species || 'Veterinary'} • {dateStr} • Attending: Dr. {c.doctor_name || user?.name}
                      </span>
                    </div>
                    <div className="recent-consult-actions">
                      {c.pet_id && onOpenPatientChart && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onOpenPatientChart(c.pet_id)}
                          title="Open Patient Medical Chart"
                        >
                          <Heart size={13} aria-hidden="true" />
                          <span>Chart</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

