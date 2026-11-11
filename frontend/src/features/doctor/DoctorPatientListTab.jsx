import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, FileText, AlertTriangle, CheckCircle,
  Plus, RefreshCw, User, Phone
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { PatientClinicalChart } from './PatientClinicalChart';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { PaginationControl } from '../../components/common/PaginationControl';

export function DoctorPatientListTab({ onStartConsultation, onNavigateAddPatient }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('ALL');
  const [selectedPetIdForChart, setSelectedPetIdForChart] = useState(null);

  // Universal Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [paginationMeta, setPaginationMeta] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const fetchPets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (selectedSpecies && selectedSpecies !== 'ALL') {
        params.set('species', selectedSpecies);
      }

      const res = await apiClient(`/api/v1/pets?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPets(json.data || []);
        if (json.pagination) {
          setPaginationMeta(json.pagination);
        } else {
          setPaginationMeta({
            page,
            limit,
            total: json.total || (json.data || []).length,
            totalPages: Math.ceil(((json.total || (json.data || []).length) || 1) / limit),
            hasNext: false,
            hasPrev: false,
          });
        }
      } else {
        setError(json.error || 'Failed to load clinic patient directory.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching patient directory.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, selectedSpecies]);

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  const speciesFilterOptions = [
    { value: 'ALL', label: 'All Species' },
    { value: 'canine', label: '🐶 Dogs' },
    { value: 'feline', label: '🐱 Cats' },
    { value: 'avian', label: '🦜 Birds' },
    { value: 'exotic', label: '🦎 Exotic / Other' },
  ];

  const getSpeciesEmoji = (species = '') => {
    const s = species.toLowerCase();
    if (s.includes('cat') || s.includes('feline')) return '🐱';
    if (s.includes('bird') || s.includes('avian') || s.includes('parrot')) return '🦜';
    if (s.includes('rabbit') || s.includes('bunny')) return '🐰';
    if (s.includes('horse') || s.includes('equine')) return '🐴';
    if (s.includes('reptile') || s.includes('snake') || s.includes('lizard')) return '🦎';
    return '🐶';
  };

  // If a patient is selected, display the full-width inline Clinical Chart Workspace
  if (selectedPetIdForChart) {
    return (
      <div className="doctor-tab-container">
        <PatientClinicalChart
          petId={selectedPetIdForChart}
          isInline={true}
          onClose={() => setSelectedPetIdForChart(null)}
          onLaunchConsultation={onStartConsultation}
        />
      </div>
    );
  }

  return (
    <div className="doctor-tab-container">
      {/* Tab Header Controls */}
      <div className="doctor-tab-header">
        <div className="doctor-tab-title-group">
          <h2 className="doctor-tab-heading">Patient Directory &amp; Clinical Charts</h2>
          <p className="doctor-tab-subheading">
            Access complete veterinary medical records, AI clinical summaries, active prescriptions, and past visit timelines.
          </p>
        </div>

        <div className="doctor-tab-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={fetchPets}
            disabled={loading}
            title="Refresh patient list"
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          {onNavigateAddPatient && (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={onNavigateAddPatient}
              title="Register a new patient"
            >
              <Plus size={16} />
              <span>Register Patient</span>
            </button>
          )}
        </div>
      </div>

      {/* Universal Search & Species Filter Bar */}
      <SearchFilterBar
        searchPlaceholder="Search by pet name, breed, guardian name, phone, or microchip..."
        searchValue={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setPage(1);
        }}
        filterOptions={speciesFilterOptions}
        filterValue={selectedSpecies}
        onFilterChange={(val) => {
          setSelectedSpecies(val);
          setPage(1);
        }}
        filterLabel="Species"
        onRefresh={fetchPets}
        isLoading={loading}
        totalResults={paginationMeta.total}
      />

      {/* Error Banner */}
      {error && (
        <div className="doctor-error-banner" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={fetchPets} className="doctor-retry-btn">Retry</button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && pets.length === 0 && (
        <div className="doctor-loading-grid">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="doctor-patient-card-skeleton animate-pulse" />
          ))}
        </div>
      )}

      {/* Patient Grid / Cards */}
      {!loading && pets.length === 0 ? (
        <div className="doctor-empty-state">
          <div className="doctor-empty-icon">🐾</div>
          <h3>No patients found</h3>
          <p>
            {searchTerm || selectedSpecies !== 'ALL'
              ? 'No patients match your current filter criteria. Try clearing the search or switching species.'
              : 'There are no registered patients in your clinic yet.'}
          </p>
          {(searchTerm || selectedSpecies !== 'ALL') ? (
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => { setSearchTerm(''); setSelectedSpecies('ALL'); setPage(1); }}
            >
              Clear Filters
            </button>
          ) : (
            onNavigateAddPatient && (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={onNavigateAddPatient}
              >
                <Plus size={16} />
                <span>Register First Patient</span>
              </button>
            )
          )}
        </div>
      ) : (
        <div className="doctor-patients-grid">
          {pets.map((pet) => {
            const allergyArr = Array.isArray(pet.allergies)
              ? pet.allergies
              : typeof pet.allergies === 'string'
              ? [pet.allergies]
              : [];
            const hasAllergies = allergyArr.length > 0;

            return (
              <div
                key={pet.id}
                className="doctor-patient-card"
                onClick={() => setSelectedPetIdForChart(pet.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPetIdForChart(pet.id);
                  }
                }}
                title={`Open Clinical Chart for ${pet.name}`}
              >
                <div className="patient-card-header">
                  <div className="patient-card-avatar">
                    {getSpeciesEmoji(pet.species)}
                  </div>
                  <div className="patient-card-title-block">
                    <div className="patient-card-name-row">
                      <h3 className="patient-card-name">{pet.name}</h3>
                      <span className="patient-card-badge">
                        {pet.species}
                      </span>
                    </div>
                    <span className="patient-card-breed">
                      {pet.breed || 'Breed not recorded'}
                    </span>
                  </div>
                </div>

                <div className="patient-card-vitals-row">
                  <div className="patient-vital-item">
                    <span className="vital-label">Age</span>
                    <span className="vital-val">{pet.age_years ? `${pet.age_years} yrs` : 'N/A'}</span>
                  </div>
                  <div className="patient-vital-divider" />
                  <div className="patient-vital-item">
                    <span className="vital-label">Weight</span>
                    <span className="vital-val">{pet.weight_kg ? `${pet.weight_kg} kg` : 'N/A'}</span>
                  </div>
                  <div className="patient-vital-divider" />
                  <div className="patient-vital-item">
                    <span className="vital-label">Visits</span>
                    <span className="vital-val">{pet.consultation_count || 0}</span>
                  </div>
                </div>

                {/* Critical Allergy Pill */}
                <div className="patient-card-allergy-row">
                  {hasAllergies ? (
                    <span className="badge-critical-allergy" title={allergyArr.join(', ')}>
                      <AlertTriangle size={13} />
                      <span>Allergies: {allergyArr.join(', ')}</span>
                    </span>
                  ) : (
                    <span className="badge-no-allergies">
                      <CheckCircle size={13} />
                      <span>No known allergies</span>
                    </span>
                  )}
                </div>

                {/* Guardian / Contact Block */}
                <div className="patient-card-guardian">
                  <div className="guardian-info-line">
                    <User size={13} className="guardian-icon" />
                    <span className="guardian-name">{pet.owner_name || 'Pet Guardian'}</span>
                  </div>
                  {(pet.owner_phone || pet.owner_contact) && (
                    <div className="guardian-info-line">
                      <Phone size={13} className="guardian-icon" />
                      <span className="guardian-phone">{pet.owner_phone || pet.owner_contact}</span>
                    </div>
                  )}
                  {pet.microchip_no && (
                    <div className="guardian-microchip">
                      <span>Chip: {pet.microchip_no}</span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="patient-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline patient-card-chart-btn"
                    onClick={() => setSelectedPetIdForChart(pet.id)}
                    title="Open Clinical Chart Modal"
                  >
                    <FileText size={15} />
                    <span>Open Chart</span>
                  </button>

                  <button
                    type="button"
                    className="admin-btn admin-btn-primary patient-card-consult-btn"
                    onClick={() => onStartConsultation && onStartConsultation(pet.id)}
                    title="Start Live Consultation with AI Scribe"
                  >
                    <Stethoscope size={15} />
                    <span>Consult</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Server-Side Pagination Control */}
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
        pageSizeOptions={[6, 12, 24, 48]}
      />
    </div>
  );
}
