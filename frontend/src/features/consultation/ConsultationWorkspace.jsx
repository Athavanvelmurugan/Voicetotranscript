import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ConsultationHeader } from './components/ConsultationHeader';
import { RecordingPanel } from './components/LiveRecording/RecordingPanel';
import { DocumentsPanel } from './components/ClinicalDocuments/DocumentsPanel';
import { ClinicalInsightsModal } from './components/ClinicalInsightsModal';
import { PatientSafetyBanner } from './components/PatientSafetyBanner';
import { useConsultationWebSocket } from './hooks/useConsultationWebSocket';
import { useMicrophone } from './hooks/useMicrophone';
import { apiClient } from '../../api/client';
import { Sparkles, Plus, X, Stethoscope, AlertCircle } from 'lucide-react';

export function ConsultationWorkspace({
  preSelectedPetId = null,
  onClearPreSelectedPet = null,
  inPortal = false,
}) {
  const { user } = useAuth();
  const [consultations, setConsultations]   = useState([]);

  // Persistent active consultation ID (from URL param or user-scoped localStorage)
  const [consultationId, setConsultationId] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramId = parseInt(urlParams.get('consultationId'), 10);
      if (paramId) return paramId;
      const userStorageKey = user?.id ? `activeConsultationId_${user.id}` : 'activeConsultationId';
      const cachedId = parseInt(localStorage.getItem(userStorageKey), 10);
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
    return user?.id || parseInt(localStorage.getItem('activeDoctorId'), 10) || 1;
  });
  const [doctors, setDoctors] = useState([]);

  // Clinical Insights & Generated Templates Modal state
  const [showInsightsModal, setShowInsightsModal]   = useState(false);
  const [isApprovingAll, setIsApprovingAll]         = useState(false);

  // New consultation modal state
  const [showNewModal, setShowNewModal]     = useState(false);
  const [pets, setPets]                     = useState([]);
  const [newDoctorId, setNewDoctorId]       = useState(() => user?.id || activeDoctorId);
  const [newPetId, setNewPetId]             = useState('');
  const [newLanguage, setNewLanguage]       = useState('en');
  const [newConsent, setNewConsent]         = useState(true);
  const [isCreating, setIsCreating]         = useState(false);

  // ─── Fetch Doctors & Pets Lists (Strictly Scoped) ─────────────────────────
  const loadDirectoryMeta = useCallback(async () => {
    try {
      const [docsRes, petsRes] = await Promise.all([
        apiClient('/api/v1/directory/doctors'),
        apiClient('/api/v1/pets'),
      ]);
      const docsData = await docsRes.json();
      const petsData = await petsRes.json();

      if (docsData.success) {
        setDoctors(docsData.data);
        setActiveDoctorId((currentActiveId) => {
          if (user?.id) return user.id;
          if (!docsData.data.some((d) => d.id === currentActiveId) && docsData.data.length > 0) {
            const fallbackId = docsData.data[0].id;
            try {
              localStorage.setItem('activeDoctorId', String(fallbackId));
            } catch (_) {}
            return fallbackId;
          }
          return currentActiveId;
        });
      }

      if (petsData.success && petsData.data.length > 0) {
        setPets(petsData.data);
        setNewPetId((prev) => (prev ? prev : String(petsData.data[0].id)));
      }
    } catch (err) {
      console.error('[ConsultationWorkspace] Directory meta load error:', err);
    }
  }, [user]); // Stable callback

  // ─── Load all consultations list (Multi-tenant scoped) ─────────────────────
  const loadConsultationsList = useCallback(async (targetId = null) => {
    try {
      const res = await apiClient('/api/v1/consultations');
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : [];
        setConsultations(list);
        const userStorageKey = user?.id ? `activeConsultationId_${user.id}` : 'activeConsultationId';

        if (list.length > 0) {
          setConsultationId((prev) => {
            if (targetId && list.some((c) => c.id === targetId)) {
              return targetId;
            }
            const urlParams = new URLSearchParams(window.location.search);
            const paramId = parseInt(urlParams.get('consultationId'), 10);
            const cachedId = parseInt(localStorage.getItem(userStorageKey), 10);
            const candidate = paramId || prev || cachedId;

            // Prioritize current candidate ONLY if it exists in the doctor's verified list
            if (candidate && list.some((c) => c.id === candidate)) {
              return candidate;
            }
            return list[0].id;
          });
        } else {
          // Doctor has 0 consultations: clean slate
          setConsultationId(null);
          setConsultation(null);
          setDocuments([]);
          setSegments([]);
          try {
            localStorage.removeItem(userStorageKey);
            localStorage.removeItem('activeConsultationId');
            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.has('consultationId')) {
              currentUrl.searchParams.delete('consultationId');
              window.history.replaceState(null, '', currentUrl.toString());
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[ConsultationWorkspace] Error listing consultations:', err);
    }
  }, [user]);

  // ─── Fetch single consultation + documents ──────────────────────────────────
  const loadConsultationData = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await apiClient(`/api/v1/consultations/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Forbidden or Not Found: immediately purge consultation state!
        setConsultation(null);
        setDocuments([]);
        setSegments([]);
        setConsultationId(null);
        try {
          const userStorageKey = user?.id ? `activeConsultationId_${user.id}` : 'activeConsultationId';
          localStorage.removeItem(userStorageKey);
          localStorage.removeItem('activeConsultationId');
          const currentUrl = new URL(window.location.href);
          if (currentUrl.searchParams.has('consultationId')) {
            currentUrl.searchParams.delete('consultationId');
            window.history.replaceState(null, '', currentUrl.toString());
          }
        } catch (_) {}
        return;
      }

      setConsultation(data.data);
      if (data.data.doctor_id) {
        setActiveDoctorId(data.data.doctor_id);
        try {
          localStorage.setItem('activeDoctorId', String(data.data.doctor_id));
        } catch (_) {}
      }

      const docsRes = await apiClient(`/api/v1/consultations/${id}/documents`);
      const docsData = await docsRes.json();
      if (docsRes.ok && docsData.success) {
        setDocuments(docsData.data || []);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error('[ConsultationWorkspace] Load error:', err);
      setDocuments([]);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadDirectoryMeta();
    loadConsultationsList();
  }, [loadDirectoryMeta, loadConsultationsList]);

  // Load active consultation when id changes and sync with localStorage & URL
  useEffect(() => {
    const userStorageKey = user?.id ? `activeConsultationId_${user.id}` : 'activeConsultationId';
    if (consultationId) {
      loadConsultationData(consultationId);
      try {
        localStorage.setItem(userStorageKey, String(consultationId));
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('consultationId') !== String(consultationId)) {
          currentUrl.searchParams.set('consultationId', String(consultationId));
          window.history.replaceState(null, '', currentUrl.toString());
        }
      } catch (e) {
        console.warn('[ConsultationWorkspace] Storage/URL sync warning:', e);
      }
    } else {
      try {
        localStorage.removeItem(userStorageKey);
        localStorage.removeItem('activeConsultationId');
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('consultationId')) {
          currentUrl.searchParams.delete('consultationId');
          window.history.replaceState(null, '', currentUrl.toString());
        }
      } catch (_) {}
    }
  }, [consultationId, loadConsultationData, user]);

  // Handle browser popstate navigation (Back / Forward buttons & URL change)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paramId = parseInt(urlParams.get('consultationId'), 10);
        if (paramId && paramId !== consultationId) {
          setSegments([]);
          setDocuments([]);
          setConsultationId(paramId);
        }
      } catch (_) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [consultationId]);

  // Sync newDoctorId default when activeDoctorId changes
  useEffect(() => {
    setNewDoctorId(activeDoctorId);
  }, [activeDoctorId]);

  // ─── Doctor Switcher ────────────────────────────────────────────────────────
  const handleSelectActiveDoctor = async (id) => {
    const doctorNum = parseInt(id, 10);
    setActiveDoctorId(doctorNum);
    try {
      localStorage.setItem('activeDoctorId', String(doctorNum));
    } catch (_) {}

    const chosenDoc = doctors.find((d) => d.id === doctorNum);

    // If an active consultation is open and its assigned doctor differs, reassign in backend
    if (consultationId && consultation && consultation.doctor_id !== doctorNum) {
      // 1. Optimistic update so the dropdown does not flicker or bounce back
      setConsultation((prev) =>
        prev
          ? {
              ...prev,
              doctor_id: doctorNum,
              doctor_name: chosenDoc?.name || prev.doctor_name,
              doctor_email: chosenDoc?.email || prev.doctor_email,
            }
          : prev
      );

      try {
        const res = await apiClient(`/api/v1/consultations/${consultationId}/doctor`, {
          method: 'PATCH',
          body: JSON.stringify({ doctorId: doctorNum }),
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
      const res = await apiClient(`/api/v1/directory/consultations/${id}`, {
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

    try {
      const currentUrl = new URL(window.location);
      currentUrl.searchParams.delete('portal');
      currentUrl.searchParams.delete('tab');
      currentUrl.searchParams.set('consultationId', String(id));
      window.history.pushState({}, '', currentUrl.toString());
    } catch (_) {}
  };

  // External launcher for specific pet consultation (from Patient List or Clinical Chart)
  useEffect(() => {
    if (!preSelectedPetId) return;

    const matching = consultations.find((c) => c.pet_id === preSelectedPetId);
    if (matching) {
      handleSelectConsultation(matching.id);
    } else {
      setNewPetId(String(preSelectedPetId));
      setShowNewModal(true);
    }

    if (onClearPreSelectedPet) {
      onClearPreSelectedPet();
    }
  }, [preSelectedPetId, consultations, onClearPreSelectedPet]);

  const handleCreateNewConsultation = async (e) => {
    e.preventDefault();
    if (!newPetId) return;

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const chosenDoctor = parseInt(newDoctorId || activeDoctorId || 1, 10);
      const res = await apiClient('/api/v1/consultations', {
        method: 'POST',
        body: JSON.stringify({
          petId: parseInt(newPetId, 10),
          doctorId: chosenDoctor,
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
        currentUrl.searchParams.delete('portal');
        currentUrl.searchParams.delete('tab');
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
      const res = await apiClient(`/api/v1/consultations/${consultationId}/reset`, {
        method: 'POST',
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
      const res = await apiClient(`/api/v1/consultations/${consultationId}/consent`, {
        method: 'POST',
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
      const res = await apiClient(`/api/v1/consultations/${consultationId}/start`, {
        method: 'POST',
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
      const res = await apiClient(`/api/v1/consultations/${consultationId}/pause`, {
        method: 'POST',
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
      const res = await apiClient(`/api/v1/consultations/${consultationId}/resume`, {
        method: 'POST',
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
      const res = await apiClient(`/api/v1/consultations/${consultationId}/stop`, {
        method: 'POST',
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
      const res = await apiClient(`/api/v1/consultations/${consultationId}/generate`, {
        method: 'POST',
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

      const res = await apiClient(targetUrl, {
        method: 'POST',
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
      const res = await apiClient(`/api/v1/consultations/${targetId}/complete`, {
        method: 'POST',
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
          await apiClient(`/api/v1/documents/${doc.id}/approve`, {
            method: 'POST',
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
          await apiClient(`/api/v1/documents/${doc.id}/reject`, {
            method: 'POST',
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
    <div className={`consultation-workspace ${inPortal ? 'consultation-workspace--in-portal' : ''}`}>
      {errorMessage && (
        <div className="alert-inline-error">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Progress banner during AI extraction */}
      {extractionProgress && (
        <div className="alert-inline-progress">
          <Sparkles size={20} className="spin" />
          <div className="alert-progress-body">
            <div className="alert-progress-title">
              AI Clinical Extraction in Progress ({extractionProgress.percent}%)
            </div>
            <div className="alert-progress-sub">
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
        doctors={doctors}
        activeDoctorId={activeDoctorId}
        onSelectActiveDoctor={handleSelectActiveDoctor}
        onDeleteConsultation={handleDeleteConsultation}
        onCompleteConsultation={handleCompleteConsultation}
        connectionStatus={connectionStatus}
      />

      {/* Patient Clinical Safety Banner */}
      {consultation && (
        <PatientSafetyBanner
          petName={consultation.pet_name}
          species={consultation.pet_species}
          breed={consultation.pet_breed}
          allergies={consultation.pet_allergies}
          chronicConditions={consultation.pet_chronic_conditions}
          microchipNo={consultation.pet_microchip_no}
          weightKg={consultation.pet_weight}
          ageYears={consultation.pet_age}
          compact={true}
        />
      )}

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
          <div className="modal-content consult-modal-content consult-modal-content--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <Stethoscope size={18} className="icon-primary" />
                <span>Create New Consultation</span>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowNewModal(false)}
                aria-label="Close new consultation modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewConsultation}>
              <div className="modal-body">
                {/* Attending Veterinarian Locked to Authenticated Doctor */}
                <div className="form-group new-consult-form-group">
                  <label className="new-consult-label">
                    Attending Clinician
                  </label>
                  <div className="doctor-locked-badge">
                    <Stethoscope size={16} />
                    <span>{user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Attending DVM'} (You)</span>
                  </div>
                </div>

                {/* Patient / Pet Selection */}
                <div className="form-group new-consult-form-group">
                  <label className="new-consult-label">
                    Select Patient (Pet)
                  </label>
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
                <div className="form-group new-consult-form-group">
                  <label className="new-consult-label">
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
                <div className="new-consult-consent-box">
                  <input
                    type="checkbox"
                    id="consent_check"
                    checked={newConsent}
                    onChange={(e) => setNewConsent(e.target.checked)}
                  />
                  <label htmlFor="consent_check" className="new-consult-consent-label">
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
