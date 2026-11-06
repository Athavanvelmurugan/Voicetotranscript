import React from 'react';
import { ConsultationWorkspace } from './features/consultation/ConsultationWorkspace';
import { Stethoscope, Shield } from 'lucide-react';
import './styles/consultation.css';

export default function App() {
  return (
    <div className="app-container">
      <header className="navbar">
        <div className="nav-brand">
          <Stethoscope size={24} />
          <span>PetCare AI</span>
          <span className="nav-brand-badge">Veterinary Clinical Scribe</span>
        </div>
        <div className="nav-meta">
          <span>Central Valley Animal Hospital</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color="#10b981" />
            <span>Clinical Safety Guardrails Active</span>
          </div>
        </div>
      </header>

      <main>
        <ConsultationWorkspace />
      </main>
    </div>
  );
}

