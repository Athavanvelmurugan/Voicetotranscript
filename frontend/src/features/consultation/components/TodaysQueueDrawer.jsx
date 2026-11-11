import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, AlertTriangle, Play, CheckCircle2, ChevronRight, X, RefreshCw } from 'lucide-react';

export function TodaysQueueDrawer({
  isOpen,
  onClose,
  onSelectAppointment,
  currentConsultationId,
}) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/scheduling/today-queue');
      const data = await res.json();
      if (data.success) {
        setQueue(data.data);
      } else {
        setError(data.error || 'Failed to load today queue');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchQueue();
    }
  }, [isOpen, fetchQueue]);

  if (!isOpen) return null;

  return (
    <div className="queue-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="queue-drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="queue-drawer-header">
          <div className="queue-title-wrap">
            <Calendar size={20} className="queue-icon" aria-hidden="true" />
            <h3>Today&apos;s Patient Queue</h3>
            <span className="queue-count-badge">{queue.length}</span>
          </div>
          <div className="queue-header-actions">
            <button
              type="button"
              className="queue-refresh-btn"
              onClick={fetchQueue}
              disabled={loading}
              title="Refresh Queue"
              aria-label="Refresh Queue"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <button
              type="button"
              className="queue-close-btn"
              onClick={onClose}
              aria-label="Close Queue Drawer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="queue-drawer-body">
          {loading && queue.length === 0 && (
            <div className="queue-loading">
              <RefreshCw size={24} className="spin" />
              <span>Loading today&apos;s appointments...</span>
            </div>
          )}

          {error && (
            <div className="queue-error" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {!loading && queue.length === 0 && (
            <div className="queue-empty">
              <p>No appointments scheduled for today.</p>
            </div>
          )}

          <div className="queue-cards-list">
            {queue.map((item) => {
              const timeStr = new Date(item.scheduled_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const allergies = Array.isArray(item.pet_allergies)
                ? item.pet_allergies
                : (typeof item.pet_allergies === 'string' && item.pet_allergies.startsWith('[')
                  ? JSON.parse(item.pet_allergies)
                  : []);

              const isCurrent = item.active_consultation_id === currentConsultationId;

              return (
                <div
                  key={item.id}
                  className={`queue-card ${isCurrent ? 'queue-card-active' : ''}`}
                >
                  <div className="queue-card-time">
                    <Clock size={14} aria-hidden="true" />
                    <span>{timeStr}</span>
                    <span className="queue-duration">{item.duration_min || 15}m</span>
                  </div>

                  <div className="queue-card-main">
                    <div className="queue-card-pet-header">
                      <h4 className="queue-pet-name">{item.pet_name}</h4>
                      <span className="queue-type-badge">{item.type.replace('_', ' ')}</span>
                    </div>

                    <div className="queue-card-details">
                      <span>{item.pet_species} • {item.pet_breed || 'Mixed'}</span>
                      {item.owner_name && (
                        <span className="queue-owner">Owner: {item.owner_name} ({item.owner_phone || 'No phone'})</span>
                      )}
                    </div>

                    {item.reason && (
                      <p className="queue-reason">&quot;{item.reason}&quot;</p>
                    )}

                    {allergies.length > 0 && (
                      <div className="queue-allergy-pills">
                        <AlertTriangle size={13} className="allergy-warn-icon" aria-hidden="true" />
                        {allergies.map((a, i) => (
                          <span key={i} className="queue-allergy-tag">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="queue-card-action">
                    <button
                      type="button"
                      className="queue-start-btn"
                      onClick={() => onSelectAppointment(item)}
                      title="Open Consultation for this appointment"
                    >
                      <Play size={14} />
                      <span>{item.active_consultation_id ? 'Resume' : 'Start'}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

