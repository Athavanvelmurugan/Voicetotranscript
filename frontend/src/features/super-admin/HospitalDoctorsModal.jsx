import React, { useState, useEffect, useCallback } from 'react';
import { X, Stethoscope, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function HospitalDoctorsModal({ clinic, onClose }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDoctors = useCallback(async () => {
    if (!clinic?.id) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search: searchTerm,
      });
      const res = await apiClient(`/api/v1/super-admin/clinics/${clinic.id}/doctors?${query}`);
      const json = await res.json();
      if (json.success) {
        setDoctors(json.data || []);
        setTotalCount(json.pagination?.total || 0);
      } else {
        setError(json.error || 'Failed to load doctors roster.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching clinic doctors.');
    } finally {
      setLoading(false);
    }
  }, [clinic?.id, page, pageSize, searchTerm]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="admin-clinic-icon-badge" style={{ width: '32px', height: '32px' }}>
              <Stethoscope size={16} aria-hidden="true" />
            </div>
            <div>
              <h3 id="modal-title" style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                Doctors Roster — {clinic?.name}
              </h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Licensed veterinary practitioners affiliated with this hospital
              </span>
            </div>
          </div>
          <button type="button" className="sidebar-mobile-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
          <SearchFilterBar
            searchTerm={searchTerm}
            onSearchChange={(val) => { setSearchTerm(val); setPage(1); }}
            placeholder="Search doctor by name, license #, or specialty..."
            onRefresh={fetchDoctors}
            isLoading={loading}
            totalResults={totalCount}
          />

          {error && (
            <div className="doctor-alert doctor-alert-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: 'var(--space-3)' }}>Doctor Name</th>
                  <th style={{ padding: 'var(--space-3)' }}>License #</th>
                  <th style={{ padding: 'var(--space-3)' }}>Specialty</th>
                  <th style={{ padding: 'var(--space-3)' }}>Email</th>
                  <th style={{ padding: 'var(--space-3)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Loading clinician roster...
                    </td>
                  </tr>
                )}
                {!loading && doctors.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No doctors registered under this hospital yet.
                    </td>
                  </tr>
                )}
                {!loading && doctors.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                    <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--weight-bold)' }}>{doc.name}</td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span className="badge badge-info">{doc.license_number || 'N/A'}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>{doc.specialty || 'General Practice'}</td>
                    <td style={{ padding: 'var(--space-3)' }}>{doc.email}</td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span className={`badge ${doc.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {doc.status}
                      </span>
                    </td>
                  </tr>
                ))}
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
          />
        </div>
      </div>
    </div>
  );
}
