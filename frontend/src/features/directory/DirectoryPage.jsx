import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stethoscope, Heart, Plus, Trash2, CheckCircle2,
  AlertCircle, RotateCcw, Shield, Search,
  Users, Activity, Calendar, ArrowRight, User
} from 'lucide-react';

export function DirectoryPage({
  activeDoctorId,
  onSelectActiveDoctor,
  onNavigateConsultation,
}) {
  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors' | 'pets'
  const [doctors, setDoctors] = useState([]);
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Doctor Form State
  const initialDoctorForm = { name: '', email: '', role: 'veterinarian' };
  const [doctorForm, setDoctorForm] = useState(initialDoctorForm);

  // Pet Form State
  const initialPetForm = {
    name: '',
    species: 'Canine (Dog)',
    breed: '',
    age_years: '',
    weight_kg: '',
    owner_name: '',
    owner_contact: '',
  };
  const [petForm, setPetForm] = useState(initialPetForm);

  // ─── Fetch Doctors & Pets ──────────────────────────────────────────────────
  const fetchDirectory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docsRes, petsRes] = await Promise.all([
        fetch('/api/v1/directory/doctors'),
        fetch('/api/v1/directory/pets'),
      ]);
      const docsData = await docsRes.json();
      const petsData = await petsRes.json();

      if (docsData.success) setDoctors(docsData.data);
      if (petsData.success) setPets(petsData.data);
    } catch (err) {
      setFeedback({ type: 'error', message: `Failed to load directory: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  // ─── Active Doctor Object ──────────────────────────────────────────────────
  const activeDoctor = useMemo(() => {
    return doctors.find((d) => d.id === activeDoctorId) || doctors[0];
  }, [doctors, activeDoctorId]);

  // ─── Filtered Data ─────────────────────────────────────────────────────────
  const filteredDoctors = useMemo(() => {
    if (!searchTerm.trim()) return doctors;
    const term = searchTerm.toLowerCase();
    return doctors.filter((d) =>
      d.name?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.role?.toLowerCase().includes(term)
    );
  }, [doctors, searchTerm]);

  const filteredPets = useMemo(() => {
    if (!searchTerm.trim()) return pets;
    const term = searchTerm.toLowerCase();
    return pets.filter((p) =>
      p.name?.toLowerCase().includes(term) ||
      p.species?.toLowerCase().includes(term) ||
      p.breed?.toLowerCase().includes(term) ||
      p.owner_name?.toLowerCase().includes(term)
    );
  }, [pets, searchTerm]);

  // ─── DOCTORS ACTIONS ────────────────────────────────────────────────────────
  const handleClearDoctorForm = () => {
    setDoctorForm(initialDoctorForm);
    setFeedback({ type: 'success', message: 'Doctor form cleared.' });
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!doctorForm.name.trim() || !doctorForm.email.trim()) {
      setFeedback({ type: 'error', message: 'Doctor Name and Email are required.' });
      return;
    }

    try {
      const res = await fetch('/api/v1/directory/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doctorForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with status ${res.status}`);

      setFeedback({ type: 'success', message: `✅ Added ${data.data.name} to Doctors directory!` });
      setDoctorForm(initialDoctorForm);
      await fetchDirectory();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteDoctor = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name} (#${id})?`)) return;
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/directory/doctors/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with status ${res.status}`);

      setFeedback({ type: 'success', message: `✅ Deleted doctor #${id} (${name}).` });
      await fetchDirectory();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // ─── PETS ACTIONS ───────────────────────────────────────────────────────────
  const handleClearPetForm = () => {
    setPetForm(initialPetForm);
    setFeedback({ type: 'success', message: 'Pet form cleared.' });
  };

  const handleAddPet = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!petForm.name.trim() || !petForm.species.trim()) {
      setFeedback({ type: 'error', message: 'Pet Name and Species are required.' });
      return;
    }

    try {
      const res = await fetch('/api/v1/directory/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(petForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with status ${res.status}`);

      setFeedback({ type: 'success', message: `✅ Added ${data.data.name} (${data.data.species}) to PetCare directory!` });
      setPetForm(initialPetForm);
      await fetchDirectory();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeletePet = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name} (#${id}) and its consultations?`)) return;
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/directory/pets/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with status ${res.status}`);

      setFeedback({ type: 'success', message: `✅ Deleted pet #${id} (${name}).` });
      await fetchDirectory();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="directory-page-wrapper consultation-workspace">
      {/* ─── Executive Page Header ─── */}
      <div className="directory-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="directory-header-icon-box">
            <Users size={24} color="#0284c7" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Directory Management — Doctors & PetCare
            </h1>
            <p style={{ fontSize: '0.86rem', color: '#64748b', marginTop: '2px', margin: 0 }}>
              Centralized hospital directory for attending veterinarians, registered patients, and clinical assignment.
            </p>
          </div>
        </div>

        {onNavigateConsultation && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigateConsultation()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          >
            <Stethoscope size={16} />
            <span>Go to Live Scribe Workspace</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* ─── KPI Summary Cards ─── */}
      <div className="directory-stats-grid">
        <div className="directory-stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Attending Veterinarians</span>
            <Stethoscope size={18} color="#7c3aed" />
          </div>
          <div className="stat-card-value">{doctors.length}</div>
          <div className="stat-card-sub">
            Active: <strong>{activeDoctor?.name || (doctors.length > 0 ? doctors[0].name : 'None registered')}</strong>
          </div>
        </div>

        <div className="directory-stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Registered Patients</span>
            <Heart size={18} color="#e11d48" />
          </div>
          <div className="stat-card-value">{pets.length}</div>
          <div className="stat-card-sub">
            Canine & Feline registered patients
          </div>
        </div>

        <div className="directory-stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Clinical Safety Status</span>
            <Shield size={18} color="#059669" />
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.25rem', color: '#059669' }}>Active</div>
          <div className="stat-card-sub">
            Zod validation & PostgreSQL sync
          </div>
        </div>
      </div>

      {/* ─── Main Content Container (Includes modal-content for E2E backward compatibility) ─── */}
      <div className="directory-main-card modal-content" style={{ maxWidth: '100%', maxHeight: 'none', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
        {/* Navigation & Search Bar Header */}
        <div className="directory-toolbar-row">
          {/* Tab Selection */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${activeTab === 'doctors' ? 'active' : ''}`}
              onClick={() => { setActiveTab('doctors'); setFeedback(null); setSearchTerm(''); }}
            >
              <Stethoscope size={14} color={activeTab === 'doctors' ? '#7c3aed' : '#64748b'} />
              <span>👨‍⚕️ Doctors Directory ({doctors.length})</span>
            </button>

            <button
              type="button"
              className={`segmented-btn ${activeTab === 'pets' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pets'); setFeedback(null); setSearchTerm(''); }}
            >
              <Heart size={14} color={activeTab === 'pets' ? '#e11d48' : '#64748b'} />
              <span>🐾 PetCare Directory ({pets.length})</span>
            </button>
          </div>

          {/* Real-time search filter */}
          <div className="directory-search-box">
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              className="directory-search-input"
              placeholder={activeTab === 'doctors' ? 'Search doctors by name, email, or role...' : 'Search pets by name, breed, or owner...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                onClick={() => setSearchTerm('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div style={{ margin: '16px 24px 0 24px' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: feedback.type === 'success' ? '#ecfdf5' : '#fff1f2',
                border: feedback.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecdd3',
                color: feedback.type === 'success' ? '#065f46' : '#be123c',
              }}
            >
              {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{feedback.message}</span>
            </div>
          </div>
        )}

        <div style={{ padding: '24px' }}>
          {/* ──────────────────────────────────────────────────────────────────────────
              TAB 1: DOCTORS DIRECTORY (2-COLUMN MASTER-DETAIL SAAS LAYOUT)
             ────────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'doctors' && (
            <div className="directory-columns-layout">
              {/* Left Column: Add Doctor Form */}
              <div className="directory-form-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                    <Plus size={16} color="#0284c7" /> Add New Doctor
                  </h3>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    onClick={handleClearDoctorForm}
                    title="Clear input fields"
                  >
                    <RotateCcw size={12} /> Clear
                  </button>
                </div>

                <form onSubmit={handleAddDoctor}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Doctor Name *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Dr. Jordan Lee, DVM"
                        value={doctorForm.name}
                        onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="e.g. jordan.lee@petcare.vet"
                        value={doctorForm.email}
                        onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Specialty / Role
                      </label>
                      <select
                        className="form-control"
                        value={doctorForm.role}
                        onChange={(e) => setDoctorForm({ ...doctorForm, role: e.target.value })}
                      >
                        <option value="veterinarian">General Veterinarian</option>
                        <option value="surgeon">Veterinary Surgeon</option>
                        <option value="cardiologist">Veterinary Cardiologist</option>
                        <option value="dermatologist">Veterinary Dermatologist</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                      <button type="button" className="btn btn-outline" onClick={handleClearDoctorForm}>
                        Clear
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <Plus size={14} /> Add Doctor
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column: Check / Table List of Doctors */}
              <div className="directory-table-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 750, color: '#0f172a', margin: 0 }}>
                    Registered Doctors Directory ({filteredDoctors.length})
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Click "Set Active" to assign doctor as default scribe author
                  </span>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>#ID</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Doctor Name</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Email</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Specialty</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDoctors.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                            No doctors matching query.
                          </td>
                        </tr>
                      ) : (
                        filteredDoctors.map((doc) => {
                          const isActive = doc.id === activeDoctorId;
                          return (
                            <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9', background: isActive ? '#f0f9ff' : '#fff' }}>
                              <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: '#64748b' }}>
                                #{doc.id}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 650, color: '#0f172a' }}>
                                {doc.name}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#475569' }}>
                                {doc.email}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                                  {doc.role}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {isActive ? (
                                  <span className="badge badge-success" style={{ padding: '3px 8px' }}>
                                    <CheckCircle2 size={11} /> Active Attending
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Available</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center' }}>
                                  {!isActive && onSelectActiveDoctor && (
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                      onClick={() => onSelectActiveDoctor(doc.id)}
                                      title="Set this doctor as active attending veterinarian"
                                    >
                                      Set Active
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ padding: '4px 8px', color: '#e11d48', borderColor: '#fecdd3' }}
                                    onClick={() => handleDeleteDoctor(doc.id, doc.name)}
                                    title="Delete doctor"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────────────
              TAB 2: PETCARE DIRECTORY (2-COLUMN MASTER-DETAIL SAAS LAYOUT)
             ────────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'pets' && (
            <div className="directory-columns-layout">
              {/* Left Column: Add Pet Form */}
              <div className="directory-form-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                    <Plus size={16} color="#0284c7" /> Add New Patient (Pet)
                  </h3>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    onClick={handleClearPetForm}
                    title="Clear input fields"
                  >
                    <RotateCcw size={12} /> Clear
                  </button>
                </div>

                <form onSubmit={handleAddPet}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Patient Name *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Charlie"
                        value={petForm.name}
                        onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Species *
                        </label>
                        <select
                          className="form-control"
                          value={petForm.species}
                          onChange={(e) => setPetForm({ ...petForm, species: e.target.value })}
                        >
                          <option value="Canine (Dog)">Canine (Dog)</option>
                          <option value="Feline (Cat)">Feline (Cat)</option>
                          <option value="Avian (Bird)">Avian (Bird)</option>
                          <option value="Exotic / Small Animal">Exotic / Small Animal</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Breed
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Golden Retriever"
                          value={petForm.breed}
                          onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Age (Years)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          className="form-control"
                          placeholder="e.g. 3"
                          value={petForm.age_years}
                          onChange={(e) => setPetForm({ ...petForm, age_years: e.target.value })}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-control"
                          placeholder="e.g. 12.5"
                          value={petForm.weight_kg}
                          onChange={(e) => setPetForm({ ...petForm, weight_kg: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Owner Full Name *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Alice Cooper"
                        value={petForm.owner_name}
                        onChange={(e) => setPetForm({ ...petForm, owner_name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Owner Contact / Phone
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. +1 555-0199"
                        value={petForm.owner_contact}
                        onChange={(e) => setPetForm({ ...petForm, owner_contact: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                      <button type="button" className="btn btn-outline" onClick={handleClearPetForm}>
                        Clear
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <Plus size={14} /> Add Pet
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column: Check / Table List of Pets */}
              <div className="directory-table-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 750, color: '#0f172a', margin: 0 }}>
                    Registered Patients Directory ({filteredPets.length})
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Click "Start Scribe" to begin a live consultation for any patient
                  </span>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>#ID</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Patient Name</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Species / Breed</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Age / Weight</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700 }}>Owner Details</th>
                        <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPets.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                            No patients matching query.
                          </td>
                        </tr>
                      ) : (
                        filteredPets.map((p) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: '#64748b' }}>
                              #{p.id}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                              {p.name}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className="badge badge-info" style={{ marginRight: '6px' }}>{p.species}</span>
                              <span style={{ color: '#64748b', fontSize: '0.80rem' }}>{p.breed || 'Mixed'}</span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>
                              {p.age_years ? `${p.age_years} yrs` : '—'} • {p.weight_kg ? `${p.weight_kg} kg` : '—'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <strong style={{ color: '#0f172a' }}>{p.owner_name}</strong>
                              {p.owner_contact && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.owner_contact}</div>}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center' }}>
                                {onNavigateConsultation && (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#0284c7', borderColor: '#bae6fd' }}
                                    onClick={() => onNavigateConsultation(p.id)}
                                    title={`Start new consultation for ${p.name}`}
                                  >
                                    <Stethoscope size={12} /> Start Scribe
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', color: '#e11d48', borderColor: '#fecdd3' }}
                                  onClick={() => handleDeletePet(p.id, p.name)}
                                  title={`Delete ${p.name}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

