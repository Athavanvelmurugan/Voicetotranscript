import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, AlertTriangle, Plus, CheckCircle, XCircle, User, Heart, ChevronLeft, ChevronRight } from 'lucide-react';

export function CalendarSchedulingTab() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [pets, setPets] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Booking Modal
  const [showModal, setShowModal] = useState(false);
  const [bookingPetId, setBookingPetId] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingDuration, setBookingDuration] = useState(15);
  const [bookingType, setBookingType] = useState('general_checkup');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  // Fetch doctors and pets initially
  useEffect(() => {
    async function loadInitial() {
      try {
        const [staffRes, petsRes] = await Promise.all([
          fetch('/api/v1/staff'),
          fetch('/api/v1/pets'),
        ]);
        const staffData = await staffRes.json();
        const petsData = await petsRes.json();

        if (staffData.success) {
          const docs = staffData.data.filter((s) => s.role === 'doctor');
          setDoctors(docs);
          if (docs.length > 0) {
            setSelectedDoctorId(String(docs[0].id));
          }
        }
        if (petsData.success) {
          setPets(petsData.data);
          if (petsData.data.length > 0) {
            setBookingPetId(String(petsData.data[0].id));
          }
        }
      } catch (err) {
        console.error('Error loading doctors/pets:', err);
      }
    }
    loadInitial();
  }, []);

  // Fetch slots and appointments when doctor or date changes
  const fetchSchedule = useCallback(async () => {
    if (!selectedDoctorId || !selectedDate) return;
    setLoading(true);
    setError(null);
    try {
      const [slotsRes, aptsRes] = await Promise.all([
        fetch(`/api/v1/scheduling/slots?doctorId=${selectedDoctorId}&date=${selectedDate}`),
        fetch(`/api/v1/scheduling?doctorId=${selectedDoctorId}&startDate=${selectedDate}T00:00:00Z&endDate=${selectedDate}T23:59:59Z`),
      ]);
      const slotsData = await slotsRes.json();
      const aptsData = await aptsRes.json();

      if (slotsData.success) setSlots(slotsData.data);
      if (aptsData.success) setAppointments(aptsData.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, selectedDate]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleOpenBooking = (slotStartTime = '') => {
    setBookingTime(slotStartTime || `${selectedDate}T09:00:00.000Z`);
    setConflictError(null);
    setShowModal(true);
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    if (!bookingPetId || !bookingTime) return;

    setBookingSubmitting(true);
    setConflictError(null);

    try {
      const res = await fetch('/api/v1/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: parseInt(bookingPetId, 10),
          doctor_id: parseInt(selectedDoctorId, 10),
          scheduled_at: bookingTime,
          duration_min: parseInt(bookingDuration, 10),
          type: bookingType,
          reason: bookingReason,
          source: 'desk',
        }),
      });

      const data = await res.json();
      if (res.status === 409) {
        setConflictError(data.error);
        return;
      }
      if (!data.success) {
        throw new Error(data.error || 'Failed to book appointment');
      }

      setShowModal(false);
      setBookingReason('');
      fetchSchedule();
    } catch (err) {
      setConflictError(err.message);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCancelAppointment = async (aptId) => {
    const reason = window.prompt('Please enter the reason for cancellation:');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/v1/scheduling/${aptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancelled_reason: reason || 'Cancelled by clinic administration',
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedule();
      } else {
        alert(data.error || 'Failed to cancel appointment');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="admin-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Calendar &amp; Scheduling Engine</h3>
          <p>Real-time slot availability, double-booking prevention, and patient appointments.</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => handleOpenBooking()}
        >
          <Plus size={16} />
          <span>Book Appointment</span>
        </button>
      </div>

      <div className="admin-filter-bar">
        <div className="admin-form-group">
          <label htmlFor="cal-doc">Attending Doctor</label>
          <select
            id="cal-doc"
            className="admin-form-control"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.role})
              </option>
            ))}
          </select>
        </div>

        <div className="admin-form-group">
          <label htmlFor="cal-date">Appointment Date</label>
          <input
            id="cal-date"
            type="date"
            className="admin-form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Available Slots Strip */}
      <div className="admin-settings-card admin-schedule-slots-card">
        <div className="admin-section-header-row">
          <h4>Generated Time Slots ({selectedDate})</h4>
          <span className="admin-meta-sub">
            Green = Available for booking • Red = Booked slot
          </span>
        </div>

        {loading ? (
          <p className="table-empty-message">Calculating slots...</p>
        ) : slots.length === 0 ? (
          <p className="table-empty-message">No working hours configured for this day.</p>
        ) : (
          <div className="calendar-slots-grid">
            {slots.map((slot, idx) => {
              const timeLabel = new Date(slot.startTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <button
                  key={idx}
                  type="button"
                  className={`calendar-slot-chip ${slot.available ? 'available' : 'booked'}`}
                  onClick={() => slot.available && handleOpenBooking(slot.startTime)}
                  disabled={!slot.available}
                  title={slot.available ? 'Click to book this time' : `Booked: ${slot.bookedAppointment?.petName || 'Patient'}`}
                >
                  <strong>{timeLabel}</strong>
                  <span className="admin-meta-sub">
                    {slot.available ? 'Available' : 'Booked'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day's Scheduled Appointments List */}
      <div className="admin-section-header">
        <div>
          <h4>Day&apos;s Scheduled Appointments</h4>
          <p>Detailed list of patient visits and check-in status.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Reason &amp; Type</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan="6" className="table-empty-message">
                  No appointments scheduled on this date.
                </td>
              </tr>
            ) : (
              appointments.map((apt) => {
                const timeStr = new Date(apt.scheduled_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <tr key={apt.id}>
                    <td>
                      <strong>{timeStr}</strong>
                      <div className="admin-meta-sub">{apt.duration_min} mins</div>
                    </td>
                    <td>
                      <strong>{apt.pet_name}</strong>
                      <div className="admin-meta-sub">{apt.pet_species} • {apt.pet_breed || 'Mixed'}</div>
                    </td>
                    <td>
                      <div>{apt.reason || 'Routine checkup'}</div>
                      <span className="admin-badge badge-active">{apt.type.replace('_', ' ')}</span>
                    </td>
                    <td>
                      {apt.owner_name}
                      <div className="admin-meta-sub">{apt.owner_phone || 'No contact'}</div>
                    </td>
                    <td>
                      <span className={`admin-badge ${apt.status === 'completed' ? 'badge-active' : apt.status === 'cancelled' ? 'badge-danger' : 'badge-pending'}`}>
                        {apt.status}
                      </span>
                    </td>
                    <td>
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger-outline"
                          onClick={() => handleCancelAppointment(apt.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Booking Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h4>Book Patient Appointment</h4>
              <button
                type="button"
                className="queue-close-btn"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleBookSubmit}>
              <div className="admin-modal-body">
                {conflictError && (
                  <div className="admin-badge badge-danger admin-alert-banner">
                    <AlertTriangle size={18} />
                    <span>{conflictError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label htmlFor="book-pet">Select Patient *</label>
                  <select
                    id="book-pet"
                    className="admin-form-control"
                    value={bookingPetId}
                    onChange={(e) => setBookingPetId(e.target.value)}
                    required
                  >
                    {pets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.species} • Owner: {p.owner_name || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-stats-grid">
                  <div className="admin-form-group">
                    <label htmlFor="book-time">Date &amp; Time (ISO/Local) *</label>
                    <input
                      id="book-time"
                      type="datetime-local"
                      required
                      className="admin-form-control"
                      value={bookingTime ? bookingTime.slice(0, 16) : ''}
                      onChange={(e) => setBookingTime(new Date(e.target.value).toISOString())}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="book-duration">Duration (Minutes)</label>
                    <select
                      id="book-duration"
                      className="admin-form-control"
                      value={bookingDuration}
                      onChange={(e) => setBookingDuration(parseInt(e.target.value, 10))}
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="book-type">Appointment Type</label>
                  <select
                    id="book-type"
                    className="admin-form-control"
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value)}
                  >
                    <option value="general_checkup">General Checkup</option>
                    <option value="vaccination">Vaccination</option>
                    <option value="urgent">Urgent / Sick Visit</option>
                    <option value="surgery">Surgery Consultation</option>
                    <option value="dental_exam">Dental Examination</option>
                    <option value="follow_up">Follow-up</option>
                  </select>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="book-reason">Clinical Reason / Owner Notes</label>
                  <textarea
                    id="book-reason"
                    rows={3}
                    className="admin-form-control"
                    placeholder="e.g. Lethargy and mild coughing for 3 days"
                    value={bookingReason}
                    onChange={(e) => setBookingReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={bookingSubmitting}
                >
                  {bookingSubmitting ? 'Confirming...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
