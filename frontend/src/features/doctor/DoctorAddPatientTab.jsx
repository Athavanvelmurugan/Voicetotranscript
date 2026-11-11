import React, { useState } from 'react';
import {
  Heart, User, Stethoscope, FileText, CheckCircle,
  AlertTriangle, Shield, Plus, RotateCcw, ArrowRight
} from 'lucide-react';
import { apiClient } from '../../api/client';

export function DoctorAddPatientTab({ onPatientAdded, onStartConsultation }) {
  const initialForm = {
    name: '',
    species: 'Canine (Dog)',
    breed: '',
    sex: 'Neutered Male',
    age_years: '',
    weight_kg: '',
    microchip_no: '',
    allergies: '',
    chronic_conditions: '',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    owner_address: '',
  };

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdPet, setCreatedPet] = useState(null);

  const speciesList = [
    'Canine (Dog)',
    'Feline (Cat)',
    'Avian (Bird)',
    'Rabbit (Lagomorph)',
    'Ferret (Mustelid)',
    'Equine (Horse)',
    'Reptile / Exotic',
    'Other Small Mammal',
  ];

  const sexOptions = [
    'Neutered Male',
    'Spayed Female',
    'Intact Male',
    'Intact Female',
    'Unknown',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Patient (Pet) Name is required.');
      return;
    }
    if (!form.species.trim()) {
      setError('Patient Species is required.');
      return;
    }

    setSubmitting(true);
    try {
      // Parse allergies and chronic conditions if comma-separated
      const allergiesArr = form.allergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const chronicArr = form.chronic_conditions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim(),
        species: form.species.trim(),
        breed: form.breed.trim() || null,
        sex: form.sex,
        age_years: form.age_years ? parseFloat(form.age_years) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        microchip_no: form.microchip_no.trim() || null,
        allergies: allergiesArr,
        chronic_conditions: chronicArr,
        owner_name: form.owner_name.trim() || null,
        owner_phone: form.owner_phone.trim() || null,
        owner_email: form.owner_email.trim() || null,
        owner_address: form.owner_address.trim() || null,
      };

      const res = await apiClient('/api/v1/pets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create patient record.');
      }

      setCreatedPet(data.data);
      if (onPatientAdded) onPatientAdded(data.data);
    } catch (err) {
      setError(err.message || 'An error occurred while creating patient.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setCreatedPet(null);
    setError(null);
  };

  return (
    <div className="doctor-tab-container">
      {/* Tab Header */}
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h2 className="doctor-tab-heading">Patient Registration Form</h2>
          <p className="doctor-tab-subheading">
            Register a new animal patient and attach guardian contact details to the clinic electronic medical records.
          </p>
        </div>
      </div>

      {/* Success State Card */}
      {createdPet ? (
        <div className="doctor-card doctor-success-card animate-fadeIn">
          <div className="doctor-success-header">
            <div className="doctor-success-icon-badge">
              <CheckCircle size={28} />
            </div>
            <div>
              <h3 className="doctor-success-title">Patient Successfully Registered</h3>
              <p className="doctor-success-subtitle">
                Medical record #{createdPet.id} has been provisioned for <strong>{createdPet.name}</strong>.
              </p>
            </div>
          </div>

          <div className="doctor-created-pet-summary">
            <div className="created-pet-col">
              <span className="summary-label">Patient Name</span>
              <span className="summary-val">{createdPet.name}</span>
            </div>
            <div className="created-pet-col">
              <span className="summary-label">Species & Breed</span>
              <span className="summary-val">{createdPet.species} {createdPet.breed && `(${createdPet.breed})`}</span>
            </div>
            <div className="created-pet-col">
              <span className="summary-label">Guardian</span>
              <span className="summary-val">{createdPet.owner_name || 'N/A'} {createdPet.owner_phone && `• ${createdPet.owner_phone}`}</span>
            </div>
            <div className="created-pet-col">
              <span className="summary-label">Allergies</span>
              <span className="summary-val">
                {createdPet.allergies && createdPet.allergies.length > 0
                  ? createdPet.allergies.join(', ')
                  : 'None recorded'}
              </span>
            </div>
          </div>

          <div className="doctor-success-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => onStartConsultation && onStartConsultation(createdPet.id)}
            >
              <Stethoscope size={16} />
              <span>Start Live Consultation Now</span>
            </button>

            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={handleReset}
            >
              <Plus size={16} />
              <span>Register Another Patient</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="doctor-card doctor-form-card">
          {error && (
            <div className="doctor-error-banner" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Patient Animal Information */}
          <div className="doctor-form-section">
            <div className="section-title-row">
              <Heart size={18} className="section-icon" />
              <h3 className="section-title">Animal Patient Demographics</h3>
            </div>

            <div className="doctor-form-grid">
              <div className="doctor-input-group">
                <label htmlFor="pet-name" className="doctor-label">
                  Patient (Pet) Name <span className="req-star">*</span>
                </label>
                <input
                  id="pet-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Luna, Buster, Milo"
                  className="doctor-input"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group">
                <label htmlFor="pet-species" className="doctor-label">
                  Species <span className="req-star">*</span>
                </label>
                <select
                  id="pet-species"
                  name="species"
                  className="doctor-select"
                  value={form.species}
                  onChange={handleChange}
                >
                  {speciesList.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <div className="doctor-input-group">
                <label htmlFor="pet-breed" className="doctor-label">Breed</label>
                <input
                  id="pet-breed"
                  name="breed"
                  type="text"
                  placeholder="e.g. Golden Retriever, Domestic Shorthair"
                  className="doctor-input"
                  value={form.breed}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group">
                <label htmlFor="pet-sex" className="doctor-label">Sex / Reproductive Status</label>
                <select
                  id="pet-sex"
                  name="sex"
                  className="doctor-select"
                  value={form.sex}
                  onChange={handleChange}
                >
                  {sexOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="doctor-input-group">
                <label htmlFor="pet-age" className="doctor-label">Age (Years)</label>
                <input
                  id="pet-age"
                  name="age_years"
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  placeholder="e.g. 3.5"
                  className="doctor-input"
                  value={form.age_years}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group">
                <label htmlFor="pet-weight" className="doctor-label">Weight (kg)</label>
                <input
                  id="pet-weight"
                  name="weight_kg"
                  type="number"
                  step="0.05"
                  min="0"
                  max="500"
                  placeholder="e.g. 14.2"
                  className="doctor-input"
                  value={form.weight_kg}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group span-2">
                <label htmlFor="pet-microchip" className="doctor-label">Microchip ID (ISO 11784/11785)</label>
                <input
                  id="pet-microchip"
                  name="microchip_no"
                  type="text"
                  placeholder="e.g. 985141001234567"
                  className="doctor-input"
                  value={form.microchip_no}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group span-2">
                <label htmlFor="pet-allergies" className="doctor-label">
                  Known Drug & Environmental Allergies <span className="label-hint">(comma-separated)</span>
                </label>
                <input
                  id="pet-allergies"
                  name="allergies"
                  type="text"
                  placeholder="e.g. Penicillin, Amoxicillin, Beef protein"
                  className="doctor-input"
                  value={form.allergies}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group span-2">
                <label htmlFor="pet-chronic" className="doctor-label">
                  Chronic Conditions & Medical History <span className="label-hint">(comma-separated)</span>
                </label>
                <input
                  id="pet-chronic"
                  name="chronic_conditions"
                  type="text"
                  placeholder="e.g. Renal insufficiency, Canine atopic dermatitis"
                  className="doctor-input"
                  value={form.chronic_conditions}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Guardian / Pet Parent Information */}
          <div className="doctor-form-section">
            <div className="section-title-row">
              <User size={18} className="section-icon" />
              <h3 className="section-title">Guardian & Contact Information</h3>
            </div>

            <div className="doctor-form-grid">
              <div className="doctor-input-group">
                <label htmlFor="owner-name" className="doctor-label">Guardian / Owner Name</label>
                <input
                  id="owner-name"
                  name="owner_name"
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  className="doctor-input"
                  value={form.owner_name}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group">
                <label htmlFor="owner-phone" className="doctor-label">Phone Number</label>
                <input
                  id="owner-phone"
                  name="owner_phone"
                  type="tel"
                  placeholder="e.g. +1 (555) 345-6789"
                  className="doctor-input"
                  value={form.owner_phone}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group">
                <label htmlFor="owner-email" className="doctor-label">Email Address</label>
                <input
                  id="owner-email"
                  name="owner_email"
                  type="email"
                  placeholder="e.g. sarah.jenkins@example.com"
                  className="doctor-input"
                  value={form.owner_email}
                  onChange={handleChange}
                />
              </div>

              <div className="doctor-input-group">
                <label htmlFor="owner-address" className="doctor-label">Residential Address</label>
                <input
                  id="owner-address"
                  name="owner_address"
                  type="text"
                  placeholder="e.g. 124 Oak Street, Portland, OR"
                  className="doctor-input"
                  value={form.owner_address}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="doctor-form-footer">
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={handleReset}
              disabled={submitting}
            >
              <RotateCcw size={15} />
              <span>Reset Form</span>
            </button>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spin-icon">⏳</span>
                  <span>Registering Patient...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Register Patient & Open Chart</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

