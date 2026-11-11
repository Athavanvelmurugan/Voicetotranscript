import React from 'react';
import {
  ShieldCheck, Wifi, WifiOff, Stethoscope, Calendar, Plus,
  Trash2, User, CheckCircle
} from 'lucide-react';

export function ConsultationHeader({
  consultation,
  consultations = [],
  onSelectConsultation,
  onOpenNewConsultationModal,
  doctors = [],
  activeDoctorId,
  onSelectActiveDoctor,
  onDeleteConsultation,
  onCompleteConsultation,
  connectionStatus,
}) {
  // ─── Persistent Setup Bar when No Consultation is Selected / Loading ────────
  if (!consultation) {
    return (
      <div className="consultation-header">
        <div className="consultation-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="badge badge-purple" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              <Stethoscope size={15} />
              <span>Attending: {doctors.find((d) => d.id === activeDoctorId)?.name || 'Dr. Attending DVM'}</span>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              No active consultation selected. Start a consultation or select a patient.
            </div>
          </div>

          <div className="header-actions-group">
            <button
              className="btn btn-primary"
              onClick={onOpenNewConsultationModal}
            >
              <Plus size={14} /> New Consultation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Consultation Session Bar (Executive 2-Tier Architecture) ─────────
  return (
    <header className="consultation-header">
      {/* Deck 1: Patient Identity & Primary Action Toolbar */}
      <div className="consultation-header-top">
        <div className="pet-profile">
          <div className="pet-avatar" title={consultation.pet_species}>
            {consultation.pet_name?.charAt(0) || 'P'}
          </div>
          <div className="pet-details">
            <h1>
              <span>{consultation.pet_name}</span>
              <span className="badge badge-info" style={{ marginLeft: '4px' }}>
                {consultation.pet_species}
              </span>
            </h1>
            <div className="pet-sub">
              <span>{consultation.pet_breed || 'Mixed Breed'}</span>
              <span>•</span>
              <span>{consultation.pet_age ? `${consultation.pet_age} yrs` : 'Age N/A'}</span>
              <span>•</span>
              <span>{consultation.pet_weight ? `${consultation.pet_weight} kg` : 'Weight N/A'}</span>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          {/* Dynamic Consultation Switcher Dropdown */}
          {consultations.length > 0 && (
            <select
              className="form-control"
              style={{
                fontWeight: 600,
                fontSize: '0.82rem',
                padding: '6px 10px',
                background: '#f8fafc',
                cursor: 'pointer',
                minWidth: '200px',
              }}
              value={consultation.id}
              onChange={(e) => onSelectConsultation && onSelectConsultation(parseInt(e.target.value, 10))}
              title="Switch active consultation"
            >
              {consultations.map((c) => (
                <option key={c.id} value={c.id}>
                  Consultation #{c.id}: {c.pet_name} ({c.status})
                </option>
              ))}
            </select>
          )}

          {/* + New Consultation Button */}
          <button
            className="btn btn-primary"
            onClick={onOpenNewConsultationModal}
            title="Create a new dynamic consultation"
          >
            <Plus size={14} /> New Consultation
          </button>

          {/* Complete Consultation Button */}
          {consultation.status !== 'completed' && onCompleteConsultation && (
            <button
              className="btn btn-primary"
              style={{
                background: '#059669',
                borderColor: '#059669',
                color: '#ffffff',
              }}
              onClick={() => onCompleteConsultation(consultation.id)}
              title="Finalize and lock this clinical consultation"
            >
              <CheckCircle size={14} /> Complete Consultation
            </button>
          )}

          {/* Delete current consultation button */}
          {onDeleteConsultation && (
            <button
              className="btn btn-outline"
              style={{ padding: '6px 9px', color: '#e11d48', borderColor: '#fecdd3' }}
              onClick={() => onDeleteConsultation(consultation.id)}
              title="Delete this consultation session"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Deck 2: Clinical Vitals & Status Meta-strip */}
      <div className="consultation-header-bottom">
        <div className="header-vitals-strip">
          <div className="vital-item">
            <span>Owner:</span>
            <strong style={{ color: '#0f172a' }}>{consultation.owner_name || 'Pet Owner'}</strong>
            {consultation.owner_contact && <span style={{ color: '#64748b' }}>({consultation.owner_contact})</span>}
          </div>
          <span className="vital-divider" />
          <div className="vital-item">
            <span>Species:</span>
            <strong>{consultation.pet_species || 'Canine'}</strong>
          </div>
        </div>

        <div className="header-badges">
          {/* Attending Doctor Badge */}
          <div className="badge badge-purple" title="Attending Veterinarian">
            <Stethoscope size={13} />
            <span>{consultation?.doctor_name || (doctors.find((d) => d.id === activeDoctorId)?.name) || 'Attending DVM'}</span>
          </div>

          {/* Pet Owner Badge */}
          <div className="badge badge-info" title="Pet Owner">
            <User size={13} />
            <span>Owner: <strong>{consultation.owner_name || 'Pet Owner'}</strong></span>
          </div>

          {/* Appointment ID Badge */}
          <div className="badge badge-info" title="Clinical Appointment ID">
            <Calendar size={13} />
            <span>Appt #{consultation.appointment_id || consultation.id}</span>
          </div>

          {/* Digital Consent Badge */}
          {consultation.consent_given ? (
            <div className="badge badge-success" title={`Consent granted by ${consultation.owner_name || 'Owner'}`}>
              <ShieldCheck size={13} />
              <span>Consent Signed ({consultation.owner_name?.split(' ')[0] || 'Owner'})</span>
            </div>
          ) : (
            <div className="badge badge-warning" title={`Consent pending from ${consultation.owner_name || 'Owner'}`}>
              <span>Consent Pending</span>
            </div>
          )}

          {/* WebSocket Live Badge */}
          <div className={`badge ${connectionStatus === 'connected' ? 'badge-success' : 'badge-danger'}`} title="Live WebSocket Data Streaming">
            {connectionStatus === 'connected' ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{connectionStatus === 'connected' ? 'WS Live' : connectionStatus}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
