import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart, Plus, AlertTriangle, ShieldCheck, Stethoscope, Sparkles, X,
  Activity, Info, RefreshCw, Check
} from 'lucide-react';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';
import { ownerFetch } from '../../api/ownerClient';

export function OwnerPetsTab() {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(6);

  const [form, setForm] = useState({
    name: '',
    species: 'Canine',
    breed: '',
    ageYears: '',
    weightKg: '',
    gender: 'female_spayed',
    microchipId: '',
    allergies: '',
    medicalHistory: '',
  });

  const loadPets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ownerFetch('/api/v1/owner-portal/pets');
      const data = await res.json();
      if (data.success) {
        setPets(data.data || []);
      } else {
        setError(data.error || 'Failed to load registered pets.');
      }
    } catch (err) {
      setError('Network error loading pets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPets();
  }, []);

  const handleRegisterPet = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.species) return;

    setSubmitting(true);
    try {
      const res = await ownerFetch('/api/v1/owner-portal/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register pet.');
      }
      setShowAddModal(false);
      setForm({
        name: '',
        species: 'Canine',
        breed: '',
        ageYears: '',
        weightKg: '',
        gender: 'female_spayed',
        microchipId: '',
        allergies: '',
        medicalHistory: '',
      });
      await loadPets();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getSpeciesEmoji = (species) => {
    const s = (species || '').toLowerCase();
    if (s.includes('canine') || s.includes('dog')) return '🐕';
    if (s.includes('feline') || s.includes('cat')) return '🐈';
    if (s.includes('avian') || s.includes('bird')) return '🦜';
    if (s.includes('reptile')) return '🦎';
    if (s.includes('rabbit') || s.includes('mammal')) return '🐇';
    return '🐾';
  };

  const speciesOptions = [
    { value: '', label: 'All Species' },
    { value: 'canine', label: '🐶 Dogs / Canines' },
    { value: 'feline', label: '🐱 Cats / Felines' },
    { value: 'avian', label: '🦜 Birds' },
    { value: 'other', label: '🦎 Exotic / Other' },
  ];

  const filteredPets = useMemo(() => {
    return pets.filter((p) => {
      if (speciesFilter) {
        const spec = (p.species || '').toLowerCase();
        if (speciesFilter === 'canine' && !spec.includes('dog') && !spec.includes('canine')) return false;
        if (speciesFilter === 'feline' && !spec.includes('cat') && !spec.includes('feline')) return false;
        if (speciesFilter === 'avian' && !spec.includes('bird') && !spec.includes('avian')) return false;
        if (speciesFilter === 'other' && (spec.includes('dog') || spec.includes('canine') || spec.includes('cat') || spec.includes('feline') || spec.includes('bird') || spec.includes('avian'))) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          (p.name || '').toLowerCase().includes(term) ||
          (p.breed || '').toLowerCase().includes(term) ||
          (p.species || '').toLowerCase().includes(term) ||
          (p.microchip_id || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [pets, speciesFilter, searchTerm]);

  const totalPages = Math.ceil(filteredPets.length / limit) || 1;
  const paginatedPets = filteredPets.slice((page - 1) * limit, page * limit);

  return (
    <div className="owner-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>My Registered Pets</h3>
          <p>
            Clinical profiles, critical allergy alerts, and verified health records for your family animals.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} />
          <span>Register New Pet</span>
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Animal Companion Profiles</h3>
            <p className="admin-card-subtitle">Manage animal vitals, allergy tags, and primary clinician affiliations.</p>
          </div>
          <span className="admin-badge badge-active">
            {filteredPets.length} {filteredPets.length === 1 ? 'Companion' : 'Companions'}
          </span>
        </div>

        <div className="admin-card-body">
          {/* Universal Search & Species Filter */}
          <SearchFilterBar
            searchPlaceholder="Search by pet name, breed, or microchip..."
            searchValue={searchTerm}
            onSearchChange={(val) => {
              setSearchTerm(val);
              setPage(1);
            }}
            filterOptions={speciesOptions}
            filterValue={speciesFilter}
            onFilterChange={(val) => {
              setSpeciesFilter(val);
              setPage(1);
            }}
            filterLabel="Species"
            onRefresh={loadPets}
            isLoading={loading}
            totalResults={filteredPets.length}
          />

          {loading && (
            <div className="owner-state-card loading">
              <div className="verify-spinner" aria-hidden="true" />
              <p>Retrieving your pets from clinic registry...</p>
            </div>
          )}

          {!loading && error && (
            <div className="admin-badge badge-danger admin-alert-banner">
              <AlertTriangle size={18} className="auth-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && pets.length === 0 && (
            <div className="doctor-empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
              <Heart size={36} />
              <h4>No registered pets found</h4>
              <p>
                You haven't linked any pets to your guardian profile yet. Register your pet to access clinical records and prescriptions.
              </p>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => setShowAddModal(true)}
                style={{ marginTop: 'var(--space-3)' }}
              >
                <Plus size={16} />
                <span>Register Your Pet Now</span>
              </button>
            </div>
          )}

          {!loading && filteredPets.length > 0 && (
            <>
              <div className="owner-pets-grid">
                {paginatedPets.map((pet) => (
                  <div key={pet.id} className="owner-pet-card">
                    <div className="owner-pet-card-header">
                      <div className="owner-pet-avatar">
                        <span className="owner-pet-emoji" aria-hidden="true">
                          {getSpeciesEmoji(pet.species)}
                        </span>
                      </div>
                      <div className="owner-pet-title-block">
                        <div className="owner-pet-name-row">
                          <h3 className="owner-pet-name">{pet.name}</h3>
                          <span className="owner-pet-species-pill">{pet.species}</span>
                        </div>
                        <span className="owner-pet-meta">
                          {pet.breed || 'Mixed Breed'} • {pet.sex || pet.gender ? (pet.sex || pet.gender).replace('_', ' ') : 'Pet'}
                        </span>
                      </div>
                    </div>

                    {/* Allergy Warning or Safe Tag */}
                    {pet.allergies ? (
                      <div className="owner-pet-allergy-alert">
                        <AlertTriangle size={16} className="allergy-icon" />
                        <div className="allergy-content">
                          <strong className="allergy-label">Critical Allergies:</strong>
                          <span className="allergy-text">{pet.allergies}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="owner-pet-safe-badge">
                        <ShieldCheck size={14} />
                        <span>No recorded drug or food allergies</span>
                      </div>
                    )}

                    {/* Vitals Grid */}
                    <div className="owner-pet-stats-grid">
                      <div className="owner-pet-stat">
                        <span className="owner-pet-stat-label">Age</span>
                        <span className="owner-pet-stat-value">
                          {pet.age_years ? `${pet.age_years} yrs` : 'Unknown'}
                        </span>
                      </div>
                      <div className="owner-pet-stat">
                        <span className="owner-pet-stat-label">Weight</span>
                        <span className="owner-pet-stat-value">
                          {pet.weight_kg ? `${pet.weight_kg} kg` : 'N/A'}
                        </span>
                      </div>
                      <div className="owner-pet-stat">
                        <span className="owner-pet-stat-label">Gender / Sex</span>
                        <span className="owner-pet-stat-value capitalize">
                          {pet.sex || pet.gender ? (pet.sex || pet.gender).replace('_', ' ') : 'Unknown'}
                        </span>
                      </div>
                      <div className="owner-pet-stat">
                        <span className="owner-pet-stat-label">Microchip ID</span>
                        <span className="owner-pet-stat-value font-mono">
                          {pet.microchip_id || 'Not chipped'}
                        </span>
                      </div>
                    </div>

                    {/* Attending Doctor Row */}
                    <div className="owner-pet-vet-row">
                      <Stethoscope size={14} className="vet-row-icon" />
                      <span>Primary Care Vet: <strong>{pet.primary_doctor_name || 'Central Valley Veterinary Staff'}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationControl
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredPets.length}
                pageSize={limit}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(sz) => {
                  setLimit(sz);
                  setPage(1);
                }}
                pageSizeOptions={[6, 12, 24]}
              />
            </>
          )}
        </div>
      </div>

      {/* Register Pet Modal */}
      {showAddModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="register-pet-title">
          <div className="modal-content owner-modal-lg">
            <div className="modal-header">
              <div className="modal-header-text">
                <h3 id="register-pet-title" className="modal-title">Register New Pet</h3>
                <p className="modal-subtitle">Add a new family companion to Central Valley Animal Hospital registry.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterPet} className="owner-modal-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pet-name">Pet Name *</label>
                  <input
                    id="pet-name"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Luna or Charlie"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pet-species">Species *</label>
                  <select
                    id="pet-species"
                    className="form-control"
                    value={form.species}
                    onChange={(e) => setForm({ ...form, species: e.target.value })}
                    required
                  >
                    <option value="Canine">Canine (Dog)</option>
                    <option value="Feline">Feline (Cat)</option>
                    <option value="Avian">Avian (Bird)</option>
                    <option value="Reptile">Reptile</option>
                    <option value="Small Mammal">Small Mammal (Rabbit, etc.)</option>
                    <option value="Other">Other Species</option>
                  </select>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label" htmlFor="pet-breed">Breed</label>
                  <input
                    id="pet-breed"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Golden Retriever"
                    value={form.breed}
                    onChange={(e) => setForm({ ...form, breed: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pet-age">Age (Years)</label>
                  <input
                    id="pet-age"
                    type="number"
                    step="0.5"
                    className="form-control"
                    placeholder="e.g. 3.5"
                    value={form.ageYears}
                    onChange={(e) => setForm({ ...form, ageYears: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pet-weight">Weight (kg)</label>
                  <input
                    id="pet-weight"
                    type="number"
                    step="0.1"
                    className="form-control"
                    placeholder="e.g. 14.2"
                    value={form.weightKg}
                    onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pet-gender">Sex & Reproductive Status</label>
                  <select
                    id="pet-gender"
                    className="form-control"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="female_spayed">Female (Spayed)</option>
                    <option value="female_intact">Female (Intact)</option>
                    <option value="male_neutered">Male (Neutered)</option>
                    <option value="male_intact">Male (Intact)</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pet-microchip">Microchip ID</label>
                  <input
                    id="pet-microchip"
                    type="text"
                    className="form-control font-mono"
                    placeholder="e.g. 985141002345678"
                    value={form.microchipId}
                    onChange={(e) => setForm({ ...form, microchipId: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pet-allergies">
                  Known Drug or Food Allergies
                </label>
                <input
                  id="pet-allergies"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Penicillin, Chicken, Beef (Leave blank if none)"
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                />
              </div>

              <div className="owner-modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
