import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPage } from './auth/AuthPage';
import { LoginPage } from './auth/LoginPage';
import { SignupClinicPage } from './auth/SignupClinicPage';
import { AcceptInvitePage } from './auth/AcceptInvitePage';
import { ConsultationWorkspace } from './features/consultation/ConsultationWorkspace';
import { DoctorPortal } from './features/doctor/DoctorPortal';
import { AdminPortal } from './features/admin/AdminPortal';
import { SuperAdminPortal } from './features/super-admin/SuperAdminPortal';
import { OwnerPortal } from './features/owner/OwnerPortal';
import { OwnerAuthModal } from './features/owner/OwnerAuthModal';
import { PublicVerifyPage } from './features/verify/PublicVerifyPage';
import { Stethoscope, HeartPulse, Shield, Users, LogOut, Building, User, Building2, Heart } from 'lucide-react';
import './styles/theme.css';
import './styles/consultation.css';
import './styles/auth.css';
import './styles/admin.css';
import './styles/doctor.css';
import './styles/owner.css';

function AppContent() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  // Navigation state
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [inviteToken, setInviteToken] = useState(() => {
    try {
      const pathMatch = window.location.pathname.match(/^\/invite\/([a-zA-Z0-9]+)$/);
      if (pathMatch) return pathMatch[1];
      const params = new URLSearchParams(window.location.search);
      return params.get('inviteToken') || null;
    } catch {
      return null;
    }
  });

  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('page') === 'directory' ? 'directory' : 'consultation';
    } catch {
      return 'consultation';
    }
  });

  const [activeDoctorId, setActiveDoctorId] = useState(() => {
    try {
      const stored = localStorage.getItem('activeDoctorId');
      return stored ? parseInt(stored, 10) : (user?.id || 1);
    } catch {
      return user?.id || 1;
    }
  });

  const handleSelectActiveDoctor = useCallback((id) => {
    const docId = parseInt(id, 10);
    setActiveDoctorId(docId);
    try {
      localStorage.setItem('activeDoctorId', String(docId));
    } catch (_) {}
  }, []);

  // Explicit Consumer (Pet Guardian) Portal Mode
  const [isOwnerPortalMode, setIsOwnerPortalMode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('portal') === 'owner';
    } catch {
      return false;
    }
  });

  const [ownerSession, setOwnerSession] = useState(() => {
    try {
      const stored = localStorage.getItem('petcare_owner_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      try {
        const pathMatch = window.location.pathname.match(/^\/invite\/([a-zA-Z0-9]+)$/);
        if (pathMatch) {
          setInviteToken(pathMatch[1]);
          return;
        }
        const params = new URLSearchParams(window.location.search);
        setIsOwnerPortalMode(params.get('portal') === 'owner');
        if (params.get('page') === 'directory') {
          setCurrentPage('directory');
        } else {
          setCurrentPage('consultation');
        }
      } catch (_) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('portal');
      url.searchParams.delete('tab');
      if (page === 'directory') {
        url.searchParams.set('page', 'directory');
      } else {
        url.searchParams.delete('page');
      }
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  }, []);

  // 0. Public Cryptographic Verification Seal (No auth required)
  const isVerifyPage = (() => {
    try {
      const path = window.location.pathname;
      if (path.startsWith('/verify')) return true;
      const params = new URLSearchParams(window.location.search);
      return params.has('verify') || params.has('ledgerHash');
    } catch {
      return false;
    }
  })();

  if (isVerifyPage) {
    return (
      <PublicVerifyPage
        onBackToApp={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // 1. PET OWNER / GUARDIAN PORTAL (Consumer Realm)
  if (isOwnerPortalMode) {
    if (ownerSession) {
      return (
        <OwnerPortal
          owner={ownerSession}
          onLogout={() => {
            fetch('/api/v1/owner-auth/logout', { method: 'POST' }).catch(() => {});
            localStorage.removeItem('petcare_owner_session');
            setOwnerSession(null);
          }}
        />
      );
    }
    return (
      <OwnerAuthModal
        onLoginSuccess={(owner) => {
          setOwnerSession(owner);
        }}
        onCancel={() => {
          setIsOwnerPortalMode(false);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('portal');
            window.history.pushState({}, '', url.toString());
          } catch (_) {}
        }}
      />
    );
  }

  // 2. Session Loading Splash
  if (loading) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card auth-card-center">
          <div className="auth-splash-logo-wrap">
            <img src="/petpulse-logo.png" alt="PetPulse Logo" className="auth-splash-logo" />
          </div>
          <h2 className="auth-title">PetPulse</h2>
          <p className="auth-subtitle">Every heartbeat, every record.</p>
        </div>
      </div>
    );
  }

  // 3. Invitation Acceptance Page
  if (inviteToken && !isAuthenticated) {
    return (
      <AcceptInvitePage
        inviteToken={inviteToken}
        onNavigateLogin={() => {
          setInviteToken(null);
          setAuthView('login');
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // 4. Unauthenticated Staff Views (Login / Register Clinic)
  if (!isAuthenticated) {
    return (
      <AuthPage
        initialView={authView}
        onViewChange={(view) => setAuthView(view)}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STRICT ROLE-BASED PORTAL ROUTING (Zero cross-portal switching)
  // ════════════════════════════════════════════════════════════════════════════

  // PORTAL 1: SUPER ADMIN CONTROL PLANE
  if (user?.role === 'super_admin') {
    return <SuperAdminPortal />;
  }

  // PORTAL 2: CLINIC / HOSPITAL ADMIN PORTAL
  if (user?.role === 'clinic_admin') {
    return <AdminPortal />;
  }

  // PORTAL 3: DOCTOR / CLINICAL PRACTITIONER PORTAL
  return <DoctorPortal />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
