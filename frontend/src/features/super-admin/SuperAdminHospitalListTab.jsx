import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, Heart, AlertCircle, RefreshCw, CheckCircle2,
  Lock, Unlock, ChevronRight, Stethoscope
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';
import { HospitalDoctorsModal } from './HospitalDoctorsModal';
import { HospitalPatientsModal } from './HospitalPatientsModal';

export function SuperAdminHospitalListTab({ onNavigateAddHospital }) {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal drill-downs
  const [activeDoctorModalClinic, setActiveDoctorModalClinic] = useState(null);
  const [activePatientModalClinic, setActivePatientModalClinic] = useState(null);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search: searchTerm,
        status: statusFilter,
      });
      const res = await apiClient(`/api/v1/super-admin/clinics?${query}`);
      const json = await res.json();
      if (json.success) {
        setClinics(json.data || []);
        setTotalCount(json.pagination?.total || 0);
      } else {
        setError(json.error || 'Failed to load hospital directory.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching hospital directory.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, statusFilter]);

  useEffect(() => {
    fetchClinics();
  }, [fetchClinics]);

  const handleToggleStatus = async (clinicId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await apiClient(`/api/v1/super-admin/clinics/${clinicId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchClinics();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert(err.message || 'Network error updating status');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const filterConfigs = [
    {
      id: 'status',
      label: 'Status',
      value: statusFilter,
      options: [
        { key: 'all', label: 'All Statuses' },
        { key: 'active', label: 'Active Only' },
        { key: 'suspended', label: 'Suspended Only' },
      ],
    },
  ];

  return (
    <div className="doctor-tab-container">
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h1 className="doctor-tab-heading">Accredited Veterinary Hospitals</h1>
          <p className="doctor-tab-subheading">
            Enterprise practice network. Inspect clinician rosters, review enrolled animal patients, and govern tenant status.
          </p>
        </div>
        <div className="doctor-tab-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onNavigateAddHospital}
          >
            <Building2 size={16} aria-hidden="true" />
            <span>+ Onboard Hospital</span>
          </button>
        </div>
      </div>

      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={(val) => { setSearchTerm(val); setPage(1); }}
        placeholder="Search hospital by name, registration slug, or address..."
        filters={filterConfigs}
        onFilterChange={(_, val) => { setStatusFilter(val); setPage(1); }}
        onRefresh={fetchClinics}
        isLoading={loading}
        totalResults={totalCount}
      />

      {error && (
        <div className="doctor-alert doctor-alert-error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Hospital Table */}
      <div className="dashboard-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: 'var(--space-3)' }}>Hospital Name & Reg No</th>
                <th style={{ padding: 'var(--space-3)' }}>Timezone / Location</th>
                <th style={{ padding: 'var(--space-3)' }}>Status</th>
                <th style={{ padding: 'var(--space-3)' }}>Clinician Roster</th>
                <th style={{ padding: 'var(--space-3)' }}>Patients Enrolled</th>
                <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Governance</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Loading accredited hospitals directory...
                  </td>
                </tr>
              )}
              {!loading && clinics.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No hospitals found matching criteria.
                  </td>
                </tr>
              )}
              {!loading && clinics.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{c.name}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                      Slug: #{c.slug || c.id} • Admin: {c.admin_email || 'admin@hospital.com'}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-muted)' }}>
                    <div>{c.timezone || 'UTC'}</div>
                    <div style={{ fontSize: '11px' }}>{c.address || 'Address on file'}</div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setActiveDoctorModalClinic(c)}
                      title="Inspect doctors in this hospital"
                    >
                      <Stethoscope size={13} aria-hidden="true" />
                      <span>{c.doctor_count || 0} Doctors</span>
                    </button>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setActivePatientModalClinic(c)}
                      title="Inspect patients in this hospital"
                    >
                      <Heart size={13} aria-hidden="true" />
                      <span>{c.patient_count || 0} Patients</span>
                    </button>
                  </td>
                  <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleToggleStatus(c.id, c.status)}
                      title={c.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                    >
                      {c.status === 'active' ? <Lock size={13} aria-hidden="true" /> : <Unlock size={13} aria-hidden="true" />}
                      <span>{c.status === 'active' ? 'Suspend' : 'Activate'}</span>
                    </button>
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

      {/* Drill-down Modals */}
      {activeDoctorModalClinic && (
        <HospitalDoctorsModal
          clinic={activeDoctorModalClinic}
          onClose={() => setActiveDoctorModalClinic(null)}
        />
      )}

      {activePatientModalClinic && (
        <HospitalPatientsModal
          clinic={activePatientModalClinic}
          onClose={() => setActivePatientModalClinic(null)}
        />
      )}
    </div>
  );
}
