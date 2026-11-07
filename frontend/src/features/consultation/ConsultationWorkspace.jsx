import React, { useState, useEffect, useCallback } from 'react';
import { ConsultationHeader } from './components/ConsultationHeader';
import { RecordingPanel } from './components/LiveRecording/RecordingPanel';
import { DocumentsPanel } from './components/ClinicalDocuments/DocumentsPanel';
import { DirectoryModal } from './components/DirectoryModal';
import { ClinicalInsightsModal } from './components/ClinicalInsightsModal';
import { useConsultationWebSocket } from './hooks/useConsultationWebSocket';
import { useMicrophone } from './hooks/useMicrophone';
import { Sparkles, Plus, X, Stethoscope, AlertCircle, Users } from 'lucide-react';

export function ConsultationWorkspace() {
  const [consultations, setConsultations]   = useState([]);

  // Persistent active consultation ID (from URL param or localStorage)
  const [consultationId, setConsultationId] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramId = parseInt(urlParams.get('consultationId'), 10);
      if (paramId) return paramId;
      const cachedId = parseInt(localStorage.getItem('activeConsultationId'), 10);
      return cachedId || null;
    } catch {
      return null;
    }
  });

  const [consultation, setConsultation]     = useState(null);
  const [documents, setDocuments]           = useState([]);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [errorMessage, setErrorMessage]     = useState(null);

  // Dynamic Active Doctor State (Persisted in localStorage)
  const [activeDoctorId, setActiveDoctorId] = useState(() => {
    return parseInt(localStorage.getItem('activeDoctorId'), 10) || 1;
  });
  const [doctors, setDoctors] = useState([]);

  // Directory Modal state
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

  // Clinical Insights & Generated Templates Modal state
  const [showInsightsModal, setShowInsightsModal]   = useState(false);
  const [isApprovingAll, setIsApprovingAll]         = useState(false);

  // New consultation modal state
  const [showNewModal, setShowNewModal]     = useState(false);
  const [pets, setPets]                     = useState([]);
  const [newDoctorId, setNewDoctorId]       = useState(activeDoctorId);
  const [newPetId, setNewPetId]             = useState('');
  const [newLanguage, setNewLanguage]       = useState('en');
  const [newConsent, setNewConsent]         = useState(true);
  const [isCreating, setIsCreating]         = useState(false);

  // Dynamic auth headers helper
  const getAuthHeaders = useCallback((extra = {}) => ({
    'x-doctor-id': String(activeDoctorId),
    ...extra,
  }), [activeDoctorId]);

  // ─── Fetch Doctors & Pets Lists ─────────────────────────────────────────────
  const loadDirectoryMeta = useCallback(async () => {
    try {
      const [docsRes, petsRes] = await Promise.all([
        fetch('/api/v1/directory/doctors'),
        fetch('/api/v1/directory/pets'),
      ]);
      const docsData = await docsRes.json();
      const petsData = await petsRes.json();

      if (docsData.success) {
        setDoctors(docsData.data);
        if (!docsData.data.some((d) => d.id === activeDoctorId) && docsData.data.length > 0) {
          setActiveDoctorId(docsData.data[0].id);
          localStorage.setItem('activeDoctorId', String(docsData.data[0].id));
        }
      }

      if (petsData.success && petsData.data.length > 0) {
        setPets(petsData.data);
        setNewPetId((prev) => (prev ? prev : String(petsData.data[0].id)));
      }
    } catch (err) {
      console.error('[ConsultationWorkspace] Directory meta load error:', err);
    }
  }, [activeDoctorId]);

  // ─── Load all consultations list ───────────────────────────────────────────
  const loadConsultationsList = useCallback(async (targetId = null) => {
    try {
      const res = await fetch('/api/v1/consultations', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setConsultations(data.data);
        if (data.data.length > 0) {
          setConsultationId((prev) => {
            if (targetId && data.data.some((c) => c.id === targetId)) {
              return targetId;
            }
            const urlParams = new URLSearchParams(window.location.search);
            const paramId = parseInt(urlParams.get('consultationId'), 10);
            const cachedId = parseInt(localStorage.getItem('activeConsultationId'), 10);
            const candidate = paramId || prev || cachedId;

            // Prioritize current candidate if it exists in the list, else fallback to first
            if (candidate && data.data.some((c) => c.id === candidate)) {
              return candidate;
            }
            return data.data[0].id;
          });
        } else {
          setConsultationId(null);
          setConsultation(null);
          setDocuments([]);
        }
      }
    } catch (err) {
      console.error('[ConsultationWorkspace] Error listing consultations:', err);
    }
  }, [getAuthHeaders]);

  // ─── Fetch single consultation + documents ──────────────────────────────────
  const loadConsultationData = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/consultations/${id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setConsultation(data.data);
        if (data.data.doctor_id) {
          setActiveDoctorId(data.data.doctor_id);
          try {
            localStorage.setItem('activeDoctorId', String(data.data.doctor_id));
          } catch (_) {}
        }
      }

      const docsRes = await fetch(`/api/v1/consultations/${id}/documents`);
      const docsData = await docsRes.json();
      if (docsData.success) {
        setDocuments(docsData.data);
      }
    } catch (err) {
      console.error('[ConsultationWorkspace] Load error:', err);
    }
  }, [getAuthHeaders]);

  // Initial load
  useEffect(() => {
    loadDirectoryMeta();
    loadConsultationsList();
  }, [loadDirectoryMeta, loadConsultationsList]);

  // Load active consultation when id changes and sync with localStorage & URL
  useEffect(() => {
    if (consultationId) {
      loadConsultationData(consultationId);
      try {
        localStorage.setItem('activeConsultationId', String(consultationId));
        const currentUrl = new URL(window.location);
        if (currentUrl.searchParams.get('consultationId') !== String(consultationId)) {
          currentUrl.searchParams.set('consultationId', String(consultationId));
          window.history.replaceState(null, '', currentUrl.toString());
        }
      } catch (e) {
        console.warn('[ConsultationWorkspace] Storage/URL sync warning:', e);
      }
    }
  }, [consultationId, loadConsultationData]);

  // Sync newDoctorId default when activeDoctorId changes
  useEffect(() => {
    setNewDoctorId(activeDoctorId);
  }, [activeDoctorId]);

  // ─── Doctor Switcher ────────────────────────────────────────────────────────
  const handleSelectActiveDoctor = async (id) => {
    setActiveDoctorId(id);
    try {
      localStorage.setItem('activeDoctorId', String(id));
    } catch (_) {}

    // If an active consultation is open and its assigned doctor differs, reassign in backend
    if (consultationId && consultation && consultation.doctor_id !== id) {
      try {
        const res = await fetch(`/api/v1/consultations/${consultationId}/doctor`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-doctor-id': String(id),
          },
          body: JSON.stringify({ doctorId: id }),
        });
        const data = await res.json();
        if (data.success) {
          setConsultation(data.data);
          loadConsultationsList(consultationId);
        } else {
          console.warn('[ConsultationWorkspace] Doctor reassign warning:', data.error);
        }
      } catch (err) {
        console.error('[ConsultationWorkspace] Failed to reassign doctor:', err);
      }
    }
  };

  // ─── Delete Consultation ───────────────────────────────────────────────────
  const handleDeleteConsultation = async (id) => {
    if (!window.confirm(`Delete Consultation #${id}? This will remove its transcript and documents.`)) return;
    try {
      const res = await fetch(`/api/v1/directory/consultations/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await loadConsultationsList();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // ─── WebSocket callbacks ─────────────────────────────────────────────────────
  const handleDocumentsReady = useCallback((newDocs) => {
    setDocuments(newDocs);
    if (consultationId) {
      loadConsultationData(consultationId);
      loadConsultationsList();
    }
  }, [consultationId, loadConsultationData, loadConsultationsList]);

  const handleStatusChange = useCallback((status) => {
    setConsultation((prev) => (prev ? { ...prev, status } : prev));
  }, []);

  const {
    connectionStatus,
    segments,
    setSegments,
    reloadTranscript,
    partialSegment,
    extractionProgress,
    sendPause,
    sendResume,
    sendStop,
  } = useConsultationWebSocket(consultationId, handleDocumentsReady, handleStatusChange);

  // ─── Whisper Microphone Hook ────────────────────────────────────────────────
  const {
    isRecording,
    micPermission,
    currentSpeaker,
    setCurrentSpeaker,
    chunkStatus,
    chunkCount,
    error: micError,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
  } = useMicrophone({
    consultationId,
    language: consultation?.language || 'en',
    doctorId: activeDoctorId,
    onChunkProcessed: () => {},
    onChunkError: (err) => console.warn('[Workspace] Chunk error:', err.message),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectConsultation = (id) => {
    if (id === consultationId) return;
    setSegments([]);
    setDocuments([]);
    setConsultationId(id);
    setErrorMessage(null);

    const targetConsultation = consultations.find((c) => c.id === id);
    if (targetConsultation && targetConsultation.doctor_id) {
      setActiveDoctorId(targetConsultation.doctor_id);
      try {
        localStorage.setItem('activeDoctorId', String(targetConsultation.doctor_id));
      } catch (_) {}
    }
  };

  const handleCreateNewConsultation = async (e) => {
    e.preventDefault();
    if (!newPetId) return;

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const chosenDoctor = newDoctorId || activeDoctorId;
      const res = await fetch('/api/v1/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-doctor-id': String(chosenDoctor) },
        body: JSON.stringify({
          petId: parseInt(newPetId, 10),
          language: newLanguage,
          consentGiven: newConsent,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const newId = data.data.id;
      setShowNewModal(false);

      // Immediately synchronize active doctor to the chosen doctor
      setActiveDoctorId(chosenDoctor);
      try {
        localStorage.setItem('activeDoctorId', String(chosenDoctor));
      } catch (_) {}

      // Immediately clear state for new consultation
      setSegments([]);
      setDocuments([]);

      // Update URL and localStorage BEFORE fetching lists to avoid race condition
      try {
        localStorage.setItem('activeConsultationId', String(newId));
        const currentUrl = new URL(window.location);
        currentUrl.searchParams.set('consultationId', String(newId));
        window.history.replaceState(null, '', currentUrl.toString());
      } catch (e) {
        console.warn('[ConsultationWorkspace] URL sync warning:', e);
      }

      setConsultationId(newId);
      await loadConsultationsList(newId);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetConsultation = async () => {
    if (!consultationId) return;
    try {
      const res = await fetch(`/api/v1/consultations/${consultationId}/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setConsultation(data.data);
        await reloadTranscript();
        loadConsultationsList();
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleGrantConsent = async () => {
    if (!consultationId) {
      setErrorMessage('Please create or select an active consultation before recording consent.');
      setShowNewModal(true);
      return;
    }
    try {
      // Dynamic pet owner name derived from consultation or selected pet (NO hardcoded fallback)
      const dynamicOwner = consultation?.owner_name || 'Pet Owner (Digital Consent)';
      const res = await fetch(`/api/v1/consultations/${consultationId}/consent`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ givenBy: dynamicOwner }),
      });
      const data = await res.json();
      if (data.success) {
        loadConsultationData(consultationId);
      } else {
        throw new Error(data.error || 'Failed to record consent');
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleStartRecording = async () => {
    if (!consultationId) {
      setErrorMessage('Please create or select an active consultation before starting recording.');
      setShowNewModal(true);
      return;
    }
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/consultations/${consultationId}/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setConsultation(data.data);
      await startCapture();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handlePauseRecording = async () => {
    if (!consultationId) return;
    try {
      sendPause();
      pauseCapture();
      const res = await fetch(`/api/v1/consultations/${consultationId}/pause`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) setConsultation(data.data);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleResumeRecording = async () => {
    if (!consultationId) return;
    try {
      sendResume();
      await resumeCapture();
      const res = await fetch(`/api/v1/consultations/${consultationId}/resume`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) setConsultation(data.data);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleStopRecording = async (durationSeconds) => {
    if (!consultationId) return;
    try {
      stopCapture();
      sendStop(durationSeconds);
      const res = await fetch(`/api/v1/consultations/${consultationId}/stop`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ audioDurationSeconds: durationSeconds }),
      });
      const data = await res.json();
      if (data.success) setConsultation(data.data);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleTriggerGenerate = async () => {
    if (!consultationId) return;
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/consultations/${consultationId}/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setDocuments(data.data.documents);
      loadConsultationData(consultationId);
      loadConsultationsList();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadAudio = async (file) => {
    if (!file) return;
    setIsUploadingAudio(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('autoGenerate', 'false'); // Transcription only on upload; document generation occurs on explicit Generate click
      if (consultation?.pet_name) formData.append('petName', consultation.pet_name);
      if (consultation?.pet_species) formData.append('petSpecies', consultation.pet_species);
      if (consultation?.pet_breed) formData.append('petBreed', consultation.pet_breed);
      if (consultation?.owner_name) formData.append('ownerName', consultation.owner_name);
      if (consultation?.doctor_name) formData.append('doctorName', consultation.doctor_name);

      const targetUrl = consultationId
        ? `/api/v1/consultations/${consultationId}/upload-and-scribe`
        : '/api/v1/consultations/upload-and-scribe';

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to scribe uploaded audio');
      }

      // 1. Set consultation data
      if (data.data.consultation) {
        setConsultation(data.data.consultation);
      }

      // 2. Set transcript segments
      if (data.data.transcript?.segments) {
        setSegments(data.data.transcript.segments);
      } else {
        await reloadTranscript();
      }

      // 3. Keep documents unpopulated so the right panel stays in "Awaiting Generation" state until the doctor clicks Generate
      setDocuments([]);

      // 4. Update consultation header/status from upload response without pre-populating draft documents
      if (data.data.consultation) {
        setConsultation(data.data.consultation);
      }
    } catch (err) {
      console.error('[ConsultationWorkspace] Audio upload error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleCompleteConsultation = async (idToComplete) => {
    const targetId = idToComplete || consultationId;
    if (!targetId) return;
    try {
      const res = await fetch(`/api/v1/consultations/${targetId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setConsultation(data.data);
      await loadConsultationsList();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleOpenInsightsModal = async () => {
    // If transcripts exist, trigger fresh AI extraction so newly transcribed dialogue is synthesized
    if (segments.length > 0) {
      await handleTriggerGenerate();
    }
    setShowInsightsModal(true);
  };

  const [isRejectingAll, setIsRejectingAll] = useState(false);

  const handleApproveAll = async () => {
    if (documents.length === 0) return;
    setIsApprovingAll(true);
    setErrorMessage(null);
    try {
      for (const doc of documents) {
        if (doc.status !== 'approved') {
          await fetch(`/api/v1/documents/${doc.id}/approve`, {
            method: 'POST',
            headers: { 'x-doctor-id': String(activeDoctorId) },
          });
        }
      }
      await loadConsultationData(consultationId);
      setShowInsightsModal(false);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleRejectAll = async (reason = 'Clinician rejected AI clinical draft') => {
    if (documents.length === 0) return;
    setIsRejectingAll(true);
    setErrorMessage(null);
    try {
      for (const doc of documents) {
        if (doc.status !== 'rejected') {
          await fetch(`/api/v1/documents/${doc.id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-doctor-id': String(activeDoctorId) },
            body: JSON.stringify({ reason }),
          });
        }
      }
      await loadConsultationData(consultationId);
      setShowInsightsModal(false);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsRejectingAll(false);
    }
  };

  return (
    <div className="consultation-workspace">
      {errorMessage && (
        <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Progress banner during AI extraction */}
      {extractionProgress && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '12px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#166534' }}>
          <Sparkles size={20} className="spin" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              AI Clinical Extraction in Progress ({extractionProgress.percent}%)
            </div>
            <div style={{ fontSize: '0.8rem', color: '#15803d' }}>
              Stage: {extractionProgress.stage?.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      )}

      <ConsultationHeader
        consultation={consultation}
        consultations={consultations}
        onSelectConsultation={handleSelectConsultation}
        onOpenNewConsultationModal={() => setShowNewModal(true)}
        onOpenDirectoryModal={() => setShowDirectoryModal(true)}
        doctors={doctors}
        activeDoctorId={activeDoctorId}
        onSelectActiveDoctor={handleSelectActiveDoctor}
        onDeleteConsultation={handleDeleteConsultation}
        onCompleteConsultation={handleCompleteConsultation}
        connectionStatus={connectionStatus}
      />

      <div className="split-workspace">
        <RecordingPanel
          status={consultation?.status || 'scheduled'}
          consentGiven={consultation?.consent_given || false}
          hasConsultation={!!consultationId}
          onGrantConsent={handleGrantConsent}
          onStart={handleStartRecording}
          onPause={handlePauseRecording}
          onResume={handleResumeRecording}
          onStop={handleStopRecording}
          onReset={handleResetConsultation}
          segments={segments}
          partialSegment={partialSegment}
          doctorName={consultation?.doctor_name || (doctors.find((d) => d.id === activeDoctorId)?.name) || 'Dr. Mouni'}
          ownerName={consultation?.owner_name || 'Pet Owner'}
          currentSpeaker={currentSpeaker}
          onToggleSpeaker={setCurrentSpeaker}
          chunkStatus={chunkStatus}
          chunkCount={chunkCount}
          micPermission={micPermission}
          micError={micError}
          onUploadAudio={handleUploadAudio}
          isUploadingAudio={isUploadingAudio}
          onOpenInsightsModal={handleOpenInsightsModal}
          isGenerating={isGenerating}
        />

        <DocumentsPanel
          documents={documents}
          onRefreshDocuments={() => loadConsultationData(consultationId)}
          consultationId={consultationId}
          onTriggerGenerate={handleOpenInsightsModal}
          onCompleteConsultation={() => handleCompleteConsultation(consultationId)}
          consultationStatus={consultation?.status}
          isGenerating={isGenerating}
          activeDoctorId={activeDoctorId}
        />
      </div>

      {/* ─── Directory Management Modal (Doctors & Pets) ─── */}
      <DirectoryModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        activeDoctorId={activeDoctorId}
        onSelectActiveDoctor={handleSelectActiveDoctor}
        onRefreshData={() => {
          loadDirectoryMeta();
          loadConsultationsList();
          if (consultationId) loadConsultationData(consultationId);
        }}
      />

      {/* ─── Clinical Insights & Generated Templates Modal (Summary, Meds, Tests, Follow-ups) ─── */}
      <ClinicalInsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
        consultation={consultation}
        documents={documents}
        onApproveAll={handleApproveAll}
        isApprovingAll={isApprovingAll}
        onRejectAll={handleRejectAll}
        isRejectingAll={isRejectingAll}
        onRegenerate={handleTriggerGenerate}
        isGenerating={isGenerating}
      />

      {/* ─── + New Dynamic Consultation Modal ─── */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <Stethoscope size={18} color="#0284c7" />
                <span>Create New Consultation</span>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowNewModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewConsultation}>
              <div className="modal-body">
                {/* Doctor Selection */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                      Attending Veterinarian
                    </label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      onClick={() => { setShowNewModal(false); setShowDirectoryModal(true); }}
                    >
                      <Users size={12} /> Manage Doctors
                    </button>
                  </div>
                  <select
                    className="form-control"
                    value={newDoctorId}
                    onChange={(e) => setNewDoctorId(parseInt(e.target.value, 10))}
                    required
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.role}) — #{d.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Patient / Pet Selection */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                      Select Patient (Pet)
                    </label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      onClick={() => { setShowNewModal(false); setShowDirectoryModal(true); }}
                    >
                      <Plus size={12} /> Add New Pet
                    </button>
                  </div>
                  <select
                    className="form-control"
                    value={newPetId}
                    onChange={(e) => setNewPetId(e.target.value)}
                    required
                  >
                    {pets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.species} - {p.breed || 'Mixed'}) — Owner: {p.owner_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Audio Language Selection */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Consultation Audio Language
                  </label>
                  <select
                    className="form-control"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                  >
                    <option value="en">English (US/UK)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="en-ta">Tanglish (Tamil + English Mixed)</option>
                  </select>
                </div>

                {/* Pet Owner Consent */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <input
                    type="checkbox"
                    id="consent_check"
                    checked={newConsent}
                    onChange={(e) => setNewConsent(e.target.checked)}
                  />
                  <label htmlFor="consent_check" style={{ fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                    Pet owner digital recording consent granted
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isCreating}>
                  <Plus size={14} /> {isCreating ? 'Creating...' : 'Start New Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
