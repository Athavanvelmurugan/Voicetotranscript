import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, UserPlus, Calendar, Settings,
  ShieldCheck, Stethoscope, LogOut, Building2, Sun, Moon,
  Menu, X, ChevronRight, ChevronLeft, Activity
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { DashboardTab } from './DashboardTab';
import { DoctorOnboardingTab } from './DoctorOnboardingTab';
import { JoinRequestsTab } from './JoinRequestsTab';
import { StaffManagementTab } from './StaffManagementTab';
import { ClinicSettingsTab } from './ClinicSettingsTab';
import { AuditLogsTab } from './AuditLogsTab';

export function AdminPortal() {
  const { user, logout } = useAuth();
  const validTabs = ['dashboard', 'onboarding', 'join-requests', 'staff', 'audit', 'settings'];

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
      return localStorage.getItem('petcare_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.dataset.theme === 'dark';
  });

  // Ensure URL is synchronized with admin portal mode
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has('consultationId')) {
        url.searchParams.delete('consultationId');
        changed = true;
      }
      if (url.searchParams.get('portal') !== 'admin') {
        url.searchParams.set('portal', 'admin');
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

  // Handle browser back/forward buttons within Admin Portal
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
        localStorage.setItem('petcare_admin_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

  const handleTabSelect = (tabKey) => {
    setActiveTab(tabKey);
    setMobileSidebarOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('portal', 'admin');
      url.searchParams.set('tab', tabKey);
      url.searchParams.delete('consultationId');
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  };

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'onboarding', label: 'Doctor Register', icon: UserPlus },
    { key: 'join-requests', label: 'Join Requests', icon: Stethoscope },
    { key: 'staff', label: 'Doctor List', icon: Users },
    { key: 'audit', label: 'Audit Log', icon: ShieldCheck },
    { key: 'settings', label: 'Setting', icon: Settings },
  ];

  const pageTitles = {
    dashboard: { title: 'Practice Overview', subtitle: 'Real-time clinic metrics, operational status, and security compliance.' },
    onboarding: { title: 'Doctor Register', subtitle: 'Direct clinician registration, medical license provisioning, and credentials.' },
    'join-requests': { title: 'Doctor Join Requests & Invitations', subtitle: 'Approve independent or hospital-affiliated doctor join requests and send invitations.' },
    staff: { title: 'Doctor Directory & Patients', subtitle: 'Manage clinical team, licenses, and view patient lists with privacy compliance.' },
    audit: { title: 'Audit & Compliance Logs', subtitle: 'Hospital operational event trail tracking clinic admin, doctor, and pet owner actions.' },
    settings: { title: 'Hospital & Practice Configuration', subtitle: 'Scheduling buffers, clinical audio retention policies, and branding.' },
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

      {/* Vertical Left Sidebar */}
      <aside className={`admin-vertical-sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar Brand Header */}
        <div className="sidebar-brand-section">
          <div className="sidebar-brand-top">
            <div className="admin-clinic-icon-badge">
              <Building2 size={22} aria-hidden="true" />
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-brand-text">
                <h2 className="sidebar-clinic-name">
                  {user?.clinicName || 'Central Valley Animal Hospital'}
                </h2>
                <div className="sidebar-practice-pill">
                  <span className="live-dot" aria-hidden="true" />
                  <span>Hospital Admin</span>
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

        {/* Sidebar Navigation Items */}
        <nav className="sidebar-nav-container" aria-label="Hospital Administrative Navigation">
          <div className="sidebar-nav-group">
            {!isSidebarCollapsed && (
              <span className="sidebar-group-heading">Hospital Administration</span>
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

        {/* Sidebar Footer: Practice Admin Profile */}
        <div className="sidebar-footer-section">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              <span>{(user?.name || 'A')[0].toUpperCase()}</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name || 'Administrator'}</span>
                <span className="sidebar-user-role">{user?.role || 'clinic_admin'}</span>
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
                title="Sign Out of Practice"
                aria-label="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Administrative Work Area */}
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
              <span className="breadcrumb-root">Hospital Admin</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{pageTitles[activeTab]?.title || 'Overview'}</span>
            </div>
          </div>

          <div className="admin-top-right">
            <span className="doctor-topbar-status-badge">
              <Activity size={13} aria-hidden="true" />
              <span>Hospital Live</span>
            </span>
          </div>
        </header>

        {/* Content Pane */}
        <main className="admin-content-viewport" role="main">
          {activeTab === 'dashboard' && <DashboardTab onNavigateTab={handleTabSelect} />}
          {activeTab === 'onboarding' && <DoctorOnboardingTab onNavigateTab={handleTabSelect} />}
          {activeTab === 'join-requests' && <JoinRequestsTab />}
          {activeTab === 'staff' && <StaffManagementTab onNavigateTab={handleTabSelect} />}
          {activeTab === 'audit' && <AuditLogsTab />}
          {activeTab === 'settings' && <ClinicSettingsTab />}
        </main>
      </div>
    </div>
  );
}
