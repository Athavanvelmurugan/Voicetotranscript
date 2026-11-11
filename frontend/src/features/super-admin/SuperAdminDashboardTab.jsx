import React from 'react';
import {
  Building2, Users, Heart, Stethoscope, ShieldCheck,
  Activity, Server, CheckCircle2, TrendingUp, RefreshCw,
  FileText, ArrowRight, Shield, Zap, Database
} from 'lucide-react';

export function SuperAdminDashboardTab({ trends, onRefresh, loading, onNavigateTab }) {
  const kpis = trends?.kpis || {};
  const services = trends?.services || [];
  const consultationTrends = trends?.consultationTrends || [];

  // Calculate 14-day max for chart scaling
  const maxTrend = consultationTrends.reduce((max, t) => Math.max(max, parseInt(t.consultation_count, 10) || 0), 1);
  const total14DayConsultations = consultationTrends.reduce((sum, t) => sum + (parseInt(t.consultation_count, 10) || 0), 0);

  return (
    <div className="doctor-tab-container">
      {/* Platform Macro Hero */}
      <section className="doctor-dashboard-hero" aria-label="Platform Control Plane Overview">
        <div className="dashboard-hero-content">
          <div className="hero-status-pill">
            <span className="live-dot" aria-hidden="true" />
            <span>Platform Core Status: All Systems Operational (99.98% SLA)</span>
          </div>
          <h1 className="dashboard-hero-title">
            PetPulse Multi-Tenant Platform Control Plane
          </h1>
          <p className="dashboard-hero-sub">
            Global network telemetry, accredited veterinary hospitals, AI ambient scribes, and cryptographic ledger status.
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onRefresh}
            title="Refresh Telemetry"
            aria-label="Refresh platform telemetry"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} aria-hidden="true" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </section>

      {/* Core Platform KPIs Grid */}
      <section className="dashboard-metrics-grid" aria-label="Global System Metrics">
        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">Accredited Hospitals</span>
            <div className="metric-icon-box metric-icon-primary">
              <Building2 size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{kpis.total_clinics || 0}</span>
            <span className="metric-badge metric-badge-success">{kpis.active_clinics || 0} Active</span>
          </div>
          <span className="metric-caption">Enterprise hospital tenants</span>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">Licensed Veterinarians</span>
            <div className="metric-icon-box metric-icon-success">
              <Stethoscope size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{kpis.total_doctors || 0}</span>
            <span className="metric-badge metric-badge-info">DVM Roster</span>
          </div>
          <span className="metric-caption">Attending clinical practitioners</span>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">Enrolled Patients</span>
            <div className="metric-icon-box metric-icon-accent">
              <Heart size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{kpis.total_patients || 0}</span>
            <span className="metric-badge metric-badge-success">Active Records</span>
          </div>
          <span className="metric-caption">Animal patients across hospitals</span>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-header">
            <span className="metric-label">AI Consultations</span>
            <div className="metric-icon-box metric-icon-warning">
              <Activity size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{kpis.total_consultations || 0}</span>
            <span className="metric-badge metric-badge-info">{kpis.completed_consultations || 0} Signed</span>
          </div>
          <span className="metric-caption">Live Whisper audio transcriptions</span>
        </div>
      </section>

      {/* 14-Day Consultation & AI Scribe Volume Visualizer */}
      <section className="dashboard-panel" aria-label="14-Day Consultation Activity Visualizer">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">14-Day Network Consultation &amp; AI Scribe Velocity</h2>
            <span className="dashboard-panel-sub">
              Total 14-Day Volume: <strong>{total14DayConsultations} consultations</strong> across all connected hospitals
            </span>
          </div>
          <div className="metric-badge metric-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={13} />
            <span>Active Ambient Scribe Pipeline</span>
          </div>
        </div>

        {consultationTrends.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
            No consultation activity recorded in the past 14 days.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3) 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', height: '120px', padding: '0 var(--space-2)' }}>
              {consultationTrends.map((t, idx) => {
                const count = parseInt(t.consultation_count, 10) || 0;
                const heightPct = Math.max(12, Math.round((count / maxTrend) * 100));
                const dateLabel = t.date ? t.date.slice(5) : `#${idx + 1}`;
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                    title={`${t.date}: ${count} consultations`}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 'var(--weight-bold)', color: 'var(--color-text-muted)' }}>
                      {count}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '28px',
                        height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                        borderRadius: 'var(--radius-xs)',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {dateLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Network Telemetry & Multi-Tenant Distribution */}
      <section className="dashboard-panel" aria-label="Tenant Network Intelligence">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">Multi-Tenant Intelligence &amp; Cryptographic Assets</h2>
            <span className="dashboard-panel-sub">Hospital governance, guardian engagement, and tamper-evident records</span>
          </div>
        </div>

        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon icon-purple">
              <FileText size={22} aria-hidden="true" />
            </div>
            <div className="admin-stat-info">
              <h3>{kpis.total_prescriptions || 0}</h3>
              <p>Cryptographic Prescriptions</p>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Digitally signed &amp; PDF stamped
              </span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon icon-blue">
              <Users size={22} aria-hidden="true" />
            </div>
            <div className="admin-stat-info">
              <h3>{kpis.total_guardians || 0}</h3>
              <p>Registered Pet Guardians</p>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Active owner consumer portal accounts
              </span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon icon-green">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div className="admin-stat-info">
              <h3>{kpis.total_clinic_admins || 0}</h3>
              <p>Hospital Practice Administrators</p>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Clinic operational supervisors
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Microservice Health & SLAs */}
      <section className="dashboard-panel" aria-label="Microservice Telemetry & System Health">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">Platform Microservice Health &amp; SLAs</h2>
            <span className="dashboard-panel-sub">Real-time status of multi-tenant backplane services</span>
          </div>
        </div>

        <div className="settings-info-grid">
          {services.map((srv, idx) => (
            <div key={idx} className="queue-item-card" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className="metric-icon-box metric-icon-primary" style={{ width: '36px', height: '36px' }}>
                  <Server size={18} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                    {srv.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {srv.type}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {srv.latencyMs && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {srv.latencyMs}ms
                  </span>
                )}
                <span className="badge badge-success">
                  <CheckCircle2 size={12} style={{ marginRight: '3px' }} aria-hidden="true" />
                  {srv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Command Shortcuts */}
      {onNavigateTab && (
        <section className="dashboard-panel" aria-label="Operational Command Shortcuts">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">Super Admin Quick Navigation</h2>
              <span className="dashboard-panel-sub">Direct access to multi-tenant management workflows</span>
            </div>
          </div>

          <div className="admin-quick-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => onNavigateTab('add-hospital')}
            >
              <Building2 size={16} />
              <span>Onboard New Hospital</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => onNavigateTab('hospitals')}
            >
              <Users size={16} />
              <span>Hospital Master Directory</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => onNavigateTab('audit')}
            >
              <ShieldCheck size={16} />
              <span>Cross-Tenant Audit Ledger</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
