import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Heart, Building2, Bell, CheckCircle2,
  AlertCircle, ShieldCheck, Save, Edit3, X, RefreshCw
} from 'lucide-react';
import { ownerFetch } from '../../api/ownerClient';

export function OwnerSettingsTab() {
  const [profile, setProfile] = useState(null);
  const [pets, setPets] = useState([]);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPet, setSavingPet] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Editable Guardian Profile State
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    phone: '',
    address: '',
  });

  // Editable Pet Details State (Modal)
  const [editingPet, setEditingPet] = useState(null);
  const [petForm, setPetForm] = useState({
    name: '',
    weightKg: '',
    ageYears: '',
    allergies: '',
    chronicConditions: '',
  });

  const loadSettingsAndPets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profRes, petsRes] = await Promise.all([
        ownerFetch('/api/v1/owner-portal/me'),
        ownerFetch('/api/v1/owner-portal/pets'),
      ]);

      const [profData, petsData] = await Promise.all([
        profRes.json(),
        petsRes.json(),
      ]);

      if (profData.success) {
        setProfile(profData.data);
        setEmailEnabled(profData.data.email_enabled !== false);
        setOwnerForm({
          name: profData.data.name || '',
          phone: profData.data.phone || '',
          address: profData.data.address || '',
        });
      }
      if (petsData.success) {
        setPets(petsData.data || []);
      }
    } catch (err) {
      setError('Failed to load guardian profile and pet settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsAndPets();
  }, [loadSettingsAndPets]);

  // Save Guardian Profile Details
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setMsg('');
    setError('');
    try {
      const res = await ownerFetch('/api/v1/owner-portal/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ownerForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }
      setMsg('Guardian profile details successfully updated and saved.');
      await loadSettingsAndPets();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Edit Pet Modal
  const handleOpenEditPet = (pet) => {
    setEditingPet(pet);
    const allergiesStr = Array.isArray(pet.allergies)
      ? pet.allergies.join(', ')
      : typeof pet.allergies === 'string'
      ? pet.allergies
      : '';
    const conditionsStr = Array.isArray(pet.chronic_conditions)
      ? pet.chronic_conditions.join(', ')
      : typeof pet.chronic_conditions === 'string'
      ? pet.chronic_conditions
      : '';

    setPetForm({
      name: pet.name || '',
      weightKg: pet.weight_kg != null ? String(pet.weight_kg) : '',
      ageYears: pet.age_years != null ? String(pet.age_years) : '',
      allergies: allergiesStr,
      chronicConditions: conditionsStr,
    });
  };

  // Save Pet Details
  const handleSavePet = async (e) => {
    e.preventDefault();
    if (!editingPet) return;
    setSavingPet(true);
    setMsg('');
    setError('');
    try {
      const allergiesArr = petForm.allergies
        ? petForm.allergies.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const conditionsArr = petForm.chronicConditions
        ? petForm.chronicConditions.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const res = await ownerFetch(`/api/v1/owner-portal/pets/${editingPet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: petForm.name,
          weightKg: petForm.weightKg ? parseFloat(petForm.weightKg) : null,
          ageYears: petForm.ageYears ? parseFloat(petForm.ageYears) : null,
          allergies: allergiesArr,
          chronicConditions: conditionsArr,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update pet details.');
      }
      setMsg(`Details for ${petForm.name} saved successfully.`);
      setEditingPet(null);
      await loadSettingsAndPets();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPet(false);
    }
  };

  const handleToggleEmail = async (checked) => {
    setEmailEnabled(checked);
    setMsg('');
    setError('');
    try {
      const res = await ownerFetch('/api/v1/owner-portal/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailEnabled: checked }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save preference');
      }
      setMsg('Email notification preferences successfully updated.');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.message);
      setEmailEnabled(!checked);
    }
  };

  if (loading) {
    return (
      <div className="owner-tab-content">
        <p className="table-empty-message">Loading settings &amp; pet details...</p>
      </div>
    );
  }

  return (
    <div className="owner-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Guardian Profile &amp; Pet Details Settings</h3>
          <p>
            Edit and update guardian contact information, manage pet vitals, and adjust communication preferences.
          </p>
        </div>
      </div>

      {msg && (
        <div className="admin-badge badge-active admin-alert-banner">
          <CheckCircle2 size={16} />
          <span>{msg}</span>
        </div>
      )}

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="owner-settings-grid">
        {/* 1. EDITABLE GUARDIAN PROFILE CARD */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-header-icon" aria-hidden="true">
              <User size={18} />
            </div>
            <h3 className="settings-card-title">Edit Guardian Profile</h3>
          </div>
          <div className="settings-card-body">
            <form onSubmit={handleSaveProfile}>
              <div className="admin-form-group">
                <label className="form-label" htmlFor="owner-name-input">Full Legal Name *</label>
                <input
                  id="owner-name-input"
                  type="text"
                  className="admin-form-control"
                  value={ownerForm.name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="admin-form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="form-label" htmlFor="owner-phone-input">Mobile Phone Contact</label>
                <input
                  id="owner-phone-input"
                  type="tel"
                  className="admin-form-control"
                  placeholder="e.g. +1 555-0199"
                  value={ownerForm.phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                />
              </div>

              <div className="admin-form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="form-label" htmlFor="owner-address-input">Home / Postal Address</label>
                <input
                  id="owner-address-input"
                  type="text"
                  className="admin-form-control"
                  placeholder="e.g. 123 Elm St, San Francisco, CA"
                  value={ownerForm.address}
                  onChange={(e) => setOwnerForm({ ...ownerForm, address: e.target.value })}
                />
              </div>

              <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={savingProfile}
                >
                  <Save size={15} />
                  <span>{savingProfile ? 'Saving...' : 'Save Guardian Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 2. PET DETAILS EDIT CARD */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-header-icon" aria-hidden="true">
              <Heart size={18} />
            </div>
            <h3 className="settings-card-title">Manage Registered Pet Details</h3>
          </div>
          <div className="settings-card-body">
            <p className="admin-meta-sub" style={{ marginBottom: 'var(--space-3)' }}>
              Keep companion weights, ages, and medical allergy tags updated for clinical visits.
            </p>

            {pets.length === 0 ? (
              <p className="table-empty-message">No registered pets to manage.</p>
            ) : (
              <div className="owner-pets-mini-list">
                {pets.map((pet) => (
                  <div key={pet.id} className="owner-pet-mini-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="pet-mini-info">
                      <strong>{pet.name}</strong>
                      <span className="admin-meta-sub">
                        {pet.species} • {pet.weight_kg ? `${pet.weight_kg} kg` : 'Weight not set'} • {pet.age_years ? `${pet.age_years} yrs` : 'Age not set'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="admin-btn admin-btn-outline admin-btn-sm"
                      onClick={() => handleOpenEditPet(pet)}
                      title={`Edit ${pet.name} details`}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. EMAIL NOTIFICATIONS CARD */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-header-icon" aria-hidden="true">
              <Bell size={18} />
            </div>
            <h3 className="settings-card-title">Communication Channel</h3>
          </div>
          <div className="settings-card-body">
            <div className="preference-toggle-item">
              <div className="preference-text">
                <span className="preference-title">Email Notifications</span>
                <span className="preference-desc">
                  Receive verified veterinary prescriptions, discharge care directives, and digital recording consent notices via email.
                </span>
              </div>
              <label className="switch-toggle" htmlFor="email-toggle">
                <input
                  id="email-toggle"
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => handleToggleEmail(e.target.checked)}
                />
                <span className="slider" aria-hidden="true" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT PET DETAILS MODAL */}
      {editingPet && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-pet-modal-title">
          <div className="modal-content owner-modal-lg">
            <div className="modal-header">
              <div className="modal-header-text">
                <h3 id="edit-pet-modal-title" className="modal-title">Edit Details for {editingPet.name}</h3>
                <p className="modal-subtitle">Update body weight, age, critical allergies, and chronic conditions.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingPet(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePet} className="owner-modal-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-pet-name">Pet Name *</label>
                  <input
                    id="edit-pet-name"
                    type="text"
                    className="form-control"
                    value={petForm.name}
                    onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-pet-weight">Weight (kg)</label>
                  <input
                    id="edit-pet-weight"
                    type="number"
                    step="0.1"
                    className="form-control"
                    placeholder="e.g. 14.5"
                    value={petForm.weightKg}
                    onChange={(e) => setPetForm({ ...petForm, weightKg: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2" style={{ marginTop: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-pet-age">Age (Years)</label>
                  <input
                    id="edit-pet-age"
                    type="number"
                    step="0.5"
                    className="form-control"
                    placeholder="e.g. 3.5"
                    value={petForm.ageYears}
                    onChange={(e) => setPetForm({ ...petForm, ageYears: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-pet-allergies">Known Allergies (comma-separated)</label>
                  <input
                    id="edit-pet-allergies"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Penicillin, Chicken, Flea bites"
                    value={petForm.allergies}
                    onChange={(e) => setPetForm({ ...petForm, allergies: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => setEditingPet(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={savingPet}
                >
                  <Save size={15} />
                  <span>{savingPet ? 'Saving...' : 'Save Pet Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
