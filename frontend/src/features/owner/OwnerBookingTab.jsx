import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Heart, Stethoscope, CheckCircle2,
  AlertCircle, ArrowRight, RefreshCw, Sparkles, Sun, Moon
} from 'lucide-react';

export function OwnerBookingTab() {
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Tomorrow by default
    return today.toISOString().split('T')[0];
  });
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('Routine Checkup & Wellness');
  const [loadingPets, setLoadingPets] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successApt, setSuccessApt] = useState(null);

  // 1. Load Owner Pets
  useEffect(() => {
    async function fetchPets() {
      try {
        const res = await fetch('/api/v1/owner-portal/pets');
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          setPets(data.data);
          setSelectedPetId(data.data[0].id);
        }
      } catch (_) {
      } finally {
        setLoadingPets(false);
      }
    }
    fetchPets();
  }, []);

  // 2. Load Available Slots for Selected Date
  useEffect(() => {
    if (!selectedDate) return;
    async function fetchSlots() {
      setLoadingSlots(true);
      setError(null);
      setSelectedSlot(null);
      try {
        const res = await fetch(`/api/v1/owner-portal/available-slots?date=${selectedDate}`);
        const data = await res.json();
        if (data.success) {
          const allSlots = [];
          (data.data || []).forEach((docSchedule) => {
            (docSchedule.availableSlots || []).forEach((slot) => {
              allSlots.push({
                ...slot,
                doctorId: docSchedule.doctorId,
                doctorName: docSchedule.doctorName,
              });
            });
          });
          setSlots(allSlots);
        } else {
          setError(data.error || 'Failed to load scheduling slots.');
        }
      } catch (err) {
        setError('Network error checking availability.');
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [selectedDate]);

  const handleBook = async (e) => {
    e.preventDefault();
    if (!selectedPetId || !selectedSlot) {
      setError('Please select a pet and an available appointment slot.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/owner-portal/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petId: parseInt(selectedPetId, 10),
          doctorId: selectedSlot.doctorId,
          appointmentDate: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to book appointment.');
      }

      setSuccessApt(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPet = pets.find((p) => p.id === parseInt(selectedPetId, 10));

  if (successApt) {
    return (
      <div className="owner-tab-content">
        <div className="owner-state-card success">
          <div className="owner-empty-icon-wrap success" aria-hidden="true">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="owner-section-title">Appointment Confirmed!</h2>
          <p className="owner-section-subtitle mb-4">
            Your clinical consultation has been reserved at Central Valley Animal Hospital.
          </p>

          <div className="owner-confirmed-box">
            <div className="confirmed-row">
              <span className="confirmed-label">Patient Pet</span>
              <span className="confirmed-val font-bold">{selectedPet?.name || 'Your Pet'}</span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Scheduled Date</span>
              <span className="confirmed-val font-bold">{selectedDate}</span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Time Window</span>
              <span className="confirmed-val font-bold">{selectedSlot?.startTime} - {selectedSlot?.endTime}</span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Attending Veterinarian</span>
              <span className="confirmed-val">{selectedSlot?.doctorName}</span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Consultation Reason</span>
              <span className="confirmed-val">{reason}</span>
            </div>
          </div>

          <div className="confirmed-actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSuccessApt(null);
                setSelectedSlot(null);
              }}
            >
              Book Another Visit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-tab-content">
      <div className="owner-section-header">
        <div>
          <h2 className="owner-section-title">Book Veterinary Visit</h2>
          <p className="owner-section-subtitle">
            Self-service appointment scheduler with real-time doctor availability and conflict prevention.
          </p>
        </div>
      </div>

      {error && (
        <div className="auth-alert error" role="alert">
          <AlertCircle size={18} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-title">Booking Notice</span>
            <p className="auth-alert-text">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleBook} className="owner-booking-form">
        {/* Step 1: Select Pet */}
        <div className="booking-card">
          <h3 className="booking-card-title">
            <span className="step-num-bubble">1</span>
            <span>Select Patient</span>
          </h3>

          {loadingPets ? (
            <p className="loading-text">Loading registered pets...</p>
          ) : pets.length === 0 ? (
            <div className="booking-empty-alert">
              <p>No registered pets found. Please register a pet first before booking an appointment.</p>
            </div>
          ) : (
            <div className="pet-selector-chips">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  className={`pet-chip-btn ${selectedPetId === pet.id ? 'active' : ''}`}
                  onClick={() => setSelectedPetId(pet.id)}
                >
                  <Heart size={16} />
                  <span>{pet.name}</span>
                  <span className="pet-chip-species">({pet.species})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Choose Date & Reason */}
        <div className="booking-card">
          <h3 className="booking-card-title">
            <span className="step-num-bubble">2</span>
            <span>Select Date & Reason</span>
          </h3>

          <div className="booking-inputs-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="booking-date">
                Appointment Date
              </label>
              <div className="input-with-icon">
                <Calendar size={18} className="input-icon" aria-hidden="true" />
                <input
                  id="booking-date"
                  type="date"
                  className="form-control"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="booking-reason">
                Reason for Visit
              </label>
              <select
                id="booking-reason"
                className="form-control"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                <option value="Routine Checkup & Wellness">Routine Checkup & Wellness</option>
                <option value="Vaccination & Booster">Vaccination & Booster Shots</option>
                <option value="Dermatology & Skin Check">Dermatology & Skin / Ear Check</option>
                <option value="Dental Examination">Dental Examination</option>
                <option value="Follow-up Recheck">Follow-up Recheck</option>
                <option value="Illness / Urgent Consultation">Illness / Urgent Clinical Consultation</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Pick Available Time Slot */}
        <div className="booking-card">
          <h3 className="booking-card-title">
            <span className="step-num-bubble">3</span>
            <span>Choose Available Slot</span>
          </h3>

          {loadingSlots ? (
            <div className="owner-state-card loading py-4">
              <div className="verify-spinner" aria-hidden="true" />
              <p>Checking practitioner schedules...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="slots-empty-card">
              <Clock size={32} className="text-muted" />
              <p>No available slots found for {selectedDate}. Please select another date.</p>
            </div>
          ) : (
            <div className="slots-grid">
              {slots.map((s, idx) => {
                const isSelected =
                  selectedSlot?.startTime === s.startTime &&
                  selectedSlot?.doctorId === s.doctorId;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`slot-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(s)}
                  >
                    <span className="slot-time">{s.startTime}</span>
                    <span className="slot-doctor">{s.doctorName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Submission Bar */}
        <div className="booking-submit-bar">
          <button
            type="submit"
            className="btn btn-primary btn-block owner-book-submit-btn"
            disabled={submitting || !selectedSlot}
          >
            {submitting ? (
              <>
                <RefreshCw size={16} className="btn-spinner" />
                <span>Confirming Appointment...</span>
              </>
            ) : (
              <>
                <span>Confirm Appointment Booking</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
