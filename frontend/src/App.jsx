import React, { useState, useEffect, useCallback } from 'react';
import { ConsultationWorkspace } from './features/consultation/ConsultationWorkspace';
import { DirectoryPage } from './features/directory/DirectoryPage';
import { Stethoscope, Shield, Users } from 'lucide-react';
import './styles/consultation.css';

export default function App() {
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
      return parseInt(localStorage.getItem('activeDoctorId'), 10) || 1;
    } catch {
      return 1;
    }
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        setCurrentPage(params.get('page') === 'directory' ? 'directory' : 'consultation');
      } catch (_) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectActiveDoctor = useCallback((id) => {
    setActiveDoctorId(id);
    try {
      localStorage.setItem('activeDoctorId', String(id));
    } catch (_) {}
  }, []);

  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
    try {
      const storedDoctor = parseInt(localStorage.getItem('activeDoctorId'), 10);
      if (storedDoctor) setActiveDoctorId(storedDoctor);

      const url = new URL(window.location.href);
      if (page === 'directory') {
        url.searchParams.set('page', 'directory');
      } else {
        url.searchParams.delete('page');
      }
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  }, []);

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="nav-brand">
          <Stethoscope size={24} />
          <span>PetCare AI</span>
          <span className="nav-brand-badge">Veterinary Clinical Scribe</span>
        </div>

        {/* Top-Level SaaS Navigation Bar */}
        <nav className="nav-links" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-link ${currentPage === 'consultation' ? 'active' : ''}`}
            onClick={() => handleNavigate('consultation')}
            title="Live Clinical Consultation & Scribe"
          >
            <Stethoscope size={16} />
            <span>Live Consultation</span>
          </button>
          <button
            type="button"
            className={`nav-link ${currentPage === 'directory' ? 'active' : ''}`}
            onClick={() => handleNavigate('directory')}
            title="Hospital Directory Management (Doctors & Pets)"
          >
            <Users size={16} />
            <span>Directory Management</span>
          </button>
        </nav>

        <div className="nav-meta">
          {/* <span>Central Valley Animal Hospital</span> */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color="#10b981" />
            <span>Clinical Safety Guardrails Active</span>
          </div>
        </div>
      </header>

      <main>
        {currentPage === 'directory' ? (
          <DirectoryPage
            activeDoctorId={activeDoctorId}
            onSelectActiveDoctor={handleSelectActiveDoctor}
            onNavigateConsultation={() => handleNavigate('consultation')}
          />
        ) : (
          <ConsultationWorkspace />
        )}
      </main>
    </div>
  );
}


