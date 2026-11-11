import React, { useState, useEffect } from 'react';
import {
  Building2, Stethoscope, Calendar, Clock, CheckCircle2,
  AlertCircle, ArrowRight, ArrowLeft, Heart, ShieldCheck,
  Search, RefreshCw, User
} from 'lucide-react';

export function OwnerFindDoctorTab({ onBookingComplete }) {
  const [step, setStep] = useState('hospitals'); // 'hospitals' | 'doctors' | 'schedule'
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  // Scheduling state
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('General Health & Wellness Examination');

  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmedApt, setConfirmedApt] = useState(null);

  const [hospitalSearch, setHospitalSearch] = useState('');

  // 1. Load Hospitals and Owner Pets
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [hospRes, petsRes] = await Promise.all([
          fetch('/api/v1/owner-portal/hospitals'),
          fetch('/api/v1/owner-portal/pets'),
        ]);
        const hospData = await hospRes.json();
        const petsData = await petsRes.json();

        if (hospData.success) {
          setHospitals(hospData.data || []);
        }
        if (petsData.success && petsData.data?.length > 0) {
          setPets(petsData.data);
          setSelectedPetId(petsData.data[0].id);
        }
      } catch (err) {
        setError('Failed to load clinic network.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 2. When Hospital is Selected, Load Its Doctors
  const handleSelectHospital = async (hospital) => {
    setSelectedHospital(hospital);
    setSelectedDoctor(null);
    setSlots([]);
    setSelectedSlot(null);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/owner-portal/hospitals/${hospital.id}/doctors`);
      const data = await res.json();
      if (data.success) {
        setDoctors(data.data || []);
        setStep('doctors');
      } else {
        setError(data.error || 'Failed to load hospital doctors');
      }
    } catch (err) {
      setError('Network error fetching doctors');
    } finally {
      setLoading(false);
    }
  };

  // 3. When Doctor is Selected, Move to Scheduling
  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setStep('schedule');
  };

  // 4. Load Doctor's Available Slots when Date or Doctor changes
  useEffect(() => {
    if (step !== 'schedule' || !selectedHospital || !selectedDoctor || !selectedDate) return;

    async function fetchDoctorSlots() {
      setLoadingSlots(true);
      setError(null);
      setSelectedSlot(null);

      try {
        const res = await fetch(
          `/api/v1/owner-portal/available-slots?clinicId=${selectedHospital.id}&doctorId=${selectedDoctor.id}&date=${selectedDate}`
        );
        const data = await res.json();
        if (data.success) {
          // Flatten slots for this specific doctor
          const doctorSlots = [];
          (data.data || []).forEach((docSchedule) => {
            if (!docSchedule.doctorId || docSchedule.doctorId === selectedDoctor.id) {
              (docSchedule.availableSlots || []).forEach((s) => {
                doctorSlots.push({
                  ...s,
                  doctorId: selectedDoctor.id,
                  doctorName: selectedDoctor.name,
                });
              });
            }
          });
          setSlots(doctorSlots);
        }
      } catch (err) {
        setError('Failed to retrieve doctor availability.');
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchDoctorSlots();
  }, [step, selectedHospital, selectedDoctor, selectedDate]);

  // 5. Handle Booking Confirmation
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedPetId || !selectedSlot) {
      setError('Please select a registered pet and an available appointment time.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/owner-portal/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: selectedHospital.id,
          doctorId: selectedDoctor.id,
          petId: parseInt(selectedPetId, 10),
          appointmentDate: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to book appointment');
      }

      setConfirmedApt({
        appointment: data.data,
        hospital: selectedHospital,
        doctor: selectedDoctor,
        slot: selectedSlot,
        date: selectedDate,
        pet: pets.find((p) => p.id === parseInt(selectedPetId, 10)),
        reason,
      });

      if (onBookingComplete) {
        onBookingComplete(data.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHospitals = hospitals.filter((h) =>
    (h.name || '').toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    (h.address || '').toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    (h.timezone || '').toLowerCase().includes(hospitalSearch.toLowerCase())
  );

  // Success Receipt View
  if (confirmedApt) {
    return (
      <div className="owner-tab-content">
        <div className="owner-state-card success">
          <div className="owner-empty-icon-wrap success" aria-hidden="true">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="owner-section-title">Appointment Confirmed with {confirmedApt.doctor.name}!</h2>
          <p className="owner-section-subtitle mb-4">
            Your consultation has been reserved at {confirmedApt.hospital.name}.
          </p>

          <div className="owner-confirmed-box">
            <div className="confirmed-row">
              <span className="confirmed-label">Hospital</span>
              <span className="confirmed-val font-bold">{confirmedApt.hospital.name}</span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Attending Doctor</span>
              <span className="confirmed-val font-bold text-primary">{confirmedApt.doctor.name}</span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Patient Pet</span>
              <span className="confirmed-val">{confirmedApt.pet?.name || 'Registered Pet'}</span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Date & Time</span>
              <span className="confirmed-val font-bold">
                {confirmedApt.date} ({confirmedApt.slot.startTime} - {confirmedApt.slot.endTime})
              </span>
            </div>
            <div className="confirmed-row">
              <span className="confirmed-label">Examination Reason</span>
              <span className="confirmed-val">{confirmedApt.reason}</span>
            </div>
          </div>

          <div className="confirmed-actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setConfirmedApt(null);
                setStep('hospitals');
                setSelectedDoctor(null);
                setSelectedHospital(null);
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
      {/* Step Indicator Header */}
      <div className="discovery-stepper-header">
        <div className="owner-section-header">
          <div>
            <h2 className="owner-section-title">
              {step === 'hospitals' && 'Step 1: Select Veterinary Hospital'}
              {step === 'doctors' && `Step 2: Choose Doctor at ${selectedHospital?.name}`}
              {step === 'schedule' && `Step 3: Check ${selectedDoctor?.name}'s Schedule`}
            </h2>
            <p className="owner-section-subtitle">
              {step === 'hospitals' && 'Choose your preferred veterinary practice or animal hospital.'}
              {step === 'doctors' && 'Review attending veterinarians, credentials, and specialties.'}
              {step === 'schedule' && 'Check available calendar slots and reserve your pet consultation.'}
            </p>
          </div>

          {step !== 'hospitals' && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setStep(step === 'schedule' ? 'doctors' : 'hospitals')}
            >
              <ArrowLeft size={16} />
              <span>Back to {step === 'schedule' ? 'Doctors' : 'Hospitals'}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="auth-alert error" role="alert">
          <AlertCircle size={18} className="auth-alert-icon" />
          <div className="auth-alert-content">
            <span className="auth-alert-title">Notice</span>
            <p className="auth-alert-text">{error}</p>
          </div>
        </div>
      )}

      {/* STEP 1: Select Hospital */}
      {step === 'hospitals' && (
        <div className="discovery-hospitals-view">
          <div className="super-search-box mb-4">
            <Search size={16} className="super-search-icon" />
            <input
              type="text"
              className="super-search-input"
              placeholder="Search veterinary hospitals by name or location..."
              value={hospitalSearch}
              onChange={(e) => setHospitalSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="owner-state-card loading">
              <div className="verify-spinner" aria-hidden="true" />
              <p>Loading accredited animal hospitals...</p>
            </div>
          ) : filteredHospitals.length === 0 ? (
            <div className="owner-empty-card">
              <Building2 size={36} className="owner-empty-icon" />
              <h3>No matching hospitals found</h3>
              <p>Try refining your search keyword.</p>
            </div>
          ) : (
            <div className="hospitals-card-grid">
              {filteredHospitals.map((hosp) => (
                <div key={hosp.id} className="hospital-select-card">
                  <div className="hosp-card-header">
                    <div className="hosp-icon-wrap" aria-hidden="true">
                      <Building2 size={24} />
                    </div>
                    <div className="hosp-header-meta">
                      <div className="hosp-title-row">
                        <h3 className="hosp-name">{hosp.name}</h3>
                        {hosp.is_emergency && (
                          <span className="hosp-emergency-badge">
                            24/7 Emergency
                          </span>
                        )}
                      </div>
                      {hosp.address && (
                        <span className="hosp-meta-sub">{hosp.address}</span>
                      )}
                      {hosp.phone && (
                        <span className="hosp-meta-sub text-muted">{hosp.phone}</span>
                      )}
                    </div>
                  </div>

                  <div className="hosp-card-body">
                    <div className="hosp-stat-pill">
                      <Stethoscope size={14} />
                      <span>{hosp.doctor_count || 1} Attending Doctors</span>
                    </div>
                    <span className="hosp-verified-tag">
                      <ShieldCheck size={12} />
                      <span>Accredited Practice</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-block mt-3"
                    onClick={() => handleSelectHospital(hosp)}
                  >
                    <span>Select Hospital & View Doctors</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Inside Selected Hospital, Choose Doctor */}
      {step === 'doctors' && (
        <div className="discovery-doctors-view">
          {loading ? (
            <div className="owner-state-card loading">
              <div className="verify-spinner" aria-hidden="true" />
              <p>Retrieving veterinary staff for {selectedHospital?.name}...</p>
            </div>
          ) : doctors.length === 0 ? (
            <div className="owner-empty-card">
              <Stethoscope size={36} className="owner-empty-icon" />
              <h3>No doctors listed for this practice</h3>
              <p>Please select another hospital or contact the practice directly.</p>
            </div>
          ) : (
            <div className="doctors-card-grid">
              {doctors.map((doc) => (
                <div key={doc.id} className="doctor-select-card">
                  <div className="doc-card-header">
                    <div className="doc-avatar-wrap">
                      <span>{doc.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="doc-meta">
                      <h3 className="doc-name">{doc.name}</h3>
                      {doc.specialty ? (
                        <span className="doc-specialty-pill">{doc.specialty}</span>
                      ) : (
                        <span className="doc-role-pill">Attending Veterinarian</span>
                      )}
                      {doc.license_number && (
                        <span className="doc-license-tag">License #{doc.license_number}</span>
                      )}
                    </div>
                  </div>

                  <div className="doc-card-body">
                    <span className="doc-hospital-tag">
                      <Building2 size={13} />
                      <span>{selectedHospital?.name}</span>
                    </span>
                    <span className="doc-email-text">{doc.email}</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-block mt-3"
                    onClick={() => handleSelectDoctor(doc)}
                  >
                    <Calendar size={16} />
                    <span>Check Doctor & View Schedule</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Check Doctor Schedule & Complete Reservation */}
      {step === 'schedule' && (
        <form onSubmit={handleConfirmBooking} className="discovery-schedule-view">
          {/* Selected Provider Card */}
          <div className="selected-provider-banner">
            <div className="provider-banner-meta">
              <div className="doc-avatar-wrap sm">
                <span>{selectedDoctor?.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <span className="provider-banner-sub">Booking consultation with</span>
                <h3 className="provider-banner-name">{selectedDoctor?.name}</h3>
                <span className="provider-banner-hosp">{selectedHospital?.name}</span>
              </div>
            </div>
          </div>

          {/* 1. Select Patient Pet */}
          <div className="booking-card">
            <h3 className="booking-card-title">
              <span className="step-num-bubble">1</span>
              <span>Select Patient Pet</span>
            </h3>

            {pets.length === 0 ? (
              <div className="booking-empty-alert">
                <p>No registered pets found. Please register a pet before booking.</p>
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

          {/* 2. Select Date & Reason */}
          <div className="booking-card">
            <h3 className="booking-card-title">
              <span className="step-num-bubble">2</span>
              <span>Select Date & Reason</span>
            </h3>

            <div className="booking-inputs-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="sched-date">
                  Consultation Date
                </label>
                <div className="input-with-icon">
                  <Calendar size={18} className="input-icon" aria-hidden="true" />
                  <input
                    id="sched-date"
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
                <label className="form-label" htmlFor="sched-reason">
                  Clinical Reason
                </label>
                <select
                  id="sched-reason"
                  className="form-control"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  <option value="General Health & Wellness Examination">General Health & Wellness Examination</option>
                  <option value="Vaccination & Preventive Care">Vaccination & Preventive Care</option>
                  <option value="Skin, Coat, or Ear Irritation">Skin, Coat, or Ear Irritation</option>
                  <option value="Dental Hygiene Check">Dental Hygiene Check</option>
                  <option value="Post-Op or Medication Follow-up">Post-Op or Medication Follow-up</option>
                  <option value="Acute Illness / Urgent Check">Acute Illness / Urgent Check</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Check Available Slots for this Doctor */}
          <div className="booking-card">
            <h3 className="booking-card-title">
              <span className="step-num-bubble">3</span>
              <span>Available Time Slots for {selectedDoctor?.name}</span>
            </h3>

            {loadingSlots ? (
              <div className="owner-state-card loading py-4">
                <div className="verify-spinner" aria-hidden="true" />
                <p>Checking {selectedDoctor?.name}'s availability...</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="slots-empty-card">
                <Clock size={32} className="text-muted" />
                <p>No open slots for {selectedDoctor?.name} on {selectedDate}. Please select another date.</p>
              </div>
            ) : (
              <div className="slots-grid">
                {slots.map((s, idx) => {
                  const isSelected = selectedSlot?.startTime === s.startTime;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`slot-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(s)}
                    >
                      <span className="slot-time">{s.startTime}</span>
                      <span className="slot-doctor">{s.endTime}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Reservation */}
          <div className="booking-submit-bar">
            <button
              type="submit"
              className="btn btn-primary btn-block owner-book-submit-btn"
              disabled={submitting || !selectedSlot}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="btn-spinner" />
                  <span>Reserving Consultation with {selectedDoctor?.name}...</span>
                </>
              ) : (
                <>
                  <span>Confirm Booking with {selectedDoctor?.name}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

