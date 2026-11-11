import React, { useState, useEffect, useCallback } from 'react';
import { X, Heart, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function HospitalPatientsModal({ clinic, onClose }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPatients = useCallback(async () => {
    if (!clinic?.id) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search: searchTerm,
      });
      const res = await apiClient(`/api/v1/super-admin/clinics/${clinic.id}/patients?${query}`);
      const json = await res.json();
      if (json.success) {
        setPatients(json.data || []);
        setTotalCount(json.pagination?.total || 0);
      } else {
        setError(json.error || 'Failed to load patients list.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching clinic patients.');
    } finally {
      setLoading(false);
    }
  }, [clinic?.id, page, pageSize, searchTerm]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-patients-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="admin-clinic-icon-badge" style={{ width: '32px', height: '32px' }}>
              <Heart size={16} aria-hidden="true" />
            </div>
            <div>
              <h3 id="modal-patients-title" style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                Patients Enrolled — {clinic?.name}
              </h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Animal patients registered under hospital veterinary care
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
            onRefresh={fetchPatients}
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
                  <th style={{ padding: 'var(--space-3)' }}>Microchip</th>
                  <th style={{ padding: 'var(--space-3)' }}>Guardian Contact</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      Loading enrolled patients...
                    </td>
                  </tr>
                )}
                {!loading && patients.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No patients enrolled in this hospital yet.
                    </td>
                  </tr>
                )}
                {!loading && patients.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                    <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--weight-bold)' }}>{p.name}</td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span className="badge badge-species" style={{ marginRight: '4px' }}>{p.species}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{p.breed || 'Mixed'}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      {p.age_years ? `${p.age_years} yrs` : 'Age N/A'} • {p.weight_kg ? `${p.weight_kg} kg` : 'Weight N/A'}
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span className="badge badge-info">{p.microchip_no || 'None'}</span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      {p.owner_name || 'Guardian'}{p.owner_contact ? ` (${p.owner_contact})` : ''}
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
