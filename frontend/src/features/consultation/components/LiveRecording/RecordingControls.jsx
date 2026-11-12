import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Square, Mic, MicOff, AlertCircle,
  Sparkles, Upload, Stethoscope, User, Loader2, CheckCircle2, RotateCcw,
} from 'lucide-react';

export function RecordingControls({
  status,
  consentGiven,
  hasConsultation = true,
  onGrantConsent,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  // Clinical identity props
  doctorName,
  ownerName,
  // Microphone / Whisper props
  currentSpeaker = 'auto',
  onToggleSpeaker,
  chunkStatus,
  chunkCount,
  micPermission,
  micError,
  // Audio Upload & Scribe Props
  onUploadAudio,
  isUploadingAudio = false,
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval = null;
    if (status === 'recording') {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (status === 'scheduled') {
      setSeconds(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatTimer = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const ChunkStatusBadge = () => {
    if (!chunkStatus) return null;

    if (chunkStatus === 'uploading' || chunkStatus === 'processing') {
      return (
        <div className="chunk-status-pill chunk-status-pill--info">
          <Loader2 size={11} className="spin-animate" />
          <span>{chunkStatus === 'uploading' ? 'Uploading chunk...' : 'Whisper transcribing...'}</span>
        </div>
      );
    }
    if (chunkStatus === 'done') {
      return (
        <div className="chunk-status-pill chunk-status-pill--success">
          <CheckCircle2 size={11} />
          <span>Chunk #{chunkCount} transcribed ✓</span>
        </div>
      );
    }
    if (chunkStatus === 'error') {
      return (
        <div className="chunk-status-pill chunk-status-pill--danger">
          <AlertCircle size={11} />
          <span>Chunk error (retrying next)</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="audio-controls">
      {/* Microphone permission error */}
      {micError && (
        <div className="consent-box consent-box--error">
          <MicOff size={16} className="icon-danger" />
          <span className="consent-box-text">{micError}</span>
        </div>
      )}

      {/* Dynamic Consent guard with Owner Name */}
      {!hasConsultation ? (
        <div className="consent-box consent-box--neutral">
          <div className="consent-box-content">
            <AlertCircle size={16} className="icon-muted" />
            <span>No active consultation selected. Please click <strong>+ New Consultation</strong> above to begin.</span>
          </div>
        </div>
      ) : !consentGiven && (
        <div className="consent-box">
          <div className="consent-box-content">
            <AlertCircle size={16} className="icon-warning" />
            <span>Recording consent required from <strong>{ownerName || 'Pet Owner'}</strong> before audio capture.</span>
          </div>
          <button
            type="button"
            className="btn btn-primary consent-action-btn"
            onClick={onGrantConsent}
          >
            Record Consent from {ownerName || 'Owner'}
          </button>
        </div>
      )}

      {/* Timer row */}
      <div className="controls-row">
        <div className="timer-box">
          {status === 'recording' ? (
            <div className="recording-pulse-wrap">
              <span className="recording-pulse" />
              <div className="live-audio-visualizer" title="Microphone capturing live audio stream">
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
              </div>
            </div>
          ) : (
            <div className="timer-idle-dot" />
          )}

          <span className="tabular-timer">{formatTimer(seconds)}</span>
          <span className="status-pill">{status}</span>
        </div>

        <div className="button-group">
          {/* While recording */}
          {status === 'recording' && (
            <>
              <button type="button" className="btn btn-outline btn-control-action" onClick={onPause} title="Pause — uploads current audio chunk">
                <Pause size={14} /> Pause
              </button>
              <button type="button" className="btn btn-danger btn-control-action" onClick={() => onStop(seconds)} title="Stop & generate clinical documents">
                <Square size={14} /> Stop & Scribe
              </button>
            </>
          )}

          {/* While paused */}
          {status === 'paused' && (
            <>
              <button type="button" className="btn btn-primary btn-control-action" onClick={onResume}>
                <Play size={14} /> Resume
              </button>
              <button type="button" className="btn btn-danger btn-control-action" onClick={() => onStop(seconds)}>
                <Square size={14} /> Stop & Scribe
              </button>
            </>
          )}

          {/* Idle states (scheduled, processing, completed): ALWAYS show Start Recording & Upload Audio */}
          {status !== 'recording' && status !== 'paused' && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-control-action"
                disabled={!hasConsultation || !consentGiven || isUploadingAudio}
                onClick={onStart}
                title={!hasConsultation ? 'Create or select a consultation first' : (!consentGiven ? 'Provide consent first' : 'Start live Whisper audio capture')}
              >
                <Mic size={14} />
                <span>{status === 'completed' || status === 'processing' ? 'Record More' : 'Start Recording'}</span>
              </button>

              <label
                className={`btn-upload-action ${isUploadingAudio ? 'btn-upload-action--busy' : ''}`}
                title="Upload pre-recorded consultation audio file (.wav, .mp3, .m4a, .webm)"
              >
                {isUploadingAudio ? (
                  <>
                    <Loader2 size={14} className="spin-animate" />
                    <span>Scribing...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} className="icon-primary" />
                    <span>Upload Audio</span>
                  </>
                )}
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac,.mp4"
                  className="hidden-file-input"
                  disabled={isUploadingAudio}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUploadAudio) onUploadAudio(file);
                    e.target.value = '';
                  }}
                />
              </label>

              {onReset && (status === 'processing' || status === 'completed') && (
                <button
                  type="button"
                  className="btn btn-outline btn-control-action btn-reset-action"
                  onClick={onReset}
                  title="Reset consultation to clean scheduled state"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Speaker Diarizer Segmented Control + Chunk Status */}
      {(status === 'recording' || status === 'paused') && (
        <div className="speaker-controls-bar">
          <div className="speaker-controls-left">
            <span className="speaker-label">SPEAKER:</span>

            <div className="segmented-control">
              {/* Auto AI Diarizer */}
              <button
                type="button"
                className={`segmented-btn ${currentSpeaker === 'auto' ? 'active' : ''}`}
                onClick={() => onToggleSpeaker('auto')}
                title="Automatically classify Doctor vs Owner using AI clinical turn diarization"
              >
                <Sparkles size={12} className={currentSpeaker === 'auto' ? 'icon-success' : 'icon-muted'} />
                <span>Auto AI Diarizer</span>
              </button>

              {/* Veterinarian */}
              <button
                type="button"
                className={`segmented-btn ${currentSpeaker === 'doctor' ? 'active' : ''}`}
                onClick={() => onToggleSpeaker('doctor')}
                title="Force current speaker tag to Attending Veterinarian"
              >
                <Stethoscope size={12} className={currentSpeaker === 'doctor' ? 'icon-primary' : 'icon-muted'} />
                <span>{doctorName ? `Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}` : 'Veterinarian'}</span>
              </button>

              {/* Pet Owner */}
              <button
                type="button"
                className={`segmented-btn ${currentSpeaker === 'owner' ? 'active' : ''}`}
                onClick={() => onToggleSpeaker('owner')}
                title="Force current speaker tag to Pet Owner"
              >
                <User size={12} className="icon-muted" />
                <span>{ownerName || 'Pet Owner'}</span>
              </button>
            </div>
          </div>

          {/* Whisper chunk status badge */}
          <ChunkStatusBadge />
        </div>
      )}

      {/* Whisper info banner — first time */}
      {status === 'recording' && chunkCount === 0 && (
        <div className="audio-whisper-hint">
          <Upload size={12} className="icon-primary" />
          <span>Local audio capture active. Transcribing via <strong>Whisper Large V3</strong> every 15s.</span>
        </div>
      )}
    </div>
  );
}
