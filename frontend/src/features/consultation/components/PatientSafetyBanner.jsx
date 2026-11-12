import React from 'react';
import { AlertTriangle, ShieldCheck, HeartPulse, Tag } from 'lucide-react';

export function PatientSafetyBanner({
  petName = 'Patient',
  species = '',
  breed = '',
  allergies = [],
  chronicConditions = [],
  microchipNo = null,
  weightKg = null,
  ageYears = null,
  compact = false,
}) {
  // Normalize arrays if stored as JSON strings
  const parsedAllergies = Array.isArray(allergies)
    ? allergies
    : (typeof allergies === 'string' && allergies.startsWith('[') ? JSON.parse(allergies) : (allergies ? [allergies] : []));

  const parsedConditions = Array.isArray(chronicConditions)
    ? chronicConditions
    : (typeof chronicConditions === 'string' && chronicConditions.startsWith('[') ? JSON.parse(chronicConditions) : (chronicConditions ? [chronicConditions] : []));

  const hasAllergies = parsedAllergies.length > 0;
  const hasConditions = parsedConditions.length > 0;
  const isHighRisk = hasAllergies || hasConditions;
  const showLeftMeta = !compact || Boolean(microchipNo);

  return (
    <div
      className={`patient-safety-banner ${isHighRisk ? 'safety-high-risk' : 'safety-standard'} ${compact ? 'patient-safety-banner--compact' : ''}`}
      role="region"
      aria-label="Patient Clinical Safety Banner"
    >
      {showLeftMeta && (
        <div className="safety-left">
          <div className="safety-pet-meta">
            {!compact && (
              <>
                <span className="safety-pet-name">{petName}</span>
                {(species || breed) && (
                  <span className="safety-pet-sub">
                    {[species, breed].filter(Boolean).join(' • ')}
                  </span>
                )}
                {weightKg && <span className="safety-badge-info">{weightKg} kg</span>}
                {ageYears && <span className="safety-badge-info">{ageYears} yrs</span>}
              </>
            )}
            {microchipNo && (
              <span className="safety-badge-chip">
                <Tag size={12} aria-hidden="true" />
                <span>Chip #{microchipNo}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="safety-alerts">
        {hasAllergies && (
          <div className="safety-alert-group allergy-alert" role="alert">
            <span className="safety-alert-label">
              <AlertTriangle size={15} aria-hidden="true" />
              <strong>CRITICAL ALLERGIES:</strong>
            </span>
            <div className="safety-tag-list">
              {parsedAllergies.map((allergy, idx) => (
                <span key={idx} className="safety-pill safety-pill-danger">
                  {allergy}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasConditions && (
          <div className="safety-alert-group condition-alert">
            <span className="safety-alert-label">
              <HeartPulse size={15} aria-hidden="true" />
              <strong>CHRONIC CONDITIONS:</strong>
            </span>
            <div className="safety-tag-list">
              {parsedConditions.map((condition, idx) => (
                <span key={idx} className="safety-pill safety-pill-warning">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        )}

        {!hasAllergies && !hasConditions && (
          <div className="safety-clear">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>No known allergies or chronic conditions on file.</span>
          </div>
        )}
      </div>
    </div>
  );
}

