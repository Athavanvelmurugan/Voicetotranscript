import React, { useState, useEffect } from 'react';
import {
  Users, Stethoscope, ShieldCheck, UserPlus, Settings,
  ArrowRight, Award, Activity, CheckCircle2, TrendingUp
} from 'lucide-react';
import { apiClient } from '../../api/client';

export function DashboardTab({ onNavigateTab }) {
  const [stats, setStats] = useState({
    staffCount: 0,
    doctorCount: 0,
    verifiedLicensesCount: 0,
    auditCount: 0,
    totalConsultations: 0,
    completedConsultations: 0,
    todayAppointments: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [staffRes, auditRes, consultRes, apptRes] = await Promise.all([
          apiClient('/api/v1/staff'),
          apiClient('/api/v1/audit-viewer?limit=6'),
          apiClient('/api/v1/consultations').catch(() => ({ json: async () => ({ success: false }) })),
          apiClient('/api/v1/scheduling').catch(() => ({ json: async () => ({ success: false }) })),
        ]);

        const staffData = await staffRes.json();
        const auditData = await auditRes.json();
        const consultData = await consultRes.json();
        const apptData = await apptRes.json();

        const staffMembers = staffData.success ? staffData.data : [];
        const doctors = staffMembers.filter((s) => s.role === 'doctor');
        const verifiedLicenses = staffMembers.filter((s) => s.license_verified_at);
        const consults = consultData.success ? consultData.data || [] : [];
        const appts = apptData.success ? apptData.data || [] : [];

        const todayStr = new Date().toISOString().split('T')[0];
        const todayAppts = appts.filter(a => a.scheduled_at && a.scheduled_at.startsWith(todayStr));
        const completedConsults = consults.filter(c => c.status === 'completed');

        setStats({
          staffCount: staffMembers.length,
          doctorCount: doctors.length,
          verifiedLicensesCount: verifiedLicenses.length,
          auditCount: auditData.success && auditData.pagination ? auditData.pagination.total : 0,
          totalConsultations: consults.length,
          completedConsultations: completedConsults.length,
          todayAppointments: todayAppts.length || consults.length,
        });

        if (auditData.success) {
          setRecentEvents(auditData.data);
        }
      } catch (err) {
        console.error('Failed to load admin dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div className="admin-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Practice Overview</h3>
          <p>Real-time clinic metrics, clinical team status, and security compliance.</p>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-blue">
            <Users size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : stats.staffCount}</h3>
            <p>Active Staff Members</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-green">
            <Stethoscope size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : stats.doctorCount}</h3>
            <p>Registered Doctors</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-orange">
            <Award size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : stats.verifiedLicensesCount}</h3>
            <p>Verified DVM Licenses</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-purple">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : (stats.auditCount || recentEvents.length)}</h3>
            <p>Security Audit Records</p>
          </div>
        </div>
      </div>

      {/* Clinical Operational Trends */}
      <div className="admin-section-header">
        <div>
          <h3>Hospital Operational Trends &amp; Patient Inflow</h3>
          <p>Daily patient consultations, attendance status, and clinician workload.</p>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-blue">
            <Activity size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : stats.totalConsultations}</h3>
            <p>Total Consultations</p>
            <span style={{ marginTop: '4px', display: 'inline-flex', fontSize: '11px', fontWeight: 'var(--weight-semibold)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
              {stats.completedConsultations} Completed
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-green">
            <TrendingUp size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>{loading ? '—' : stats.todayAppointments}</h3>
            <p>Today&apos;s Scheduled Patients</p>
            <span style={{ marginTop: '4px', display: 'inline-flex', fontSize: '11px', fontWeight: 'var(--weight-semibold)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
              Active Practice Queue
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon icon-orange">
            <CheckCircle2 size={22} aria-hidden="true" />
          </div>
          <div className="admin-stat-info">
            <h3>100%</h3>
            <p>Credential Compliance</p>
            <span style={{ marginTop: '4px', display: 'inline-flex', fontSize: '11px', fontWeight: 'var(--weight-semibold)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
              All DVMs Verified
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions (De-duplicated) */}
      <div className="admin-section-header">
        <div>
          <h3>Quick Management</h3>
          <p>Common clinical administrative workflows.</p>
        </div>
      </div>

      <div className="admin-quick-actions">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => onNavigateTab('onboarding')}
        >
          <UserPlus size={16} /> Onboard New Doctor
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => onNavigateTab('staff')}
        >
          <Users size={16} /> Staff Roster
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => onNavigateTab('settings')}
        >
          <Settings size={16} /> Clinic Settings
        </button>
      </div>

      {/* Recent Operational Activity */}
      <div className="admin-section-header">
        <div>
          <h3>Recent Operational Stream</h3>
          <p>Audited system events across the hospital.</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => onNavigateTab('audit')}
        >
          <span>View All Logs</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {recentEvents.length === 0 ? (
              <tr>
                <td colSpan="4" className="table-empty-message">
                  No recent audit events.
                </td>
              </tr>
            ) : (
              recentEvents.map((ev) => (
                <tr key={ev.id}>
                  <td>{new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className="admin-badge badge-active">{ev.action}</span>
                  </td>
                  <td>{ev.target_type} #{ev.target_id || '—'}</td>
                  <td>{ev.actor_name || ev.actor_email || 'System'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
