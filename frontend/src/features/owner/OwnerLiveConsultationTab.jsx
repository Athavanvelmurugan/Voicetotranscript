import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, Calendar, Clock, FileText, CheckCircle2,
  AlertCircle, ShieldCheck, Search, Filter, RefreshCw
} from 'lucide-react';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';
import { ownerFetch } from '../../api/ownerClient';

export function OwnerLiveConsultationTab({ owner, onOpenVerifyModal }) {
  const [consultations, setConsultations] = useState([]);
  const [todayConsultation, setTodayConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search, Date Filter & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ownerFetch('/api/v1/owner-portal/consultations');
      const d = await res.json();
      if (d.success) {
        const list = d.data || [];
        setConsultations(list);

        // Find today's consultation if any
        const todayStr = new Date().toISOString().split('T')[0];
        const match = list.find((c) => {
          const raw = c.started_at || c.created_at;
          if (!raw) return false;
          try {
            const d = new Date(raw);
            if (isNaN(d.getTime())) return false;
            return d.toISOString().split('T')[0] === todayStr;
          } catch {
            return false;
          }
        });
        setTodayConsultation(match || null);
      } else {
        setError(d.error || 'Failed to load consultation records.');
      }
    } catch (err) {
      setError(err.message || 'Error loading clinical consultations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  // Client-side filtering across list
  const filteredList = consultations.filter((c) => {
    if (dateFilter) {
      const cDate = new Date(c.created_at).toISOString().split('T')[0];
      if (cDate !== dateFilter) return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const petMatch = (c.pet_name || '').toLowerCase().includes(term);
      const docMatch = (c.doctor_name || '').toLowerCase().includes(term);
      const sumMatch = (c.clinical_summary || '').toLowerCase().includes(term);
      if (!petMatch && !docMatch && !sumMatch) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredList.length / limit) || 1;
  const paginatedItems = filteredList.slice((page - 1) * limit, page * limit);

  return (
    <div className="owner-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Live Consultation &amp; Clinical Records</h3>
          <p>
            Real-time meeting ambient consultation updates, past visit summaries, and verified veterinary SOAP notes.
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={fetchConsultations}
          disabled={loading}
          title="Refresh Consultations"
        >
          <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* TODAY'S LIVE CONSULTATION CARD */}
      {todayConsultation ? (
        <div className="admin-card" style={{ marginBottom: 'var(--space-6)', border: '1px solid var(--color-primary-border)' }}>
          <div className="admin-card-header" style={{ background: 'var(--color-primary-soft)' }}>
            <div>
              <div className="hero-status-pill" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                <span className="live-dot" style={{ background: '#fff' }} aria-hidden="true" />
                <span>Today's Consultation Meeting Active</span>
              </div>
              <h3 className="admin-card-title" style={{ marginTop: 'var(--space-2)' }}>
                {todayConsultation.pet_name} with {todayConsultation.doctor_name || 'Attending DVM'}
              </h3>
              <p className="admin-card-subtitle">
                {new Date(todayConsultation.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {todayConsultation.clinic_name || 'Veterinary Hospital'}
              </p>
            </div>
            <span className="admin-badge badge-active">Consultation Open</span>
          </div>

          <div className="admin-card-body">
            <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-sm)' }}>Ambient AI Scribe Summary</h4>
            <p className="admin-meta-sub" style={{ lineHeight: '1.6', color: 'var(--color-text)' }}>
              {todayConsultation.clinical_summary || 'Encounter in progress. Ambient clinical notes will update in real time upon doctor approval.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="admin-card" style={{ borderStyle: 'dashed' }}>
          <div className="admin-card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5)' }}>
            <div className="admin-stat-icon icon-blue">
              <Stethoscope size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                No Active Live Consultation Today
              </h4>
              <p className="admin-meta-sub" style={{ margin: 'var(--space-1) 0 0 0' }}>
                When you have an appointment scheduled for today, real-time consultation updates, ambient AI scribe summaries, and prescription drafts will stream here automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PAST CONSULTATIONS / VISIT HISTORY */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Past Consultation History</h3>
            <p className="admin-card-subtitle">Filter by encounter date or search by symptoms and clinician.</p>
          </div>
          <span className="admin-badge badge-neutral">
            {filteredList.length} {filteredList.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        <div className="admin-card-body">
          {/* Universal Search & Date Filter Bar */}
          <div className="doctor-filter-bar" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="doctor-search-box">
              <Search size={18} className="doctor-search-icon" />
              <input
                type="search"
                className="doctor-search-input"
                placeholder="Search summaries, doctor, or pet name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                type="date"
                className="schedule-date-input"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
                title="Filter by Visit Date"
              />
              {dateFilter && (
                <button
                  type="button"
                  className="admin-btn admin-btn-outline admin-btn-sm"
                  onClick={() => {
                    setDateFilter('');
                    setPage(1);
                  }}
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {loading && consultations.length === 0 ? (
            <p className="table-empty-message">Loading past consultations...</p>
          ) : paginatedItems.length === 0 ? (
            <div className="doctor-empty-state">
              <Calendar size={28} />
              <h4>No consultation records found</h4>
              <p>Try clearing your search filter or date filter to see earlier visits.</p>
            </div>
          ) : (
            <div className="owner-consultation-cards-stack">
              {paginatedItems.map((c) => (
                <div key={c.id} className="owner-consultation-card" style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                        {c.pet_name} — {(() => {
                          const raw = c.started_at || c.created_at;
                          if (!raw) return 'Clinical Visit';
                          try {
                            const d = new Date(raw);
                            return isNaN(d.getTime()) ? 'Clinical Visit' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                          } catch {
                            return 'Clinical Visit';
                          }
                        })()}
                      </h4>
                      <span className="admin-meta-sub">
                        Attending: {c.doctor_name || 'Veterinarian'} • {c.clinic_name || 'Hospital'}
                      </span>
                    </div>

                    {c.ledger_hash && (
                      <button
                        type="button"
                        className="audit-proof-pill"
                        onClick={() => onOpenVerifyModal && onOpenVerifyModal(c.ledger_hash)}
                        title="Verify cryptographic proof"
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        <ShieldCheck size={14} className="audit-check-icon" />
                        <span className="text-xs">Ledger Verified</span>
                      </button>
                    )}
                  </div>

                  <p style={{ margin: 'var(--space-2) 0', fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: '1.5' }}>
                    {c.clinical_summary || 'Routine veterinary clinical evaluation recorded.'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <PaginationControl
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredList.length}
            pageSize={limit}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setLimit(sz);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 20]}
          />
        </div>
      </div>
    </div>
  );
}

