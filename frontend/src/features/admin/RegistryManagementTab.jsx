import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Search, Plus, AlertTriangle, Tag, Phone, Mail, User, XCircle, CheckCircle } from 'lucide-react';
import { validatePhone, validateEmail } from '../../auth/validation';

export function RegistryManagementTab() {
  const [pets, setPets] = useState([]);
  const [owners, setOwners] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isNewOwner, setIsNewOwner] = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  // Owner Form
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');

  // Pet Form
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('Canine');
  const [petBreed, setPetBreed] = useState('');
  const [petSex, setPetSex] = useState('Male Neutered');
  const [petAge, setPetAge] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [microchipNo, setMicrochipNo] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [conditionsInput, setConditionsInput] = useState('');

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [petsRes, ownersRes] = await Promise.all([
        fetch('/api/v1/pets'),
        fetch('/api/v1/owners'),
      ]);
      const petsData = await petsRes.json();
      const ownersData = await ownersRes.json();

      if (petsData.success) setPets(petsData.data);
      if (ownersData.success) {
        setOwners(ownersData.data);
        if (ownersData.data.length > 0 && !selectedOwnerId) {
          setSelectedOwnerId(String(ownersData.data[0].id));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedOwnerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegister = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!petName.trim()) errors.petName = 'Patient name is required.';
    if (!petSpecies.trim()) errors.petSpecies = 'Species is required.';

    let targetOwnerId = selectedOwnerId;

    if (isNewOwner) {
      if (!ownerName.trim()) errors.ownerName = 'Owner name is required.';
      const phoneValidation = validatePhone(ownerPhone);
      if (!phoneValidation.valid) errors.ownerPhone = phoneValidation.error;
      if (ownerEmail) {
        const emailValidation = validateEmail(ownerEmail);
        if (!emailValidation.valid) errors.ownerEmail = emailValidation.error;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create owner if new
      if (isNewOwner) {
        const oRes = await fetch('/api/v1/owners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: ownerName.trim(),
            phone: ownerPhone.trim(),
            email: ownerEmail.trim() || null,
            address: ownerAddress.trim() || null,
          }),
        });
        const oData = await oRes.json();
        if (!oData.success) throw new Error(oData.error || 'Failed to register owner');
        targetOwnerId = oData.data.id;
      }

      // 2. Parse allergies and conditions
      const allergies = allergiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const chronic_conditions = conditionsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // 3. Create pet
      const pRes = await fetch('/api/v1/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: petName.trim(),
          species: petSpecies.trim(),
          breed: petBreed.trim() || null,
          sex: petSex,
          age_years: petAge ? parseFloat(petAge) : null,
          weight_kg: petWeight ? parseFloat(petWeight) : null,
          microchip_no: microchipNo.trim() || null,
          allergies,
          chronic_conditions,
          owner_id: targetOwnerId ? parseInt(targetOwnerId, 10) : null,
        }),
      });

      const pData = await pRes.json();
      if (!pData.success) throw new Error(pData.error || 'Failed to register patient');

      // Reset and close
      setShowModal(false);
      setPetName('');
      setPetBreed('');
      setPetAge('');
      setPetWeight('');
      setMicrochipNo('');
      setAllergiesInput('');
      setConditionsInput('');
      setOwnerName('');
      setOwnerPhone('');
      setOwnerEmail('');
      setOwnerAddress('');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPets = pets.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.species?.toLowerCase().includes(q) ||
      p.breed?.toLowerCase().includes(q) ||
      p.microchip_no?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q) ||
      p.owner_phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-tab-pane">
      <div className="admin-section-header">
        <div>
          <h3>Patient &amp; Owner Registry</h3>
          <p>Clinical master directory, critical allergy records, and pet guardian records.</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => {
            setShowModal(true);
            setFormErrors({});
            setError(null);
          }}
        >
          <Plus size={16} />
          <span>New Patient &amp; Owner</span>
        </button>
      </div>

      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <Search size={18} className="admin-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by pet name, breed, microchip, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="admin-badge badge-danger admin-alert-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Species / Breed</th>
              <th>Safety Flags (Allergies &amp; Chronic)</th>
              <th>Owner / Guardian</th>
              <th>Visits</th>
            </tr>
          </thead>
          <tbody>
            {loading && pets.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-empty-message">Loading registry...</td>
              </tr>
            ) : filteredPets.length === 0 ? (
              <tr>
                <td colSpan="5" className="table-empty-message">No matching patients in directory.</td>
              </tr>
            ) : (
              filteredPets.map((p) => {
                const allergies = Array.isArray(p.allergies)
                  ? p.allergies
                  : (typeof p.allergies === 'string' && p.allergies.startsWith('[')
                    ? JSON.parse(p.allergies)
                    : []);
                const conditions = Array.isArray(p.chronic_conditions)
                  ? p.chronic_conditions
                  : (typeof p.chronic_conditions === 'string' && p.chronic_conditions.startsWith('[')
                    ? JSON.parse(p.chronic_conditions)
                    : []);

                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <div className="admin-meta-sub">
                        {p.sex} {p.age_years && `• ${p.age_years} yrs`} {p.weight_kg && `• ${p.weight_kg} kg`}
                      </div>
                      {p.microchip_no && (
                        <div className="safety-badge-chip">
                          <Tag size={11} /> Chip #{p.microchip_no}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.species}
                      <div className="admin-meta-sub">{p.breed || 'Mixed'}</div>
                    </td>
                    <td>
                      <div className="safety-alerts">
                        {allergies.length > 0 && (
                          <div className="safety-tag-list">
                            {allergies.map((a, i) => (
                              <span key={i} className="safety-pill safety-pill-danger">
                                ⚠ {a}
                              </span>
                            ))}
                          </div>
                        )}
                        {conditions.length > 0 && (
                          <div className="safety-tag-list">
                            {conditions.map((c, i) => (
                              <span key={i} className="safety-pill safety-pill-warning">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        {allergies.length === 0 && conditions.length === 0 && (
                          <span className="admin-meta-sub">No known risks</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {p.owner_name ? (
                        <div>
                          <strong>{p.owner_name}</strong>
                          <div className="admin-meta-sub">{p.owner_phone || 'No phone'}</div>
                        </div>
                      ) : (
                        <span className="admin-meta-sub">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className="admin-badge badge-active">
                        {p.consultation_count || 0} visits
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Register Patient Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h4>Register Patient &amp; Owner</h4>
              <button
                type="button"
                className="queue-close-btn"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleRegister}>
              <div className="admin-modal-body">
                {/* Pet Section */}
                <div className="admin-form-group">
                  <label htmlFor="reg-pet-name">Pet Name *</label>
                  <input
                    id="reg-pet-name"
                    type="text"
                    required
                    className="admin-form-control"
                    placeholder="e.g. Barnaby"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                  />
                  {formErrors.petName && <span className="auth-error-msg">{formErrors.petName}</span>}
                </div>

                <div className="admin-stats-grid">
                  <div className="admin-form-group">
                    <label htmlFor="reg-pet-species">Species *</label>
                    <select
                      id="reg-pet-species"
                      className="admin-form-control"
                      value={petSpecies}
                      onChange={(e) => setPetSpecies(e.target.value)}
                    >
                      <option value="Canine">Canine (Dog)</option>
                      <option value="Feline">Feline (Cat)</option>
                      <option value="Avian">Avian (Bird)</option>
                      <option value="Equine">Equine (Horse)</option>
                      <option value="Exotic">Exotic</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="reg-pet-breed">Breed</label>
                    <input
                      id="reg-pet-breed"
                      type="text"
                      className="admin-form-control"
                      placeholder="e.g. Golden Retriever"
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                    />
                  </div>
                </div>

                <div className="admin-stats-grid">
                  <div className="admin-form-group">
                    <label htmlFor="reg-pet-sex">Sex</label>
                    <select
                      id="reg-pet-sex"
                      className="admin-form-control"
                      value={petSex}
                      onChange={(e) => setPetSex(e.target.value)}
                    >
                      <option value="Male Neutered">Male Neutered</option>
                      <option value="Female Spayed">Female Spayed</option>
                      <option value="Male Intact">Male Intact</option>
                      <option value="Female Intact">Female Intact</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="reg-pet-age">Age (Years)</label>
                    <input
                      id="reg-pet-age"
                      type="number"
                      step="0.1"
                      className="admin-form-control"
                      placeholder="3.5"
                      value={petAge}
                      onChange={(e) => setPetAge(e.target.value)}
                    />
                  </div>
                </div>

                <div className="admin-stats-grid">
                  <div className="admin-form-group">
                    <label htmlFor="reg-pet-weight">Weight (kg)</label>
                    <input
                      id="reg-pet-weight"
                      type="number"
                      step="0.1"
                      className="admin-form-control"
                      placeholder="28.4"
                      value={petWeight}
                      onChange={(e) => setPetWeight(e.target.value)}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="reg-pet-chip">Microchip Number</label>
                    <input
                      id="reg-pet-chip"
                      type="text"
                      className="admin-form-control"
                      placeholder="15-digit ISO chip"
                      value={microchipNo}
                      onChange={(e) => setMicrochipNo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="reg-allergies">
                    Critical Allergies (comma-separated)
                  </label>
                  <input
                    id="reg-allergies"
                    type="text"
                    className="admin-form-control"
                    placeholder="e.g. Penicillin, Chicken, NSAIDs"
                    value={allergiesInput}
                    onChange={(e) => setAllergiesInput(e.target.value)}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="reg-conditions">
                    Chronic Conditions (comma-separated)
                  </label>
                  <input
                    id="reg-conditions"
                    type="text"
                    className="admin-form-control"
                    placeholder="e.g. Hip Dysplasia, Epilepsy, Diabetes"
                    value={conditionsInput}
                    onChange={(e) => setConditionsInput(e.target.value)}
                  />
                </div>

                {/* Owner Section */}
                <div className="admin-section-header">
                  <div>
                    <h4>Pet Owner / Guardian</h4>
                  </div>
                  <div className="admin-inline-actions">
                    <button
                      type="button"
                      className={isNewOwner ? 'admin-btn admin-btn-primary' : 'admin-btn admin-btn-outline'}
                      onClick={() => setIsNewOwner(true)}
                    >
                      New Owner
                    </button>
                    {owners.length > 0 && (
                      <button
                        type="button"
                        className={!isNewOwner ? 'admin-btn admin-btn-primary' : 'admin-btn admin-btn-outline'}
                        onClick={() => setIsNewOwner(false)}
                      >
                        Existing Owner
                      </button>
                    )}
                  </div>
                </div>

                {isNewOwner ? (
                  <>
                    <div className="admin-form-group">
                      <label htmlFor="reg-owner-name">Owner Full Name *</label>
                      <input
                        id="reg-owner-name"
                        type="text"
                        required
                        className="admin-form-control"
                        placeholder="e.g. Alice Cooper"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                      />
                      {formErrors.ownerName && <span className="auth-error-msg">{formErrors.ownerName}</span>}
                    </div>

                    <div className="admin-stats-grid">
                      <div className="admin-form-group">
                        <label htmlFor="reg-owner-phone">Owner Phone Number *</label>
                        <input
                          id="reg-owner-phone"
                          type="tel"
                          required
                          className="admin-form-control"
                          placeholder="10-digit mobile phone"
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                        />
                        {formErrors.ownerPhone && <span className="auth-error-msg">{formErrors.ownerPhone}</span>}
                      </div>

                      <div className="admin-form-group">
                        <label htmlFor="reg-owner-email">Owner Email</label>
                        <input
                          id="reg-owner-email"
                          type="email"
                          className="admin-form-control"
                          placeholder="alice@example.com"
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                        />
                        {formErrors.ownerEmail && <span className="auth-error-msg">{formErrors.ownerEmail}</span>}
                      </div>
                    </div>

                    <div className="admin-form-group">
                      <label htmlFor="reg-owner-address">Owner Home Address</label>
                      <input
                        id="reg-owner-address"
                        type="text"
                        className="admin-form-control"
                        placeholder="Street address, city"
                        value={ownerAddress}
                        onChange={(e) => setOwnerAddress(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="admin-form-group">
                    <label htmlFor="reg-existing-owner">Select Existing Owner</label>
                    <select
                      id="reg-existing-owner"
                      className="admin-form-control"
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                    >
                      {owners.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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

