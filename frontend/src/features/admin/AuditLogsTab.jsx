import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function AuditLogsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Universal Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [paginationMeta, setPaginationMeta] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Verification modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyConsultationId, setVerifyConsultationId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

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

      const res = await fetch(`/api/v1/audit-viewer?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.data || []);
        if (data.pagination) {
          setPaginationMeta(data.pagination);
        } else {
          setPaginationMeta({
            page,
            limit,
            total: data.total || (data.data || []).length,
            totalPages: Math.ceil((data.total || 1) / limit),
            hasNext: false,
            hasPrev: false,
          });
        }
      } else {
        setError(data.error || 'Failed to load audit logs');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, actionFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleExportCsv = () => {
    window.location.href = '/api/v1/audit-viewer/export';
  };

  const handleVerifyChain = async (e) => {
    e.preventDefault();
    if (!verifyConsultationId) return;

    setVerifying(true);
    setVerifyResult(null);

    try {
      const res = await fetch(`/api/v1/audit-viewer/verify-chain/${verifyConsultationId}`);
      const data = await res.json();
      if (data.success) {
        setVerifyResult(data.data);
      } else {
        setVerifyResult({ valid: false, reason: data.error });
      }
    } catch (err) {
      setVerifyResult({ valid: false, reason: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const actionFilterOptions = [
    { value: '', label: 'All Actions' },
    { value: 'LOGIN', label: 'Logins' },
    { value: 'CREATE_CONSULTATION', label: 'Consultations' },
    { value: 'APPROVE_DOCUMENT', label: 'Approvals' },
    { value: 'CREATE_PET', label: 'Patient Registrations' },
    { value: 'BOOK_APPOINTMENT', label: 'Appointments' },
  ];

  return (
    <div className="admin-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Hospital Audit &amp; Compliance Logs</h3>
          <p>Hospital-scoped operational event trail tracking clinic admin, doctor, and pet owner actions.</p>
        </div>
        <div className="admin-inline-actions">
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={() => {
              setShowVerifyModal(true);
              setVerifyResult(null);
            }}
          >
            <ShieldCheck size={16} />
            <span>Verify Ledger Chain</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleExportCsv}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Universal Search & Action Filter Bar */}
      <SearchFilterBar
        searchPlaceholder="Search audit events by action, actor, target ID, or email..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filterOptions={actionFilterOptions}
        filterValue={actionFilter}
        onFilterChange={(val) => {
          setActionFilter(val);
          setPage(1);
        }}
        filterLabel="Action"
        onRefresh={fetchEvents}
        isLoading={loading}
        totalResults={paginationMeta.total}
      />

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target Type</th>
              <th>Target ID</th>
              <th>Actor</th>
              <th>IP Address</th>
              <th>Event Metadata</th>
            </tr>
          </thead>
          <tbody>
            {loading && events.length === 0 ? (
              <tr>
                <td colSpan="7" className="table-empty-message">Loading audit events...</td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan="7" className="table-empty-message">No matching audit events found.</td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    {new Date(ev.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td>
                    <span className="admin-badge badge-active">{ev.action}</span>
                  </td>
                  <td>{ev.target_type || '—'}</td>
                  <td>#{ev.target_id || '—'}</td>
                  <td>
                    <strong>{ev.actor_name || 'System'}</strong>
                    <div className="admin-meta-sub">{ev.actor_email}</div>
                  </td>
                  <td>
                    <span className="admin-font-mono">{ev.ip || '—'}</span>
                  </td>
                  <td>
                    <span className="admin-font-mono">
                      {typeof ev.metadata === 'object' ? JSON.stringify(ev.metadata) : String(ev.metadata)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Server-Side Pagination Control */}
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
        pageSizeOptions={[15, 25, 50, 100]}
      />

      {/* Verify Ledger Modal */}
      {showVerifyModal && (
        <div className="admin-modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h4>Verify Cryptographic Audit Chain</h4>
              <button
                type="button"
                className="queue-close-btn"
                onClick={() => setShowVerifyModal(false)}
                aria-label="Close"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleVerifyChain}>
              <div className="admin-modal-body">
                <p className="admin-meta-sub">
                  Every consultation document change and transcription update is linked in an append-only SHA-256 hash chain (RFC 8785). Enter a consultation ID to verify cryptographic integrity across every block.
                </p>

                <div className="admin-form-group">
                  <label htmlFor="verify-id">Consultation ID *</label>
                  <input
                    id="verify-id"
                    type="number"
                    required
                    className="admin-form-control"
                    placeholder="e.g. 1"
                    value={verifyConsultationId}
                    onChange={(e) => setVerifyConsultationId(e.target.value)}
                  />
                </div>

                {verifyResult && (
                  <div className="admin-mt-3">
                    {verifyResult.valid ? (
                      <div className="admin-badge badge-active admin-alert-banner">
                        <CheckCircle size={18} />
                        <div>
                          <strong>Integrity Verified!</strong>
                          <div>{verifyResult.message || `All blocks verified with zero tampering.`}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-badge badge-danger admin-alert-banner">
                        <AlertTriangle size={18} />
                        <div>
                          <strong>Cryptographic Tamper Alert!</strong>
                          <div>{verifyResult.reason || 'Hash chain mismatch detected.'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => setShowVerifyModal(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={verifying}
                >
                  {verifying ? 'Auditing Chain...' : 'Verify Cryptographic Chain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
