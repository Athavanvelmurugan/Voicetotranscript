import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Stethoscope, Heart, Plus, Trash2, CheckCircle2,
  AlertCircle, RotateCcw, UserCheck, Shield
} from 'lucide-react';

export function DirectoryModal({
  isOpen,
  onClose,
  activeDoctorId,
  onSelectActiveDoctor,
  onRefreshData,
}) {
  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors' | 'pets'
  const [doctors, setDoctors] = useState([]);
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (isOpen) {
      fetchDirectory();
      setFeedback(null);
    }
  }, [isOpen, fetchDirectory]);

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
      if (onRefreshData) onRefreshData();
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
      if (onRefreshData) onRefreshData();
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
      if (onRefreshData) onRefreshData();
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
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="#0284c7" />
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Directory Management — Doctors & PetCare
            </h2>
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'doctors' ? 'btn-primary' : 'btn-outline'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            onClick={() => { setActiveTab('doctors'); setFeedback(null); }}
          >
            <Stethoscope size={15} />
            👨‍⚕️ Doctors Directory ({doctors.length})
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'pets' ? 'btn-primary' : 'btn-outline'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            onClick={() => { setActiveTab('pets'); setFeedback(null); }}
          >
            <Heart size={15} />
            🐾 PetCare Directory ({pets.length})
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div style={{
            margin: '12px 20px 0',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fee2e2',
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Modal Body with Scroll */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '18px 20px' }}>
          {/* ══════════════════ TAB 1: DOCTORS ══════════════════ */}
          {activeTab === 'doctors' && (
            <div>
              {/* ADD DOCTOR FORM */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                    <Plus size={16} color="#0284c7" /> Add New Doctor
                  </h3>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={handleClearDoctorForm}
                    title="Clear input fields"
                  >
                    <RotateCcw size={12} /> Clear
                  </button>
                </div>

                <form onSubmit={handleAddDoctor}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                    <button type="button" className="btn btn-outline" onClick={handleClearDoctorForm}>
                      Clear
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <Plus size={14} /> Add Doctor
                    </button>
                  </div>
                </form>
              </div>

              {/* CHECK / LIST DOCTORS */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                Registered Doctors Directory ({doctors.length})
              </h3>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>ID</th>
                      <th style={{ padding: '8px 12px' }}>Doctor Name</th>
                      <th style={{ padding: '8px 12px' }}>Email</th>
                      <th style={{ padding: '8px 12px' }}>Role</th>
                      <th style={{ padding: '8px 12px' }}>Consultations</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doc) => {
                      const isActive = doc.id === activeDoctorId;
                      return (
                        <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9', background: isActive ? '#f0f9ff' : 'white' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700 }}>#{doc.id}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                            {doc.name}
                            {isActive && (
                              <span className="badge badge-success" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>
                                Active
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{doc.email}</td>
                          <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{doc.role}</td>
                          <td style={{ padding: '8px 12px' }}>{doc.consultation_count} session(s)</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              {!isActive && onSelectActiveDoctor && (
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  onClick={() => onSelectActiveDoctor(doc.id)}
                                  title="Switch to this doctor as active"
                                >
                                  <UserCheck size={12} /> Set Active
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                onClick={() => handleDeleteDoctor(doc.id, doc.name)}
                                title="Delete doctor"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════ TAB 2: PETS (PETCARE) ══════════════════ */}
          {activeTab === 'pets' && (
            <div>
              {/* ADD PET FORM */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                    <Plus size={16} color="#0284c7" /> Register New Pet (PetCare Patient)
                  </h3>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={handleClearPetForm}
                    title="Clear input fields"
                  >
                    <RotateCcw size={12} /> Clear
                  </button>
                </div>

                <form onSubmit={handleAddPet}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Pet Name *
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

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
                        <option value="Rabbit / Exotic">Rabbit / Exotic</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Age (Years)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        placeholder="e.g. 3.5"
                        value={petForm.age_years}
                        onChange={(e) => setPetForm({ ...petForm, age_years: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        placeholder="e.g. 15.2"
                        value={petForm.weight_kg}
                        onChange={(e) => setPetForm({ ...petForm, weight_kg: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Owner Phone / Contact
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. +1-555-0182"
                        value={petForm.owner_contact}
                        onChange={(e) => setPetForm({ ...petForm, owner_contact: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                    <button type="button" className="btn btn-outline" onClick={handleClearPetForm}>
                      Clear
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <Plus size={14} /> Add Pet
                    </button>
                  </div>
                </form>
              </div>

              {/* CHECK / LIST PETS */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                Registered PetCare Patients ({pets.length})
              </h3>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>ID</th>
                      <th style={{ padding: '8px 12px' }}>Pet Name</th>
                      <th style={{ padding: '8px 12px' }}>Species / Breed</th>
                      <th style={{ padding: '8px 12px' }}>Age & Weight</th>
                      <th style={{ padding: '8px 12px' }}>Pet Owner</th>
                      <th style={{ padding: '8px 12px' }}>Contact</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pets.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>#{p.id}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '8px 12px' }}>{p.species} {p.breed ? `(${p.breed})` : ''}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {p.age_years ? `${p.age_years}y` : 'N/A'} • {p.weight_kg ? `${p.weight_kg}kg` : 'N/A'}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.owner_name}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{p.owner_contact || 'N/A'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                            onClick={() => handleDeletePet(p.id, p.name)}
                            title="Delete pet"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

