import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Calendar, Stethoscope, Heart, Building2, Settings,
  LogOut, Sun, Moon, Menu, X, ChevronRight, ChevronLeft, ShieldCheck, Activity
} from 'lucide-react';
import { OwnerDashboardTab } from './OwnerDashboardTab';
import { OwnerAppointmentDualTab } from './OwnerAppointmentDualTab';
import { OwnerLiveConsultationTab } from './OwnerLiveConsultationTab';
import { OwnerPetsTab } from './OwnerPetsTab';
import { OwnerClinicalAffiliationTab } from './OwnerClinicalAffiliationTab';
import { OwnerSettingsTab } from './OwnerSettingsTab';
import { PublicVerifyPage } from '../verify/PublicVerifyPage';

export function OwnerPortal({ owner, onLogout }) {
  const validTabs = ['dashboard', 'appointments', 'consultation', 'pets', 'affiliation', 'settings'];

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
      return localStorage.getItem('petcare_owner_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [verifyHash, setVerifyHash] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.dataset.theme === 'dark';
  });

  // Keep URL in sync with tab and clean up invalid query params
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      let changed = false;

      // Sanitize weird pathname from legacy route redirects
      if (url.pathname !== '/') {
        url.pathname = '/';
        changed = true;
      }
      if (url.searchParams.has('page')) {
        url.searchParams.delete('page');
        changed = true;
      }
      if (url.searchParams.has('consultationId')) {
        url.searchParams.delete('consultationId');
        changed = true;
      }
      if (url.searchParams.get('portal') !== 'owner') {
        url.searchParams.set('portal', 'owner');
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
        localStorage.setItem('petcare_owner_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

  const handleTabSelect = (tabKey) => {
    setActiveTab(tabKey);
    setMobileSidebarOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('portal', 'owner');
      url.searchParams.set('tab', tabKey);
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  };

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'appointments', label: 'Appointments & Booking', icon: Calendar },
    { key: 'consultation', label: 'Live Consultation', icon: Stethoscope },
    { key: 'pets', label: 'Pet Detail', icon: Heart },
    { key: 'affiliation', label: 'Clinical Affiliation', icon: Building2 },
    { key: 'settings', label: 'Setting', icon: Settings },
  ];

  const pageHeaders = {
    dashboard: { title: 'Guardian Overview', subtitle: 'Trends cards, active animal companions, and quick clinical launchers.' },
    appointments: { title: 'Appointment Booking & Confirmed Roster', subtitle: 'Book doctor-confirmed consultation slots and review upcoming visits.' },
    consultation: { title: 'Live Consultation & Ambient Notes', subtitle: 'Real-time consultation meeting details and past visit history.' },
    pets: { title: 'Animal Companion Details', subtitle: 'Vitals, critical allergy warnings, microchip records, and health profiles.' },
    affiliation: { title: 'Hospital & Doctor Affiliation', subtitle: 'Connect to accredited veterinary clinics, choose attending clinician, and manage consent.' },
    settings: { title: 'Guardian & Pet Settings', subtitle: 'Edit and save contact details, pet body weights, and notification channels.' },
  };

  if (verifyHash) {
    return (
      <PublicVerifyPage
        initialHash={verifyHash}
        onBackToApp={() => setVerifyHash(null)}
      />
    );
  }

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

      {/* Left Vertical Guardian Sidebar */}
      <aside className={`admin-vertical-sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar Brand Header */}
        <div className="sidebar-brand-section">
          <div className="sidebar-brand-top">
            <div className="admin-clinic-icon-badge" title="PetPulse Guardian Portal">
              <Heart size={20} aria-hidden="true" />
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-brand-text">
                <h2 className="sidebar-clinic-name">PetPulse</h2>
                <div className="sidebar-practice-pill">
                  <span className="live-dot" aria-hidden="true" />
                  <span>Pet Owner Portal</span>
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
        <nav className="sidebar-nav-container" aria-label="Pet Guardian Navigation">
          <div className="sidebar-nav-group">
            {!isSidebarCollapsed && (
              <span className="sidebar-group-heading">Guardian Care Navigation</span>
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

        {/* Sidebar Footer: Guardian Profile */}
        <div className="sidebar-footer-section">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar" title={owner?.name || 'Pet Guardian'}>
              <span>{(owner?.name || 'G')[0].toUpperCase()}</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{owner?.name || 'Pet Guardian'}</span>
                <span className="sidebar-user-role">Verified Guardian</span>
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
                onClick={onLogout}
                title="Sign Out of Guardian Portal"
                aria-label="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
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
              <span className="breadcrumb-root">Pet Owner Portal</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{pageHeaders[activeTab]?.title || 'Overview'}</span>
            </div>
          </div>

          <div className="admin-top-right">
            <span className="doctor-topbar-status-badge">
              <ShieldCheck size={13} aria-hidden="true" />
              <span>Verified Guardian Access</span>
            </span>
          </div>
        </header>

        {/* Content Pane */}
        <main className="admin-content-viewport" role="main">
          {activeTab === 'dashboard' && (
            <OwnerDashboardTab
              owner={owner}
              onNavigateTab={handleTabSelect}
            />
          )}

          {activeTab === 'appointments' && (
            <OwnerAppointmentDualTab
              owner={owner}
              onNavigateTab={handleTabSelect}
            />
          )}

          {activeTab === 'consultation' && (
            <OwnerLiveConsultationTab
              owner={owner}
              onOpenVerifyModal={(hash) => setVerifyHash(hash)}
            />
          )}

          {activeTab === 'pets' && (
            <OwnerPetsTab />
          )}

          {activeTab === 'affiliation' && (
            <OwnerClinicalAffiliationTab
              owner={owner}
            />
          )}

          {activeTab === 'settings' && (
            <OwnerSettingsTab />
          )}
        </main>
      </div>
    </div>
  );
}
