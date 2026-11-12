import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, CheckCircle, AlertCircle, Building2,
  Stethoscope, Heart, User, Check, ListFilter, ArrowRight, RefreshCw, Sun, Moon
} from 'lucide-react';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';
import { ownerFetch } from '../../api/ownerClient';

function formatSlotTime(isoOrTime) {
  if (!isoOrTime) return '';
  if (/^\d{1,2}:\d{2}/.test(isoOrTime) && !isoOrTime.includes('T')) {
    const [h, m] = isoOrTime.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  }
  try {
    const d = new Date(isoOrTime);
    if (isNaN(d.getTime())) return isoOrTime;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return isoOrTime;
  }
}

export function OwnerAppointmentDualTab({ owner, onNavigateTab }) {
  const [activeSubTab, setActiveSubTab] = useState('booking'); // 'booking' | 'confirmed'

  // Booking Flow State
  const [pets, setPets] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingReason, setBookingReason] = useState('General Wellness Checkup');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  // Confirmed Appointments List State (Paginated & Searchable)
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

  // Affiliation & Profile State
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Load pets, all discoverable hospitals/independent doctors, and profile on mount
  useEffect(() => {
    ownerFetch('/api/v1/owner-portal/pets')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.length > 0) {
          setPets(d.data);
          setSelectedPetId(String(d.data[0].id));
        }
      })
      .catch(() => {});

    setProfileLoading(true);
    Promise.all([
      ownerFetch('/api/v1/owner-portal/me').then((r) => r.json()).catch(() => ({})),
      ownerFetch('/api/v1/owner-portal/hospitals').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([profData, hospData]) => {
        const hospList = hospData?.success ? (hospData.data || []) : [];
        setHospitals(hospList);

        if (profData?.success && profData.data) {
          setOwnerProfile(profData.data);
          if (profData.data.clinic_id) {
            setSelectedHospitalId(String(profData.data.clinic_id));
          } else if (hospList.length > 0) {
            setSelectedHospitalId(String(hospList[0].id));
          }
        } else if (hospList.length > 0) {
          setSelectedHospitalId(String(hospList[0].id));
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  // Load doctors whenever selected practice/hospital changes
  useEffect(() => {
    if (!selectedHospitalId) return;
    ownerFetch(`/api/v1/owner-portal/hospitals/${selectedHospitalId}/doctors`)
      .then((res) => res.json())
      .then((docData) => {
        if (docData.success && docData.data?.length > 0) {
          setDoctors(docData.data);
          const matchedDoc = ownerProfile?.primary_doctor_id
            ? docData.data.find((doc) => doc.id === ownerProfile.primary_doctor_id)
            : null;
          setSelectedDoctorId(String(matchedDoc ? matchedDoc.id : docData.data[0].id));
        } else {
          setDoctors([]);
          setSelectedDoctorId('');
        }
      })
      .catch(() => {});
  }, [selectedHospitalId, ownerProfile]);

  // When doctor and date are chosen, fetch available slots
  const fetchSlots = useCallback(async () => {
    if (!selectedHospitalId || !selectedDoctorId) return;
    setSlotsLoading(true);
    setBookingError(null);
    setSelectedSlot(null);
    try {
      const res = await ownerFetch(`/api/v1/owner-portal/available-slots?clinicId=${selectedHospitalId}&doctorId=${selectedDoctorId}&date=${selectedDate}`);
      const d = await res.json();
      if (d.success) {
        setAvailableSlots(d.data || []);
      }
    } catch (err) {
      setBookingError(err.message || 'Error fetching doctor consultation slots.');
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedHospitalId, selectedDoctorId, selectedDate]);

  useEffect(() => {
    if (activeSubTab === 'booking') {
      fetchSlots();
    }
  }, [activeSubTab, fetchSlots]);

  // Fetch confirmed appointments list
  const fetchAppointments = useCallback(async () => {
    setApptsLoading(true);
    setApptsError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter) params.set('status', statusFilter);

      const res = await ownerFetch(`/api/v1/owner-portal/appointments?${params.toString()}`);
      const d = await res.json();
      if (d.success) {
        setAppointments(d.data || []);
        if (d.pagination) {
          setPaginationMeta(d.pagination);
        } else {
          setPaginationMeta({
            page,
            limit,
            total: (d.data || []).length,
            totalPages: Math.ceil(((d.data || []).length || 1) / limit),
            hasNext: false,
            hasPrev: false,
          });
        }
      } else {
        setApptsError(d.error || 'Failed to load appointments.');
      }
    } catch (err) {
      setApptsError(err.message || 'Error loading appointments list.');
    } finally {
      setApptsLoading(false);
    }
  }, [page, limit, searchTerm, statusFilter]);

  useEffect(() => {
    if (activeSubTab === 'confirmed') {
      fetchAppointments();
    }
  }, [activeSubTab, fetchAppointments]);

  // Submit appointment booking
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedPetId || !selectedHospitalId || !selectedDoctorId || !selectedSlot) {
      setBookingError('Please select a pet, hospital, doctor, and an open consultation slot.');
      return;
    }

    setBookingLoading(true);
    setBookingError(null);
    try {
      const startTime = selectedSlot.startTime
        ? new Date(selectedSlot.startTime).toISOString().substring(11, 16)
        : selectedSlot.time;

      const res = await ownerFetch('/api/v1/owner-portal/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: parseInt(selectedHospitalId, 10),
          petId: parseInt(selectedPetId, 10),
          doctorId: parseInt(selectedDoctorId, 10),
          appointmentDate: selectedDate,
          startTime: startTime,
          reason: bookingReason,
        }),
      });

      const d = await res.json();
      if (d.success) {
        setBookingSuccess(`Appointment booked successfully for ${selectedDate} at ${formatSlotTime(selectedSlot.startTime || selectedSlot.time)}!`);
        setSelectedSlot(null);
        setTimeout(() => {
          setActiveSubTab('confirmed');
          setBookingSuccess(null);
        }, 1200);
      } else {
        setBookingError(d.error || 'Failed to book appointment.');
      }
    } catch (err) {
      setBookingError(err.message || 'Error executing booking.');
    } finally {
      setBookingLoading(false);
    }
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // Group slots into Morning and Afternoon
  const morningSlots = availableSlots.filter((s) => {
    const timeRef = s.startTime || `${selectedDate}T${s.time || '00:00:00'}Z`;
    const d = new Date(timeRef);
    const h = d.getUTCHours();
    return h < 12;
  });

  const afternoonSlots = availableSlots.filter((s) => {
    const timeRef = s.startTime || `${selectedDate}T${s.time || '00:00:00'}Z`;
    const d = new Date(timeRef);
    const h = d.getUTCHours();
    return h >= 12;
  });

  const selectedPet = pets.find((p) => String(p.id) === String(selectedPetId));
  const selectedHospital = hospitals.find((h) => String(h.id) === String(selectedHospitalId));
  const selectedDoctor = doctors.find((d) => String(d.id) === String(selectedDoctorId));

  return (
    <div className="owner-tab-pane">
      {/* Header and Dual-Tab Segmented Switcher */}
      <div className="admin-section-header">
        <div>
          <h3>Veterinary Appointments &amp; Scheduling</h3>
          <p>Book consultation appointments directly against verified doctor availability slots.</p>
        </div>

        {/* Clean Segmented Dual Tab Switcher */}
        <div className="segmented-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'booking'}
            className={`segmented-tab-btn ${activeSubTab === 'booking' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('booking')}
          >
            <Clock size={16} />
            <span>Book Appointment</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'confirmed'}
            className={`segmented-tab-btn ${activeSubTab === 'confirmed' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('confirmed')}
          >
            <ListFilter size={16} />
            <span>Confirmed Appointments ({paginationMeta.total})</span>
          </button>
        </div>
      </div>

      {bookingSuccess && (
        <div className="admin-badge badge-active admin-alert-banner">
          <CheckCircle size={16} />
          <span>{bookingSuccess}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 1: APPOINTMENT BOOKING (Doctor Confirmed Slots)
          ═══════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'booking' && (
        !profileLoading && hospitals.length === 0 ? (
          <div className="owner-no-affiliation-card">
            <Building2 size={36} className="affiliation-prompt-icon" />
            <h3>No Active Veterinary Practices Available</h3>
            <p>
              No accredited hospitals or independent doctors are currently active for online booking.
            </p>
          </div>
        ) : (
          <div className="owner-booking-workflow-card">
            {/* Practice & Clinician Summary */}
            <div className="booking-affiliation-summary-card">
              <div className="affiliation-badge-item">
                <Building2 size={16} aria-hidden="true" />
                <span>
                  Selected Practice:{' '}
                  <strong>{selectedHospital?.name || ownerProfile?.clinic_name || 'Select Practice'}</strong>
                  {selectedHospital?.practice_type ? ` (${selectedHospital.practice_type === 'INDEPENDENT' ? 'Independent Doctor' : 'Hospital'})` : ''}
                </span>
              </div>
              <div className="affiliation-badge-item">
                <Stethoscope size={16} aria-hidden="true" />
                <span>Attending Doctor: <strong>{selectedDoctor?.name || doctors[0]?.name || 'Attending DVM'}</strong></span>
              </div>
            </div>

            <form onSubmit={handleConfirmBooking}>
              {bookingError && (
                <div className="admin-badge badge-danger admin-alert-banner portal-alert-gap">
                  <AlertCircle size={16} />
                  <span>{bookingError}</span>
                </div>
              )}

              <div className="owner-booking-grid">
                {/* Practice Selector (Any Hospital or Independent Doctor) */}
                <div className="admin-form-group">
                  <label htmlFor="owner-book-hospital">Select Hospital or Independent Doctor *</label>
                  <select
                    id="owner-book-hospital"
                    className="admin-form-control"
                    value={selectedHospitalId}
                    onChange={(e) => setSelectedHospitalId(e.target.value)}
                    required
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} — {h.practice_type === 'INDEPENDENT' ? 'Independent Practice' : 'Hospital'}{h.city ? ` (${h.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Attending Doctor Selector */}
                <div className="admin-form-group">
                  <label htmlFor="owner-book-doctor">Attending Veterinarian *</label>
                  <select
                    id="owner-book-doctor"
                    className="admin-form-control"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    required
                  >
                    {doctors.length === 0 ? (
                      <option value="">No doctors available at this practice</option>
                    ) : (
                      doctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} {doc.specialty ? `(${doc.specialty})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Pet Companion Selection */}
                <div className="admin-form-group">
                  <label htmlFor="owner-book-pet">Select Patient Companion *</label>
                  <select
                    id="owner-book-pet"
                    className="admin-form-control"
                    value={selectedPetId}
                    onChange={(e) => setSelectedPetId(e.target.value)}
                    required
                  >
                    {pets.length === 0 ? (
                      <option value="">No pets registered</option>
                    ) : (
                      pets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.species} • {p.breed || 'Companion'})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Step 2: Date Picker */}
                <div className="admin-form-group">
                  <label htmlFor="owner-book-date">Consultation Date *</label>
                <input
                  id="owner-book-date"
                  type="date"
                  className="admin-form-control"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Reason for Visit */}
            <div className="admin-form-group" style={{ marginTop: 'var(--space-3)' }}>
              <label htmlFor="owner-book-reason">Primary Reason for Clinical Visit *</label>
              <input
                id="owner-book-reason"
                type="text"
                className="admin-form-control"
                placeholder="e.g. Annual vaccination, coughing symptoms, follow-up"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                required
              />
            </div>

            {/* Doctor Confirmed Available Consultation Slots */}
            <div style={{ marginTop: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                    Doctor Confirmed Available Consultation Slots
                  </h4>
                  <span className="admin-meta-sub">
                    Select an open time slot confirmed by the attending veterinarian
                  </span>
                </div>

                <button
                  type="button"
                  className="admin-btn admin-btn-outline admin-btn-sm"
                  onClick={fetchSlots}
                  disabled={slotsLoading}
                >
                  <RefreshCw size={13} className={slotsLoading ? 'spin-icon' : ''} />
                  <span>Refresh Slots</span>
                </button>
              </div>

              {slotsLoading ? (
                <div className="owner-slots-chip-grid" style={{ marginTop: 'var(--space-4)' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="owner-slot-chip skeleton animate-pulse" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="doctor-empty-state" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-5)' }}>
                  <Clock size={28} />
                  <h4 style={{ margin: 'var(--space-2) 0' }}>No consultation slots generated for this date</h4>
                  <p>Check practice operating hours or select another date.</p>
                </div>
              ) : (
                <>
                  {/* MORNING SLOTS */}
                  {morningSlots.length > 0 && (
                    <div className="owner-slots-period-group">
                      <div className="owner-slots-period-heading">
                        <Sun size={14} />
                        <span>Morning Availability (09:00 AM – 12:00 PM)</span>
                      </div>
                      <div className="owner-slots-chip-grid">
                        {morningSlots.map((slot, idx) => {
                          const isAvail = slot.available !== false && slot.is_available !== false;
                          const timeStr = formatSlotTime(slot.startTime || slot.time);
                          const isSelected = Boolean(selectedSlot && (
                            (selectedSlot.startTime && selectedSlot.startTime === slot.startTime) ||
                            (selectedSlot.time && selectedSlot.time === (slot.startTime || slot.time))
                          ));

                          return (
                            <button
                              key={`morning-${idx}`}
                              type="button"
                              disabled={!isAvail}
                              className={`owner-slot-chip ${isAvail ? 'open' : 'booked'} ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              <span>{timeStr}</span>
                              <span className="owner-slot-chip-sub">
                                {isSelected ? '✓ Selected' : isAvail ? 'Open' : 'Booked'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AFTERNOON SLOTS */}
                  {afternoonSlots.length > 0 && (
                    <div className="owner-slots-period-group">
                      <div className="owner-slots-period-heading">
                        <Clock size={14} />
                        <span>Afternoon Availability (12:00 PM – 05:00 PM)</span>
                      </div>
                      <div className="owner-slots-chip-grid">
                        {afternoonSlots.map((slot, idx) => {
                          const isAvail = slot.available !== false && slot.is_available !== false;
                          const timeStr = formatSlotTime(slot.startTime || slot.time);
                          const isSelected = Boolean(selectedSlot && (
                            (selectedSlot.startTime && selectedSlot.startTime === slot.startTime) ||
                            (selectedSlot.time && selectedSlot.time === (slot.startTime || slot.time))
                          ));

                          return (
                            <button
                              key={`afternoon-${idx}`}
                              type="button"
                              disabled={!isAvail}
                              className={`owner-slot-chip ${isAvail ? 'open' : 'booked'} ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              <span>{timeStr}</span>
                              <span className="owner-slot-chip-sub">
                                {isSelected ? '✓ Selected' : isAvail ? 'Open' : 'Booked'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Selected Slot Summary Banner & Confirm Action */}
            {selectedSlot && (
              <div className="owner-booking-summary-banner">
                <div className="owner-booking-summary-details">
                  <span className="owner-booking-summary-title">
                    ✓ Appointment Selected
                  </span>
                  <span className="owner-booking-summary-sub">
                    <strong>{selectedPet?.name || 'Pet'}</strong> with <strong>{selectedDoctor?.name || 'Attending DVM'}</strong> at <strong>{ownerProfile?.clinic_name || selectedHospital?.name || 'Hospital'}</strong> on <strong>{selectedDate}</strong> at <strong>{formatSlotTime(selectedSlot.startTime || selectedSlot.time)}</strong>
                  </span>
                </div>

                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={bookingLoading}
                >
                  {bookingLoading ? (
                    <span>Booking...</span>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Confirm &amp; Book Appointment</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-TAB 2: APPOINTMENT CONFIRMED (List, Search & Pagination)
          ═══════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'confirmed' && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Confirmed Appointments Roster</h3>
              <p className="admin-card-subtitle">Review scheduled clinical appointments, attending veterinarians, and consultation status.</p>
            </div>
            <span className="admin-badge badge-active">
              {paginationMeta.total} {paginationMeta.total === 1 ? 'Appointment' : 'Appointments'}
            </span>
          </div>

          <div className="admin-card-body">
            {/* Universal Search & Status Filter */}
            <SearchFilterBar
              searchPlaceholder="Search by pet name, veterinarian name, or reason..."
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
                    <th>Scheduled Date &amp; Time</th>
                    <th>Patient Companion</th>
                    <th>Veterinarian &amp; Hospital</th>
                    <th>Clinical Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {apptsLoading && appointments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="table-empty-message">Loading appointment list...</td>
                    </tr>
                  ) : appointments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="table-empty-message">No scheduled appointments found matching search.</td>
                    </tr>
                  ) : (
                    appointments.map((apt) => (
                      <tr key={apt.id}>
                        <td>
                          <strong>
                            {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </strong>
                          <div className="admin-meta-sub">
                            {new Date(apt.scheduled_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </td>
                        <td>
                          <strong>{apt.pet_name}</strong>
                          <div className="admin-meta-sub">{apt.species} {apt.breed ? `• ${apt.breed}` : ''}</div>
                        </td>
                        <td>
                          <div>{apt.doctor_name || 'Attending DVM'}</div>
                          <div className="admin-meta-sub">{apt.clinic_name || 'Affiliated Hospital'}</div>
                        </td>
                        <td>{apt.reason || apt.type || 'Routine Checkup'}</td>
                        <td>
                          <span className={`admin-badge ${apt.status === 'confirmed' || apt.status === 'scheduled' ? 'badge-active' : apt.status === 'completed' ? 'badge-info' : 'badge-danger'}`}>
                            {apt.status}
                          </span>
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
              pageSizeOptions={[5, 10, 25, 50]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
