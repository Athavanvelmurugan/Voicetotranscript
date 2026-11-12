import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Stethoscope, Heart, UserPlus, Calendar, Settings,
  LogOut, Sun, Moon, Menu, X, ChevronRight, ChevronLeft, Activity, ShieldCheck,
  CalendarClock, Building2
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiClient } from '../../api/client';
import { DoctorDashboardTab } from './DoctorDashboardTab';
import { DoctorPatientListTab } from './DoctorPatientListTab';
import { ConsultationWorkspace } from '../consultation/ConsultationWorkspace';
import { DoctorAddPatientTab } from './DoctorAddPatientTab';
import { DoctorAppointmentScheduleTab } from './DoctorAppointmentScheduleTab';
import { DoctorScheduleDualTab } from './DoctorScheduleDualTab';
import { DoctorAuditLogTab } from './DoctorAuditLogTab';
import { DoctorSettingsTab } from './DoctorSettingsTab';
import { PracticeAffiliationsTab } from './PracticeAffiliationsTab';
import { PatientClinicalChart } from './PatientClinicalChart';

export function DoctorPortal() {
  const { user, logout, switchPractice } = useAuth();
  const validTabs = ['dashboard', 'patients', 'consultation', 'add-patient', 'appointments', 'schedule', 'practices', 'audit', 'settings'];
  const activeMemberships = Array.isArray(user?.memberships)
    ? user.memberships.filter((m) => String(m.status || '').toUpperCase() === 'ACTIVE')
    : [];

  const doctorDisplayName = user?.name
    ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`)
    : 'Dr. Veterinarian';

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      return tabParam && validTabs.includes(tabParam) ? tabParam : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('petcare_doctor_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [preSelectedPetId, setPreSelectedPetId] = useState(null);
  const [activeChartPetId, setActiveChartPetId] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.dataset.theme === 'dark';
  });

  // Keep URL in sync with Doctor Portal state
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      let changed = false;

      if (url.searchParams.get('portal') !== 'doctor') {
        url.searchParams.set('portal', 'doctor');
        changed = true;
      }
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        changed = true;
      }

      if (changed) {
        window.history.replaceState({}, '', url.toString());
      }
    } catch (_) {}
  }, [activeTab]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam && validTabs.includes(tabParam)) {
          setActiveTab(tabParam);
        }
      } catch (_) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDarkMode ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('petcare-theme', nextTheme);
    setIsDarkMode(!isDarkMode);
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('petcare_doctor_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

  const handleTabSelect = (tabKey) => {
    setActiveTab(tabKey);
    setMobileSidebarOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('portal', 'doctor');
      url.searchParams.set('tab', tabKey);
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  };

  const handleStartConsultation = (petId) => {
    setPreSelectedPetId(petId);
    setActiveChartPetId(null);
    handleTabSelect('consultation');
  };

  const handleLaunchConsultationFromSchedule = async (itemOrPetId) => {
    setActiveChartPetId(null);
    if (!itemOrPetId) {
      handleTabSelect('consultation');
      return;
    }

    if (typeof itemOrPetId === 'number' || typeof itemOrPetId === 'string') {
      setPreSelectedPetId(Number(itemOrPetId));
      handleTabSelect('consultation');
      return;
    }

    const item = itemOrPetId;
    if (item.active_consultation_id) {
      try {
        const userStorageKey = user?.id ? `activeConsultationId_${user.id}` : 'activeConsultationId';
        localStorage.setItem(userStorageKey, String(item.active_consultation_id));
      } catch (_) {}
      setPreSelectedPetId(null);
      handleTabSelect('consultation');
      return;
    }

    try {
      const res = await apiClient('/api/v1/consultations', {
        method: 'POST',
        body: JSON.stringify({
          petId: item.pet_id,
          doctorId: item.doctor_id || user?.id,
          appointmentId: item.id,
          language: 'en',
          consentGiven: false,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        try {
          const userStorageKey = user?.id ? `activeConsultationId_${user.id}` : 'activeConsultationId';
          localStorage.setItem(userStorageKey, String(data.data.id));
        } catch (_) {}
        setPreSelectedPetId(null);
      } else {
        setPreSelectedPetId(item.pet_id);
      }
    } catch (_) {
      setPreSelectedPetId(item.pet_id);
    }
    handleTabSelect('consultation');
  };

  const handlePatientAdded = (newPet) => {
    if (newPet?.id) {
      setPreSelectedPetId(newPet.id);
    }
  };

  const navItems = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Practice overview, patient queue & quick actions'
    },
    {
      key: 'patients',
      label: 'Patient List',
      icon: Heart,
      description: 'Clinic patients directory, clinical summaries & history'
    },
    {
      key: 'consultation',
      label: 'Live Consultation',
      icon: Stethoscope,
      description: 'Audio recording, real-time AI transcription & SOAP notes'
    },
    {
      key: 'appointments',
      label: 'Appointment Schedule',
      icon: CalendarClock,
      description: 'Daily patient queue, booked appointments & instant live consultation'
    },
    {
      key: 'add-patient',
      label: 'Register Patient',
      icon: UserPlus,
      description: 'Enroll new animal patient & guardian contact details'
    },
    {
      key: 'schedule',
      label: 'Calendar & Slots',
      icon: Calendar,
      description: 'Available appointment slots & confirmed appointments'
    },
    {
      key: 'practices',
      label: 'My Practices',
      icon: Building2,
      description: 'Independent workspace & accredited hospital affiliations'
    },
    {
      key: 'audit',
      label: 'Audit Log',
      icon: ShieldCheck,
      description: 'Pet guardian appointments, consent & clinical changes'
    },
    {
      key: 'settings',
      label: 'Doctor Settings',
      icon: Settings,
      description: 'DVM profile, license credentials & scribe preferences'
    },
  ];

  const pageHeaders = {
    dashboard: {
      title: 'Practice Overview & Clinical Dashboard',
      subtitle: 'Real-time patient queue, daily appointment roster, and fast clinical launchers.',
    },
    patients: {
      title: 'Clinic Patients & Medical Charts',
      subtitle: 'Searchable patient directory, past consultation summaries, allergy badges, and treatment timelines.',
    },
    consultation: {
      title: 'Live Clinical Consultation & AI Scribe',
      subtitle: 'Real-time ambient speech transcription, SOAP generation, prescriptions, and veterinary note review.',
    },
    appointments: {
      title: 'Appointment Schedule & Patient Queue',
      subtitle: 'Review today’s queued patients, upcoming appointments, and launch live AI consultations.',
    },
    'add-patient': {
      title: 'Patient & Guardian Registration',
      subtitle: 'Register new veterinary patients, log physical vitals, microchip ID, and guardian contact details.',
    },
    schedule: {
      title: 'Doctor Schedule & Slot Availability',
      subtitle: 'Daily appointment bookings, available consultation time slots, and queue management.',
    },
    practices: {
      title: 'Practices & Hospital Affiliations',
      subtitle: 'Switch between your independent practice and accredited hospitals or submit join requests.',
    },
    audit: {
      title: 'Clinical & Guardian Audit Trail',
      subtitle: 'Track pet owner bookings, consents, prescriptions, and cryptographic verification.',
    },
    settings: {
      title: 'Doctor Profile & Scribe Settings',
      subtitle: 'Veterinary license credentials, acoustic Whisper speech preferences, and password security.',
    },
  };

  return (
    <div className="admin-portal-wrapper">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Vertical Clinical Sidebar */}
      <aside className={`admin-vertical-sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar Brand Header */}
        <div className="sidebar-brand-section">
          <div className="sidebar-brand-top">
            <div className="admin-clinic-icon-badge" title={user?.clinicName || 'Central Valley Animal Hospital'}>
              <Stethoscope size={20} aria-hidden="true" />
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-brand-text">
                <h2 className="sidebar-clinic-name">
                  {user?.practiceName || user?.clinicName || 'Independent Practice'}
                </h2>
                <div className="sidebar-practice-pill">
                  <span className="live-dot" aria-hidden="true" />
                  <span>{user?.practiceType === 'INDEPENDENT' ? 'Independent Practice' : 'Doctor Workspace'}</span>
                </div>
              </div>
            )}
            {/* Desktop Chevron Collapse/Expand Button */}
            <button
              type="button"
              className="sidebar-collapse-toggle-btn"
              onClick={toggleSidebarCollapse}
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label={isSidebarCollapsed ? 'Expand Sidebar Navigation' : 'Collapse Sidebar Navigation'}
            >
              {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {/* Mobile Close Button */}
            <button
              type="button"
              className="sidebar-mobile-close-btn"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar navigation"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Multi-Practice Switcher */}
        {!isSidebarCollapsed && activeMemberships.length > 0 && (
          <div className="practice-switcher-wrap">
            <label htmlFor="doctor-practice-switcher" className="practice-switcher-label">
              Active Workspace
            </label>
            <select
              id="doctor-practice-switcher"
              className="practice-switcher-select"
              value={String(user?.practiceId || activeMemberships[0]?.practice_id || '')}
              onChange={(e) => switchPractice(Number(e.target.value))}
              data-testid="doctor-practice-switcher"
            >
              {activeMemberships.map((m) => (
                <option key={m.practice_id} value={String(m.practice_id)}>
                  {m.practice_name} ({m.practice_type === 'INDEPENDENT' ? 'Independent' : 'Hospital'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sidebar Navigation Items */}
        <nav className="sidebar-nav-container" aria-label="Clinical Navigation">
          <div className="sidebar-nav-group">
            {!isSidebarCollapsed && (
              <span className="sidebar-group-heading">Clinical Workspace</span>
            )}
            <div className="sidebar-group-links">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleTabSelect(item.key)}
                    title={item.label}
                  >
                    <Icon size={18} className="sidebar-item-icon" aria-hidden="true" />
                    {!isSidebarCollapsed && (
                      <>
                        <span className="sidebar-item-label">{item.label}</span>
                        {isActive && <ChevronRight size={14} className="sidebar-active-arrow" aria-hidden="true" />}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Sidebar Footer: Doctor Profile */}
        <div className="sidebar-footer-section">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar" title={doctorDisplayName}>
              <span>{(user?.name?.replace(/^Dr\.\s*/, '') || 'D')[0].toUpperCase()}</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{doctorDisplayName}</span>
                <span className="sidebar-user-role">
                  {user?.licenseNumber ? `DVM #${user.licenseNumber}` : 'Attending Clinician'}
                </span>
              </div>
            )}
            <div className="sidebar-user-actions">
              <button
                type="button"
                className="sidebar-icon-action-btn"
                onClick={toggleTheme}
                title={isDarkMode ? 'Switch to Default Theme' : 'Switch to Dark Theme'}
                aria-label="Toggle Color Theme"
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                type="button"
                className="sidebar-icon-action-btn"
                onClick={logout}
                title="Sign Out of Clinical Workspace"
                aria-label="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Clinical Viewport */}
      <div className={`admin-main-viewport ${isSidebarCollapsed ? 'viewport-expanded' : ''}`}>
        {/* Top Header Bar */}
        <header className="admin-top-navbar">
          <div className="admin-top-left">
            <button
              type="button"
              className="admin-hamburger-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <div className="admin-breadcrumbs">
              <span className="breadcrumb-root">Doctor Portal</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{pageHeaders[activeTab]?.title}</span>
            </div>
          </div>

          <div className="admin-top-right">
            <span className="doctor-topbar-status-badge">
              <Activity size={13} aria-hidden="true" />
              <span>Attending DVM Active</span>
            </span>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main
          className={`admin-content-viewport ${activeTab === 'consultation' ? 'admin-content-viewport--consultation' : ''}`}
          role="main"
        >
          {activeTab === 'dashboard' && (
            <DoctorDashboardTab
              onNavigateTab={handleTabSelect}
              onStartConsultation={handleStartConsultation}
              onOpenPatientChart={(petId) => setActiveChartPetId(petId)}
            />
          )}

          {activeTab === 'patients' && (
            <DoctorPatientListTab
              onStartConsultation={handleStartConsultation}
              onNavigateAddPatient={() => handleTabSelect('add-patient')}
            />
          )}

          {activeTab === 'consultation' && (
            <ConsultationWorkspace
              preSelectedPetId={preSelectedPetId}
              onClearPreSelectedPet={() => setPreSelectedPetId(null)}
              inPortal={true}
            />
          )}

          {activeTab === 'appointments' && (
            <DoctorAppointmentScheduleTab
              onStartConsultation={handleLaunchConsultationFromSchedule}
              onOpenPatientChart={(petId) => setActiveChartPetId(petId)}
            />
          )}

          {activeTab === 'add-patient' && (
            <DoctorAddPatientTab
              onPatientAdded={handlePatientAdded}
              onStartConsultation={handleStartConsultation}
            />
          )}

          {activeTab === 'schedule' && (
            <DoctorScheduleDualTab
              onStartConsultation={handleStartConsultation}
              onOpenPatientChart={(petId) => setActiveChartPetId(petId)}
            />
          )}

          {activeTab === 'practices' && (
            <PracticeAffiliationsTab />
          )}

          {activeTab === 'audit' && (
            <DoctorAuditLogTab />
          )}

          {activeTab === 'settings' && (
            <DoctorSettingsTab />
          )}
        </main>
      </div>

      {/* Standalone Clinical Chart Modal (Fallback when opened from schedule or quick links) */}
      {activeChartPetId && (
        <PatientClinicalChart
          petId={activeChartPetId}
          onClose={() => setActiveChartPetId(null)}
          onLaunchConsultation={handleStartConsultation}
        />
      )}
    </div>
  );
}
