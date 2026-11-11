import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, CheckCircle, AlertCircle, Stethoscope,
  ChevronLeft, ChevronRight, RefreshCw, User, FileText, Check,
  ListFilter, Shield, CheckCheck, Lock, Unlock, Sun, Moon,
  Settings, Save, Sparkles, Info
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function DoctorScheduleDualTab({ onStartConsultation, onOpenPatientChart }) {
  const { user } = useAuth();
  const doctorId = user?.id || 1;

  const [activeSubTab, setActiveSubTab] = useState('slots'); // 'slots' | 'list'

  // Sub-Tab 1: Available Slots & Doctor Working Shift Configuration
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [slots, setSlots] = useState([]);
  const [isAvailabilityConfirmed, setIsAvailabilityConfirmed] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState(null);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [showShiftConfig, setShowShiftConfig] = useState(false);

  // Working Shift State (Default: Morning Shift 10:00 AM - 1:00 PM)
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('13:00');
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [applyScope, setApplyScope] = useState('day'); // 'day' | 'weekdays'
  const [activePreset, setActivePreset] = useState('morning'); // 'morning' | 'fullday' | 'afternoon' | 'custom'

  // Selected slot for inspection / launcher
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Sub-Tab 2: Booked Appointment List with Server-Side Pagination & Search
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

  // Time Formatter helper: formats ISO strings or "HH:MM:SS" into 12-hour AM/PM
  const formatSlotTime = (isoOrTime) => {
    if (!isoOrTime) return '--:--';
    if (isoOrTime.includes('T')) {
      return new Date(isoOrTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const parts = isoOrTime.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m} ${ampm}`;
  };

  // Fetch Doctor Saved Working Hours
  const fetchDoctorAvailability = useCallback(async () => {
    try {
      const res = await apiClient(`/api/v1/scheduling/availability/${doctorId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const dateObj = new Date(`${selectedDate}T00:00:00Z`);
        const weekday = dateObj.getUTCDay();
        const currentDayBlock = json.data.find((b) => b.weekday === weekday) || json.data[0];
        if (currentDayBlock) {
          const s = (currentDayBlock.start_time || '10:00:00').substring(0, 5);
          const e = (currentDayBlock.end_time || '13:00:00').substring(0, 5);
          setStartTime(s);
          setEndTime(e);
          setSlotMinutes(currentDayBlock.slot_minutes || 15);
          if (s === '10:00' && e === '13:00') {
            setActivePreset('morning');
          } else if (s === '09:00' && e === '17:00') {
            setActivePreset('fullday');
          } else if (s === '14:00' && e === '18:00') {
            setActivePreset('afternoon');
          } else {
            setActivePreset('custom');
          }
          setIsAvailabilityConfirmed(true);
        }
      }
    } catch (_) {}
  }, [doctorId, selectedDate]);

  // Fetch Slots for selected date
  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    try {
      const res = await apiClient(`/api/v1/scheduling/slots?doctorId=${doctorId}&date=${selectedDate}`);
      const json = await res.json();
      if (json.success) {
        setSlots(json.data || []);
      } else {
        setSlotsError(json.error || 'Failed to load available slots.');
      }
    } catch (err) {
      setSlotsError(err.message || 'Error fetching doctor slots.');
    } finally {
      setSlotsLoading(false);
    }
  }, [doctorId, selectedDate]);

  // Fetch Appointments List
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
        setApptsError(json.error || 'Failed to load appointment list.');
      }
    } catch (err) {
      setApptsError(err.message || 'Error fetching appointments.');
    } finally {
      setApptsLoading(false);
    }
  }, [doctorId, page, limit, searchTerm, statusFilter]);

  // Initial & reactive loads
  useEffect(() => {
    if (activeSubTab === 'slots') {
      fetchDoctorAvailability();
      fetchSlots();
    } else {
      fetchAppointments();
    }
  }, [activeSubTab, fetchDoctorAvailability, fetchSlots, fetchAppointments]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Quick Preset Selector
  const handleSelectPreset = (presetKey) => {
    setActivePreset(presetKey);
    if (presetKey === 'morning') {
      setStartTime('10:00');
      setEndTime('13:00');
    } else if (presetKey === 'fullday') {
      setStartTime('09:00');
      setEndTime('17:00');
    } else if (presetKey === 'afternoon') {
      setStartTime('14:00');
      setEndTime('18:00');
    }
  };

  // Save Doctor Availability to Backend
  const handleSaveAvailability = async () => {
    setSavingAvailability(true);
    setSaveSuccessMsg(null);
    setSlotsError(null);
    try {
      const dateObj = new Date(`${selectedDate}T00:00:00Z`);
      const currentWeekday = dateObj.getUTCDay();

      let targetBlocks = [];
      if (applyScope === 'weekdays') {
        // Monday (1) through Friday (5)
        targetBlocks = [1, 2, 3, 4, 5].map((w) => ({
          weekday: w,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          slot_minutes: slotMinutes,
          is_active: true,
        }));
      } else {
        // Single selected day
        targetBlocks = [{
          weekday: currentWeekday,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          slot_minutes: slotMinutes,
          is_active: true,
        }];
      }

      const res = await apiClient(`/api/v1/scheduling/availability/${doctorId}`, {
        method: 'PUT',
        body: JSON.stringify({ blocks: targetBlocks }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update doctor availability');
      }

      setIsAvailabilityConfirmed(true);
      setShowShiftConfig(false);
      const weekdayName = dateObj.toLocaleDateString([], { weekday: 'long' });
      setSaveSuccessMsg(`Availability confirmed (${formatSlotTime(startTime)} – ${formatSlotTime(endTime)}) for ${applyScope === 'weekdays' ? 'Mon-Fri' : weekdayName}. Pet owners on the Patient Portal can now book.`);
      setTimeout(() => setSaveSuccessMsg(null), 6000);
      await fetchSlots();
    } catch (err) {
      setSlotsError(err.message || 'Error saving availability.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="doctor-tab-container">
      {/* Tab Header Controls */}
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h2 className="doctor-tab-heading">Doctor Calendar &amp; Slot Availability</h2>
          <p className="doctor-tab-subheading">
            Manage your daily consultation availability, confirm open booking slots for pet owners, and review scheduled patients.
          </p>
        </div>

        {/* Dual Tab Switcher with Tokenized Segmented Pill Bar */}
        <div className="segmented-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'slots'}
            className={`segmented-tab-btn ${activeSubTab === 'slots' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('slots')}
          >
            <Clock size={15} />
            <span>Available Slot Appointment</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'list'}
            className={`segmented-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('list')}
          >
            <ListFilter size={15} />
            <span>Appointment List</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 1: AVAILABLE SLOT APPOINTMENT (Doctor Availability Confirmation)
          ═══════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'slots' && (
        <div className="doctor-schedule-subtab-pane">
          {/* Availability Confirmation Bar */}
          <div className="doctor-slot-confirmation-bar">
            <div className="doctor-slot-confirmation-info">
              <div className="confirmation-badge-row">
                {isAvailabilityConfirmed ? (
                  <span className="admin-badge badge-active">
                    <CheckCheck size={14} />
                    <span>Doctor Confirmed &amp; Open for Pet Owner Booking ({formatSlotTime(startTime)} – {formatSlotTime(endTime)})</span>
                  </span>
                ) : (
                  <span className="admin-badge badge-warning">
                    <Lock size={14} />
                    <span>Doctor Availability Unconfirmed / Draft</span>
                  </span>
                )}
              </div>
              <p className="admin-meta-sub">
                {isAvailabilityConfirmed
                  ? `Your consultation shift is confirmed from ${formatSlotTime(startTime)} to ${formatSlotTime(endTime)}. Pet owners can view and instantly book consultations on their portal.`
                  : 'Slots are hidden from pet owners until you click Confirm Availability.'}
              </p>
            </div>

            <button
              type="button"
              className={`admin-btn ${showShiftConfig ? 'admin-btn-outline' : 'admin-btn-primary'}`}
              onClick={() => setShowShiftConfig(!showShiftConfig)}
              aria-expanded={showShiftConfig}
            >
              <Settings size={15} />
              <span>{showShiftConfig ? 'Hide Shift Settings' : 'Update Availability / Shift Hours'}</span>
            </button>
          </div>

          {/* Success Notification Banner */}
          {saveSuccessMsg && (
            <div className="admin-badge badge-active admin-alert-banner">
              <CheckCircle size={16} />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Shift Hours & Working Schedule Configurator */}
          {showShiftConfig && (
            <div className="doctor-shift-config-bar">
              <div className="shift-config-header">
                <div>
                  <h4 className="shift-config-title">Configure Doctor Practice Working Hours</h4>
                  <p className="shift-config-subtitle">
                    Select your consultation shift hours. Pet owners on the Patient Portal will only be able to book slots within this window.
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-outline admin-btn-sm"
                  onClick={() => setShowShiftConfig(false)}
                >
                  Close
                </button>
              </div>

              {/* Quick Shift Presets */}
              <div className="shift-preset-row">
                <span className="shift-preset-label">Shift Presets:</span>
                <div className="shift-preset-pills">
                  <button
                    type="button"
                    className={`shift-preset-btn ${activePreset === 'morning' ? 'active' : ''}`}
                    onClick={() => handleSelectPreset('morning')}
                  >
                    <Sun size={14} />
                    <span>Morning Shift (10:00 AM – 01:00 PM)</span>
                  </button>
                  <button
                    type="button"
                    className={`shift-preset-btn ${activePreset === 'fullday' ? 'active' : ''}`}
                    onClick={() => handleSelectPreset('fullday')}
                  >
                    <Clock size={14} />
                    <span>Full Day (09:00 AM – 05:00 PM)</span>
                  </button>
                  <button
                    type="button"
                    className={`shift-preset-btn ${activePreset === 'afternoon' ? 'active' : ''}`}
                    onClick={() => handleSelectPreset('afternoon')}
                  >
                    <Moon size={14} />
                    <span>Afternoon (02:00 PM – 06:00 PM)</span>
                  </button>
                  <button
                    type="button"
                    className={`shift-preset-btn ${activePreset === 'custom' ? 'active' : ''}`}
                    onClick={() => handleSelectPreset('custom')}
                  >
                    <Settings size={14} />
                    <span>Custom</span>
                  </button>
                </div>
              </div>

              {/* Time Pickers & Scope Inputs */}
              <div className="shift-inputs-grid">
                <div className="shift-input-group">
                  <label htmlFor="shift-start-time">Shift Start Time</label>
                  <input
                    id="shift-start-time"
                    type="time"
                    className="admin-form-control"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setActivePreset('custom');
                    }}
                  />
                </div>

                <div className="shift-input-group">
                  <label htmlFor="shift-end-time">Shift End Time</label>
                  <input
                    id="shift-end-time"
                    type="time"
                    className="admin-form-control"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setActivePreset('custom');
                    }}
                  />
                </div>

                <div className="shift-input-group">
                  <label htmlFor="shift-slot-min">Slot Duration</label>
                  <select
                    id="shift-slot-min"
                    className="admin-form-control"
                    value={slotMinutes}
                    onChange={(e) => setSlotMinutes(Number(e.target.value))}
                  >
                    <option value={15}>15 Minutes per Consultation</option>
                    <option value={30}>30 Minutes per Consultation</option>
                    <option value={45}>45 Minutes per Consultation</option>
                    <option value={60}>60 Minutes per Consultation</option>
                  </select>
                </div>

                <div className="shift-input-group">
                  <label htmlFor="shift-scope">Apply Scope</label>
                  <select
                    id="shift-scope"
                    className="admin-form-control"
                    value={applyScope}
                    onChange={(e) => setApplyScope(e.target.value)}
                  >
                    <option value="day">Selected Day Only ({new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString([], { weekday: 'long' })})</option>
                    <option value="weekdays">All Weekdays (Monday – Friday)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shift-actions-row">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleSaveAvailability}
                  disabled={savingAvailability}
                >
                  <Save size={15} />
                  <span>{savingAvailability ? 'Saving Availability...' : 'Confirm & Save Availability'}</span>
                </button>
                <span className="admin-meta-sub">
                  Updates PostgreSQL doctor availability table and activates confirmed slots for pet owners.
                </span>
              </div>
            </div>
          )}

          {/* Date Selector Banner */}
          <div className="doctor-schedule-date-bar">
            <button
              type="button"
              className="schedule-nav-btn"
              onClick={handlePrevDay}
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="schedule-date-display">
              <Calendar size={18} className="schedule-calendar-icon" />
              <span className="schedule-date-text">
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date(`${selectedDate}T00:00:00`))}
              </span>
              <input
                type="date"
                className="schedule-date-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Select Date"
              />
            </div>

            <button
              type="button"
              className="schedule-nav-btn"
              onClick={handleNextDay}
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              className="admin-btn admin-btn-outline schedule-today-btn"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            >
              Today
            </button>
          </div>

          {/* Slots Error Banner */}
          {slotsError && (
            <div className="admin-badge badge-danger admin-alert-banner">
              <AlertCircle size={16} />
              <span>{slotsError}</span>
            </div>
          )}

          {/* Slots Section Header & Summary */}
          <div className="doctor-section-header">
            <div className="doctor-slots-header-info">
              <h3>Available Consultation Time Slots</h3>
              <span className="admin-meta-sub">
                {slots.filter((s) => !s.bookedAppointment && !s.appointment && s.available !== false).length} Available • {slots.filter((s) => s.bookedAppointment || s.appointment).length} Booked • Shift Window: {formatSlotTime(startTime)} – {formatSlotTime(endTime)}
              </span>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-outline admin-btn-sm"
              onClick={fetchSlots}
              disabled={slotsLoading}
            >
              <RefreshCw size={13} className={slotsLoading ? 'spin' : ''} />
              <span>Refresh Slots</span>
            </button>
          </div>

          {/* Slots Loading Skeleton */}
          {slotsLoading ? (
            <div className="doctor-slots-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="doctor-slot-card skeleton animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="doctor-empty-state">
              <Clock size={32} />
              <h3>No consultation slots generated for this date</h3>
              <p>Click &quot;Update Availability / Shift Hours&quot; above to set your working schedule (e.g. Morning 10 AM - 1 PM).</p>
            </div>
          ) : (
            <div className="doctor-slots-grid">
              {slots.map((slot, idx) => {
                const slotTimeText = formatSlotTime(slot.startTime || slot.time);
                const bookedData = slot.bookedAppointment || slot.appointment;
                const isBooked = Boolean(bookedData || slot.available === false || slot.is_available === false);
                const isAvailable = !isBooked;
                const isSelected = selectedSlot === slot;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`doctor-slot-card ${isAvailable ? 'slot-open' : 'slot-booked'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(isSelected ? null : slot)}
                    aria-label={`${slotTimeText} slot - ${isAvailable ? 'Available for booking' : 'Booked'}`}
                  >
                    <div className="slot-time-row">
                      <Clock size={14} aria-hidden="true" />
                      <span className="slot-time">{slotTimeText}</span>
                    </div>
                    <span className={`slot-status-pill ${isAvailable ? 'open' : 'booked'}`}>
                      {isAvailable ? 'Available Slot' : 'Booked'}
                    </span>
                    {bookedData && (
                      <div className="slot-appt-preview">
                        <strong>{bookedData.petName || bookedData.pet_name || 'Patient'}</strong>
                        <span>{bookedData.reason || 'Consultation'}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Slot Inspector / Quick Launcher */}
          {selectedSlot && (
            <div className="slot-detail-bar">
              <div className="slot-detail-left">
                <Clock size={18} className="queue-header-icon" />
                <div>
                  <strong>{formatSlotTime(selectedSlot.startTime || selectedSlot.time)}</strong>
                  <span className="slot-detail-status">
                    {selectedSlot.bookedAppointment || selectedSlot.appointment
                      ? `Booked by ${selectedSlot.bookedAppointment?.petName || selectedSlot.appointment?.pet_name || 'Patient'}`
                      : 'Confirmed Open for Pet Owner Booking on Patient Portal'}
                  </span>
                </div>
              </div>
              <div className="slot-detail-actions">
                {(selectedSlot.bookedAppointment || selectedSlot.appointment) ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary admin-btn-sm"
                    onClick={() => {
                      const item = selectedSlot.bookedAppointment || selectedSlot.appointment;
                      onStartConsultation && onStartConsultation(item);
                    }}
                  >
                    <Stethoscope size={14} />
                    <span>Start Live Consultation</span>
                  </button>
                ) : (
                  <span className="admin-badge badge-active">
                    <CheckCheck size={13} />
                    <span>Available on Patient Portal</span>
                  </span>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn-outline admin-btn-sm"
                  onClick={() => setSelectedSlot(null)}
                >
                  Deselect
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 2: BOOKED APPOINTMENT LIST (Search & Paginated)
          ═══════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'list' && (
        <div className="doctor-appointment-list-pane">
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
      )}
    </div>
  );
}
