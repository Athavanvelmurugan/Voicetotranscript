import React, { useState, useEffect, useCallback } from 'react';
import { X, Heart, AlertCircle, Calendar } from 'lucide-react';
import { apiClient } from '../../api/client';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function DoctorPatientsModal({ doctor, onClose }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDoctorPatients = useCallback(async () => {
    if (!doctor?.id) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search: searchTerm,
      });
      const res = await apiClient(`/api/v1/staff/${doctor.id}/patients?${query}`);
      const json = await res.json();
      if (json.success) {
        setPatients(json.data || []);
        setTotalCount(json.pagination?.total || 0);
      } else {
        setError(json.error || 'Failed to load assigned patients.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching doctor patients.');
    } finally {
      setLoading(false);
    }
  }, [doctor?.id, page, pageSize, searchTerm]);

  useEffect(() => {
    fetchDoctorPatients();
  }, [fetchDoctorPatients]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-doc-patients-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="admin-clinic-icon-badge" style={{ width: '32px', height: '32px' }}>
              <Heart size={16} aria-hidden="true" />
            </div>
            <div>
              <h3 id="modal-doc-patients-title" style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                Patients Treated — {doctor?.name}
              </h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Animal patients with consultation records under {doctor?.license_number ? `DVM #${doctor.license_number}` : 'this attending veterinarian'}
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
            placeholder="Search patient by name, species, breed, or owner..."
            onRefresh={fetchDoctorPatients}
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
                  <th style={{ padding: 'var(--space-3)' }}>Patient Name</th>
                  <th style={{ padding: 'var(--space-3)' }}>Species & Breed</th>
                  <th style={{ padding: 'var(--space-3)' }}>Age & Weight</th>
                  <th style={{ padding: 'var(--space-3)' }}>Guardian Contact</th>
                  <th style={{ padding: 'var(--space-3)' }}>Total Visits</th>
                  <th style={{ padding: 'var(--space-3)' }}>Last Consultation</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Loading patient records...
                    </td>
                  </tr>
                )}
                {!loading && patients.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No patients recorded under this veterinarian yet.
                    </td>
                  </tr>
                )}
                {!loading && patients.map((p) => {
                  const lastVisit = p.last_consultation_at
                    ? new Date(p.last_consultation_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'N/A';

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                      <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--weight-bold)' }}>{p.name}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <span className="badge badge-species" style={{ marginRight: '4px' }}>{p.species}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{p.breed || 'Mixed'}</span>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        {p.age_years ? `${p.age_years} yrs` : 'N/A'} • {p.weight_kg ? `${p.weight_kg} kg` : 'N/A'}
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        {p.owner_name || 'Guardian'}{p.owner_contact ? ` (${p.owner_contact})` : ''}
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <span className="badge badge-info">{p.consultation_count || 1} Visits</span>
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                        {lastVisit}
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
          />
        </div>
      </div>
    </div>
  );
}
