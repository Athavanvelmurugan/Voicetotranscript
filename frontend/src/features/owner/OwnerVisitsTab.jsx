import React, { useState, useEffect } from 'react';
import {
  Calendar, Stethoscope, ChevronDown, ChevronUp, FileText,
  CheckCircle2, Clock, AlertCircle, Sparkles, ExternalLink
} from 'lucide-react';

export function OwnerVisitsTab() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function loadVisits() {
      try {
        const res = await fetch('/api/v1/owner-portal/consultations');
        const data = await res.json();
        if (data.success) {
          setVisits(data.data || []);
          if (data.data?.length > 0) {
            setExpandedId(data.data[0].id);
          }
        } else {
          setError(data.error || 'Failed to load visits.');
        }
      } catch (err) {
        setError('Network error loading visits.');
      } finally {
        setLoading(false);
      }
    }
    loadVisits();
  }, []);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="owner-tab-content">
      <div className="owner-section-header">
        <div>
          <h2 className="owner-section-title">Clinical Visit History</h2>
          <p className="owner-section-subtitle">
            Plain-language doctor directives, discharge summaries, and at-home recovery instructions.
          </p>
        </div>
      </div>

      {loading && (
        <div className="owner-state-card loading">
          <div className="verify-spinner" aria-hidden="true" />
          <p>Retrieving your visits from clinic records...</p>
        </div>
      )}

      {!loading && error && (
        <div className="auth-alert error" role="alert">
          <AlertCircle size={18} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-title">Visits Notice</span>
            <p className="auth-alert-text">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && visits.length === 0 && (
        <div className="owner-empty-card">
          <div className="owner-empty-icon-wrap" aria-hidden="true">
            <Calendar size={36} />
          </div>
          <h3 className="owner-empty-title">No past visits recorded</h3>
          <p className="owner-empty-desc">
            Your registered pets do not have any completed clinical consultations yet.
          </p>
        </div>
      )}

      {!loading && visits.length > 0 && (
        <div className="owner-visits-list">
          {visits.map((v) => {
            const isExpanded = expandedId === v.id;
            const visitDate = v.started_at
              ? new Date(v.started_at).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Recent Visit';

            const visitTime = v.started_at
              ? new Date(v.started_at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div key={v.id} className={`owner-visit-card ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="owner-visit-card-bar"
                  onClick={() => toggleExpand(v.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                >
                  <div className="owner-visit-main-info">
                    <span className="owner-visit-date">{visitDate} {visitTime && `• ${visitTime}`}</span>
                    <span className="owner-visit-pet-badge">{v.pet_name}</span>
                    <span className="owner-visit-vet">
                      <Stethoscope size={14} />
                      <span>{v.doctor_name || 'Attending Doctor'}</span>
                    </span>
                  </div>

                  <div className="owner-visit-status-right">
                    <span className={`status-pill ${v.status === 'completed' ? 'success' : 'info'}`}>
                      {v.status === 'completed' ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Finalized & Signed</span>
                        </>
                      ) : (
                        <>
                          <Clock size={13} />
                          <span className="capitalize">{v.status || 'In Progress'}</span>
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      className="icon-btn-toggle"
                      aria-label={isExpanded ? 'Collapse visit details' : 'Expand visit details'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(v.id);
                      }}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="owner-visit-details-pane">
                    {v.owner_instructions ? (
                      <div className="owner-instructions-block">
                        <div className="owner-instruction-header">
                          <FileText size={16} />
                          <h4>Guardian Care & Discharge Directives</h4>
                        </div>
                        <div className="owner-instruction-content">
                          {typeof v.owner_instructions === 'string' ? (
                            <div className="markdown-render-box">{v.owner_instructions}</div>
                          ) : (
                            <pre className="instruction-pre">
                              {JSON.stringify(v.owner_instructions, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="owner-no-directives">
                        <p>No special home care directives recorded for this visit.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
