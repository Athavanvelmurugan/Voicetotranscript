import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Building2, Users, Heart, ShieldCheck, TrendingUp,
  Server, CheckCircle2, AlertCircle, RefreshCw, Plus, Search,
  Calendar, Lock, LogOut, Sun, Moon, ArrowRight, X, ChevronRight,
  ChevronLeft, Menu, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiClient } from '../../api/client';
import { SuperAdminDashboardTab } from './SuperAdminDashboardTab';
import { SuperAdminHospitalListTab } from './SuperAdminHospitalListTab';
import { SuperAdminHospitalAddTab } from './SuperAdminHospitalAddTab';
import { SuperAdminAuditLogTab } from './SuperAdminAuditLogTab';

export function SuperAdminPortal() {
  const { user, logout } = useAuth();
  const validTabs = ['dashboard', 'hospitals', 'add-hospital', 'audit'];

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
      return localStorage.getItem('petcare_superadmin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.dataset.theme === 'dark';
  });

  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  // Synchronize URL with active tab
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('portal') !== 'super-admin') {
        url.searchParams.set('portal', 'super-admin');
      }
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
      }
      window.history.replaceState({}, '', url.toString());
    } catch (_) {}
  }, [activeTab]);

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
        localStorage.setItem('petcare_superadmin_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

  const handleTabSelect = (tabKey) => {
    setActiveTab(tabKey);
    setMobileSidebarOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('portal', 'super-admin');
      url.searchParams.set('tab', tabKey);
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  };

  const loadTrends = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/api/v1/super-admin/trends');
      const data = await res.json();
      if (data.success) {
        setTrends(data.data);
      }
    } catch (err) {
      console.error('[SuperAdminPortal] Error loading trends:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const navItems = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'System-wide trends, KPIs & platform telemetry'
    },
    {
      key: 'hospitals',
      label: 'Hospital List',
      icon: Building2,
      description: 'Accredited veterinary hospitals, doctor & patient rosters'
    },
    {
      key: 'add-hospital',
      label: 'Hospital Add',
      icon: Plus,
      description: 'Onboard new hospital tenant with administrator credentials'
    },
    {
      key: 'audit',
      label: 'Audit Log',
      icon: ShieldCheck,
      description: 'Cryptographic system audit trail and compliance verification'
    },
  ];

  const pageHeaders = {
    dashboard: {
      title: 'Platform Control Plane & Telemetry',
      subtitle: 'Real-time multi-tenant health, global consultation volume, and microservice status.',
    },
    hospitals: {
      title: 'Hospital Directory & Tenant Governance',
      subtitle: 'Accredited practices, attending clinician lists, and enrolled patient demographics.',
    },
    'add-hospital': {
      title: 'Hospital Onboarding & Provisioning',
      subtitle: 'Provision new veterinary hospital tenant and initial practice administrator master account.',
    },
    audit: {
      title: 'Platform System Audit & Cryptographic Ledger',
      subtitle: 'Immutable cross-tenant event trail with SHA-256 hash-chaining verification.',
    },
  };

  return (
    <div className="admin-portal-wrapper">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Vertical Navigation Sidebar */}
      <aside className={`admin-vertical-sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand-section">
          <div className="sidebar-brand-top">
            <div className="admin-clinic-icon-badge" title="PetPulse Platform Control Plane">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-brand-text">
                <h2 className="sidebar-clinic-name">PetPulse Network</h2>
                <div className="sidebar-practice-pill">
                  <span className="live-dot" aria-hidden="true" />
                  <span>Super Admin Plane</span>
                </div>
              </div>
            )}
            <button
              type="button"
              className="sidebar-collapse-toggle-btn"
              onClick={toggleSidebarCollapse}
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label={isSidebarCollapsed ? 'Expand Sidebar Navigation' : 'Collapse Sidebar Navigation'}
            >
              {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
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

        {/* Navigation Items */}
        <nav className="sidebar-nav-container" aria-label="Platform Governance Navigation">
          <div className="sidebar-nav-group">
            {!isSidebarCollapsed && (
              <span className="sidebar-group-heading">Platform Governance</span>
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

        {/* Footer */}
        <div className="sidebar-footer-section">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar" title={user?.name || 'Platform Operator'}>
              <span>{(user?.name || 'S')[0].toUpperCase()}</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name || 'Platform Operator'}</span>
                <span className="sidebar-user-role">Super Administrator</span>
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
                title="Sign Out of Platform Plane"
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
              <span className="breadcrumb-root">Super Admin</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{pageHeaders[activeTab]?.title}</span>
            </div>
          </div>

          <div className="admin-top-right">
            <span className="doctor-topbar-status-badge">
              <Activity size={13} aria-hidden="true" />
              <span>Multi-Tenant Cluster Active</span>
            </span>
          </div>
        </header>

        <main className="admin-content-viewport" role="main">
          {activeTab === 'dashboard' && (
            <SuperAdminDashboardTab
              trends={trends}
              onRefresh={loadTrends}
              loading={loading}
              onNavigateTab={handleTabSelect}
            />
          )}

          {activeTab === 'hospitals' && (
            <SuperAdminHospitalListTab
              onNavigateAddHospital={() => handleTabSelect('add-hospital')}
            />
          )}

          {activeTab === 'add-hospital' && (
            <SuperAdminHospitalAddTab
              onHospitalCreated={() => handleTabSelect('hospitals')}
            />
          )}

          {activeTab === 'audit' && (
            <SuperAdminAuditLogTab />
          )}
        </main>
      </div>
    </div>
  );
}
