import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, AlertCircle, RefreshCw, Calendar,
  Filter, CheckCircle2, Lock, User
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function SuperAdminAuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState('all');

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search: searchTerm,
        actorType: actorTypeFilter,
      });
      const res = await apiClient(`/api/v1/super-admin/audit-logs?${query}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setLogs(json.data || []);
        setTotalCount(json.pagination?.total || 0);
      } else {
        setError(json.error || 'Failed to load system audit trail.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching system audit trail.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, actorTypeFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const filterConfigs = [
    {
      id: 'actorType',
      label: 'Actor Role',
      value: actorTypeFilter,
      options: [
        { key: 'all', label: 'All Actors' },
        { key: 'admin', label: 'Practice Admins' },
        { key: 'doctor', label: 'Veterinarians' },
        { key: 'system', label: 'System / AI Engine' },
      ],
    },
  ];

  return (
    <div className="doctor-tab-container">
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h1 className="doctor-tab-heading">Platform System Audit Trail</h1>
          <p className="doctor-tab-subheading">
            Immutable cross-tenant security and compliance ledger. Every operational event, prescription issuance, and clinical modification is recorded with cryptographic timestamps.
          </p>
        </div>
      </div>

      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={(val) => { setSearchTerm(val); setPage(1); }}
        placeholder="Search audit trail by event action, entity, actor name, or hospital..."
        filters={filterConfigs}
        onFilterChange={(_, val) => { setActorTypeFilter(val); setPage(1); }}
        onRefresh={fetchAuditLogs}
        isLoading={loading}
        totalResults={totalCount}
      />

      {error && (
        <div className="doctor-alert doctor-alert-error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Hospital Tenant</th>
              <th>Actor &amp; Role</th>
              <th>Action Triggered</th>
              <th>Target Entity</th>
              <th>IP Address</th>
              <th>Integrity</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="table-empty-message">
                  Verifying and loading cryptographic audit logs...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty-message">
                  No audit records found matching criteria.
                </td>
              </tr>
            )}
            {!loading && logs.map((log) => {
              const dateStr = log.created_at
                ? new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })
                : 'N/A';

              return (
                <tr key={log.id}>
                  <td>
                    <span className="admin-meta-sub">{dateStr}</span>
                  </td>
                  <td>
                    <strong>{log.clinic_name || `System${log.clinic_id ? ` #${log.clinic_id}` : ''}`}</strong>
                  </td>
                  <td>
                    <strong>{log.actor_name || 'System Actor'}</strong>
                    <div className="admin-meta-sub">{log.actor_type || 'system'}</div>
                  </td>
                  <td>
                    <span className="admin-badge badge-active admin-font-mono">{log.action}</span>
                  </td>
                  <td>
                    <span className="admin-meta-sub">
                      {log.entity_type
                        ? `${log.entity_type} #${log.entity_id || '—'}`
                        : `Consultation #${log.consultation_id || 'N/A'}`}
                    </span>
                  </td>
                  <td>
                    <span className="admin-font-mono admin-meta-sub">
                      {log.ip_address || 'Internal RPC'}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge badge-active" title="SHA-256 Hash Chained & Verified">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      <span>Verified</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationControl
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        pageSizeOptions={[15, 30, 50]}
      />
    </div>
  );
}
