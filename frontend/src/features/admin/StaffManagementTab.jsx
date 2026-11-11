import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Search, CheckCircle, XCircle, Shield, AlertTriangle,
  Stethoscope, Heart, Users
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';
import { DoctorPatientsModal } from './DoctorPatientsModal';

export function StaffManagementTab({ onNavigateTab }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Patient List popup state
  const [selectedDoctorForPatients, setSelectedDoctorForPatients] = useState(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        search: searchTerm,
        role: roleFilter,
      });
      const res = await apiClient(`/api/v1/staff?${query}`);
      const json = await res.json();
      if (json.success) {
        setStaff(json.data || []);
        setTotalCount(json.pagination?.total || 0);
      } else {
        setError(json.error || 'Failed to load staff list');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching staff roster.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, roleFilter]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleRoleChange = async (staffId, newRole) => {
    try {
      const res = await apiClient(`/api/v1/staff/${staffId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        fetchStaff();
      } else {
        alert(data.error || 'Failed to change role');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApproveLicense = async (staffId) => {
    try {
      const res = await apiClient(`/api/v1/staff/${staffId}/approve-license`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (data.success) {
        fetchStaff();
      } else {
        alert(data.error || 'Failed to verify license');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (staffMember) => {
    const isCurrentlyActive = staffMember.status === 'active';
    const endpoint = isCurrentlyActive
      ? `/api/v1/staff/${staffMember.id}/deactivate`
      : `/api/v1/staff/${staffMember.id}/reactivate`;

    try {
      const res = await apiClient(endpoint, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchStaff();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const filterConfigs = [
    {
      id: 'role',
      label: 'Role',
      value: roleFilter,
      options: [
        { key: 'all', label: 'All Roles' },
        { key: 'doctor', label: 'Doctors Only' },
        { key: 'staff', label: 'Staff Only' },
        { key: 'clinic_admin', label: 'Admins Only' },
      ],
    },
  ];

  return (
    <div className="admin-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Staff &amp; Practitioner Roster</h3>
          <p>Manage clinical team roles, verify veterinary medical licenses, and inspect attending doctor patient rosters.</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => onNavigateTab && onNavigateTab('doctor-add')}
          title="Onboard a new veterinarian to this practice"
        >
          <UserPlus size={16} />
          <span>+ Add Doctor</span>
        </button>
      </div>

      <SearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={(val) => { setSearchTerm(val); setPage(1); }}
        placeholder="Search staff by name, email, license #, or specialty..."
        filters={filterConfigs}
        onFilterChange={(_, val) => { setRoleFilter(val); setPage(1); }}
        onRefresh={fetchStaff}
        isLoading={loading}
        totalResults={totalCount}
      />

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Clinician &amp; Detail</th>
              <th>Role</th>
              <th>Medical License</th>
              <th>Assigned Patients</th>
              <th>Account Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && staff.length === 0 ? (
              <tr>
                <td colSpan="6" className="table-empty-message">Loading roster...</td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan="6" className="table-empty-message">No matching staff members found.</td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.name}</strong>
                    <div className="admin-meta-sub">
                      {member.email} {member.phone && `• ${member.phone}`}
                    </div>
                    {member.specialty && (
                      <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '2px' }}>
                        {member.specialty}
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      className="admin-form-control admin-table-select"
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    >
                      <option value="doctor">Doctor</option>
                      <option value="staff">Staff</option>
                      <option value="clinic_admin">Clinic Admin</option>
                    </select>
                  </td>
                  <td>
                    {member.license_verified_at ? (
                      <span className="admin-badge badge-active">
                        <CheckCircle size={13} />
                        <span>Verified #{member.license_number || '—'}</span>
                      </span>
                    ) : member.license_number ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-outline"
                        onClick={() => handleApproveLicense(member.id)}
                        title="Approve and verify medical license"
                      >
                        <Shield size={13} />
                        <span>Verify #{member.license_number}</span>
                      </button>
                    ) : (
                      <span className="admin-badge badge-inactive">None Provided</span>
                    )}
                  </td>
                  <td>
                    {member.role === 'doctor' ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-outline"
                        onClick={() => setSelectedDoctorForPatients(member)}
                        title={`View patients assigned to Dr. ${member.name}`}
                      >
                        <Heart size={13} aria-hidden="true" />
                        <span>{member.consultation_count || 0} Patients</span>
                      </button>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        member.status === 'active' ? 'badge-active' : 'badge-inactive'
                      }`}
                    >
                      {member.status === 'active' ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`admin-btn admin-btn-sm ${
                        member.status === 'active' ? 'admin-btn-danger' : 'admin-btn-outline'
                      }`}
                      onClick={() => handleToggleStatus(member)}
                    >
                      {member.status === 'active' ? (
                        <>
                          <XCircle size={13} />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={13} />
                          <span>Reactivate</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
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

      {/* Patient List Drill-down Popup */}
      {selectedDoctorForPatients && (
        <DoctorPatientsModal
          doctor={selectedDoctorForPatients}
          onClose={() => setSelectedDoctorForPatients(null)}
        />
      )}
    </div>
  );
}
