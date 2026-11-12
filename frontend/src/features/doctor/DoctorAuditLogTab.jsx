import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, Download, RefreshCw, UserCheck, Calendar, FileCheck, CheckCircle2 } from 'lucide-react';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';
import { apiClient } from '../../api/client';

export function DoctorAuditLogTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Universal Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [paginationMeta, setPaginationMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set('search', search.trim());
      if (actionFilter) params.set('action', actionFilter);

      const res = await apiClient(`/api/v1/audit-viewer?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEvents(data.data || []);
        if (data.pagination) {
          setPaginationMeta(data.pagination);
        } else {
          setPaginationMeta({
            page,
            limit,
            total: (data.data || []).length,
            totalPages: Math.ceil(((data.data || []).length || 1) / limit),
            hasNext: false,
            hasPrev: false,
          });
        }
      } else {
        setError(data.error || 'Failed to fetch doctor audit trail.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, actionFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filterConfigs = [
    {
      id: 'action',
      label: 'Action Type',
      value: actionFilter,
      options: [
        { key: '', label: 'All Pet Owner & Clinical Actions' },
        { key: 'appointment_scheduled', label: 'Pet Owner Booking' },
        { key: 'consent_signed', label: 'Guardian Consent' },
        { key: 'APPROVE_DOCUMENT', label: 'Clinical SOAP Approved' },
        { key: 'CREATE_PET', label: 'Patient Enrolled' },
        { key: 'CREATE_CONSULTATION', label: 'Consultation Initiated' },
      ],
    },
  ];

  return (
    <div className="doctor-tab-container">
      {/* Tab Header Controls */}
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h2 className="doctor-tab-heading">Clinical &amp; Pet Guardian Audit Trail</h2>
          <p className="doctor-tab-subheading">
            Trace pet owner booking actions, verified guardian consents, medical document approvals, and timeline modifications.
          </p>
        </div>

        <div className="doctor-tab-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={fetchEvents}
            disabled={loading}
            title="Refresh Audit Trail"
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Universal Search & Action Filter Bar */}
      <SearchFilterBar
        placeholder="Search audit events by action, pet guardian name, patient ID..."
        searchTerm={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filters={filterConfigs}
        onFilterChange={(_, val) => {
          setActionFilter(val);
          setPage(1);
        }}
        onRefresh={fetchEvents}
        isLoading={loading}
        totalResults={paginationMeta.total}
      />

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target Entity</th>
              <th>Actor (Pet Guardian / Staff)</th>
              <th>Audit Verification</th>
            </tr>
          </thead>
          <tbody>
            {loading && events.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-empty-message">Loading clinical audit events...</td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-empty-message">No matching audit events recorded yet.</td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <strong>
                      {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                    <div className="admin-meta-sub">
                      {new Date(ev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </td>
                  <td>
                    <span className="admin-badge badge-active">{ev.action}</span>
                  </td>
                  <td>
                    <div>{ev.target_type || 'Clinical Record'}</div>
                    <div className="admin-meta-sub">ID: #{ev.target_id || '—'}</div>
                  </td>
                  <td>
                    <strong>{ev.actor_name || 'Pet Owner / Guardian'}</strong>
                    <div className="admin-meta-sub">{ev.actor_email}</div>
                  </td>
                  <td>
                    <div className="audit-proof-pill">
                      <ShieldCheck size={14} className="audit-check-icon" />
                      <span className="admin-font-mono text-xs">Immutable Block</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Server-Side Pagination */}
      <PaginationControl
        currentPage={paginationMeta.page}
        totalPages={paginationMeta.totalPages}
        totalItems={paginationMeta.total}
        pageSize={limit}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(sz) => {
          setLimit(sz);
          setPage(1);
        }}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  );
}
