import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, CheckCircle, AlertCircle, Stethoscope,
  RefreshCw, User, FileText, ListFilter, ArrowRight, Activity, CheckCheck
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function DoctorAppointmentScheduleTab({ onStartConsultation, onOpenPatientChart }) {
  const { user } = useAuth();
  const doctorId = user?.id || 1;

  // ─── Today's Live Patient Queue State ───────────────────────────────────────
  const [todayQueue, setTodayQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState(null);

  const fetchTodayQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await apiClient('/api/v1/scheduling/today-queue');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTodayQueue(data.data);
      } else {
        setTodayQueue([]);
      }
    } catch (err) {
      setQueueError(err.message || 'Failed to load today’s patient queue');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  // ─── Searchable & Paginated Appointments Roster State ─────────────────────
  const [appointments, setAppointments] = useState([]);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [apptsError, setApptsError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [paginationMeta, setPaginationMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const fetchAppointments = useCallback(async () => {
    setApptsLoading(true);
    setApptsError(null);
    try {
      const params = new URLSearchParams({
        doctorId: String(doctorId),
        page: String(page),
        limit: String(limit),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter) params.set('status', statusFilter);

      const res = await apiClient(`/api/v1/scheduling?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setAppointments(json.data || []);
        if (json.pagination) {
          setPaginationMeta(json.pagination);
        } else {
          setPaginationMeta({
            page,
            limit,
            total: (json.data || []).length,
            totalPages: Math.ceil(((json.data || []).length || 1) / limit),
            hasNext: false,
            hasPrev: false,
          });
        }
      } else {
        setApptsError(json.error || 'Failed to load appointment roster.');
      }
    } catch (err) {
      setApptsError(err.message || 'Error fetching appointments.');
    } finally {
      setApptsLoading(false);
    }
  }, [doctorId, page, limit, searchTerm, statusFilter]);

  // Initial loads
  useEffect(() => {
    fetchTodayQueue();
  }, [fetchTodayQueue]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="doctor-tab-container">
      {/* Tab Header Banner */}
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h2 className="doctor-tab-heading">Appointment Schedule &amp; Patient Queue</h2>
          <p className="doctor-tab-subheading">
            Review today&apos;s waiting patient queue, upcoming scheduled consultations, and initiate live AI consultations with 1 click.
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => {
            fetchTodayQueue();
            fetchAppointments();
          }}
          disabled={queueLoading || apptsLoading}
          aria-label="Refresh today's queue and appointments"
        >
          <RefreshCw size={14} className={queueLoading || apptsLoading ? 'spin' : ''} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: TODAY'S LIVE PATIENT QUEUE (Priority Cards)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="doctor-queue-section">
        <div className="doctor-queue-header">
          <div className="doctor-queue-title-wrap">
            <Clock size={18} className="queue-header-icon" aria-hidden="true" />
            <h3 className="doctor-queue-title">Today&apos;s Patient Queue</h3>
            <span className="admin-badge badge-active">
              {todayQueue.length} {todayQueue.length === 1 ? 'Patient' : 'Patients'} Queued
            </span>
          </div>
          <span className="admin-meta-sub">
            Click &quot;Start Live Consultation&quot; to automatically launch the session
          </span>
        </div>

        {queueError && (
          <div className="admin-badge badge-danger admin-alert-banner">
            <AlertCircle size={15} />
            <span>{queueError}</span>
          </div>
        )}

        {queueLoading && todayQueue.length === 0 ? (
          <div className="doctor-queue-empty">
            <RefreshCw size={20} className="spin" />
            <span>Loading today&apos;s queue...</span>
          </div>
        ) : todayQueue.length === 0 ? (
          <div className="doctor-queue-empty">
            <CheckCheck size={22} className="queue-check-icon" />
            <div className="queue-empty-text">
              <strong>Queue is currently clear for today</strong>
              <span>No patients are waiting in the queue. You can schedule new appointments or select from the roster below.</span>
            </div>
          </div>
        ) : (
          <div className="doctor-queue-grid">
            {todayQueue.map((item) => {
              const timeStr = new Date(item.scheduled_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div key={item.id} className="doctor-queue-card">
                  <div className="doctor-queue-card-top">
                    <span className="doctor-queue-time-badge">
                      <Clock size={12} />
                      <span>{timeStr} • {item.duration_min || 15}m</span>
                    </span>
                    <span className={`admin-badge ${item.status === 'confirmed' ? 'badge-active' : 'badge-warning'}`}>
                      {item.status || 'Waiting'}
                    </span>
                  </div>

                  <div className="doctor-queue-card-body">
                    <div className="doctor-queue-patient-name">{item.pet_name}</div>
                    <div className="doctor-queue-patient-sub">
                      {item.pet_species} {item.pet_breed ? `• ${item.pet_breed}` : ''}
                    </div>

                    <div className="doctor-queue-meta-row">
                      <span className="doctor-queue-meta-label">Guardian:</span>
                      <span className="doctor-queue-meta-val">{item.owner_name || 'Guardian'}</span>
                    </div>

                    <div className="doctor-queue-meta-row">
                      <span className="doctor-queue-meta-label">Reason:</span>
                      <span className="doctor-queue-meta-val reason-highlight">{item.reason || 'General Consultation'}</span>
                    </div>
                  </div>

                  <div className="doctor-queue-card-footer">
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary admin-btn-sm queue-launch-btn"
                      onClick={() => onStartConsultation && onStartConsultation(item)}
                      title={`Launch live consultation for ${item.pet_name}`}
                    >
                      <Stethoscope size={14} />
                      <span>Start Live Consultation</span>
                      <ArrowRight size={14} />
                    </button>
                    {item.pet_id && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-outline admin-btn-sm"
                        onClick={() => onOpenPatientChart && onOpenPatientChart(item.pet_id)}
                        title="View Medical Chart"
                      >
                        <FileText size={13} />
                        <span>Chart</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: ALL SCHEDULED APPOINTMENTS ROSTER
          ═══════════════════════════════════════════════════════════════ */}
      <div className="doctor-appointment-list-pane">
        <div className="doctor-roster-header">
          <div className="doctor-roster-title-wrap">
            <Calendar size={18} aria-hidden="true" />
            <h3 className="doctor-queue-title">Scheduled Appointments Roster</h3>
          </div>
          <span className="admin-meta-sub">Search across all booked appointments</span>
        </div>

        {/* Universal Search & Status Filter */}
        <SearchFilterBar
          searchPlaceholder="Search by pet name, guardian name, reason..."
          searchValue={searchTerm}
          onSearchChange={(val) => {
            setSearchTerm(val);
            setPage(1);
          }}
          filterOptions={statusOptions}
          filterValue={statusFilter}
          onFilterChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          filterLabel="Status"
          onRefresh={fetchAppointments}
          isLoading={apptsLoading}
          totalResults={paginationMeta.total}
        />

        {apptsError && (
          <div className="admin-badge badge-danger admin-alert-banner">
            <AlertCircle size={16} />
            <span>{apptsError}</span>
          </div>
        )}

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Scheduled Time</th>
                <th>Patient (Pet)</th>
                <th>Guardian (Owner)</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apptsLoading && appointments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty-message">Loading scheduled appointments...</td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty-message">No appointments found matching your search.</td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr key={apt.id}>
                    <td>
                      <strong>
                        {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                      <div className="admin-meta-sub">
                        {new Date(apt.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-link-btn"
                        onClick={() => onOpenPatientChart && onOpenPatientChart(apt.pet_id)}
                      >
                        <strong>{apt.pet_name || `Patient #${apt.pet_id}`}</strong>
                      </button>
                      <div className="admin-meta-sub">{apt.species} {apt.breed ? `• ${apt.breed}` : ''}</div>
                    </td>
                    <td>
                      <div>{apt.owner_name || 'Guardian'}</div>
                      <div className="admin-meta-sub">{apt.owner_phone}</div>
                    </td>
                    <td>{apt.reason || apt.type || 'General Checkup'}</td>
                    <td>
                      <span className={`admin-badge ${apt.status === 'confirmed' ? 'badge-active' : apt.status === 'completed' ? 'badge-info' : 'badge-danger'}`}>
                        {apt.status}
                      </span>
                    </td>
                    <td>
                      <div className="admin-inline-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn-primary admin-btn-sm"
                          onClick={() => onStartConsultation && onStartConsultation(apt)}
                          title="Start Live Consultation"
                        >
                          <Stethoscope size={13} />
                          <span>Consult</span>
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-outline admin-btn-sm"
                          onClick={() => onOpenPatientChart && onOpenPatientChart(apt.pet_id)}
                          title="Open Medical Chart"
                        >
                          <FileText size={13} />
                          <span>Chart</span>
                        </button>
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
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>
    </div>
  );
}

