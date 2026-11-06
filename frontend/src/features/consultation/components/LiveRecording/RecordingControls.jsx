import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Square, Mic, MicOff, AlertCircle,
  Sparkles, Upload, Stethoscope, User, Loader2, CheckCircle2, RotateCcw,
} from 'lucide-react';

export function RecordingControls({
  status,
  consentGiven,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.725rem', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '9999px', fontWeight: 600 }}>
          <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
          <span>{chunkStatus === 'uploading' ? 'Uploading chunk...' : 'Whisper transcribing...'}</span>
        </div>
      );
    }
    if (chunkStatus === 'done') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.725rem', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '9999px', fontWeight: 600 }}>
          <CheckCircle2 size={11} />
          <span>Chunk #{chunkCount} transcribed ✓</span>
        </div>
      );
    }
    if (chunkStatus === 'error') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.725rem', color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', padding: '3px 8px', borderRadius: '9999px', fontWeight: 600 }}>
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
        <div className="consent-box" style={{ background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }}>
          <MicOff size={16} color="#e11d48" />
          <span style={{ flex: 1 }}>{micError}</span>
        </div>
      )}

      {/* Dynamic Consent guard with Owner Name */}
      {!consentGiven && (
        <div className="consent-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} color="#d97706" />
            <span>Recording consent required from <strong>{ownerName || 'Pet Owner'}</strong> before audio capture.</span>
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }} />
          )}

          <span className="tabular-timer">{formatTimer(seconds)}</span>
          <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            [{status}]
          </span>
        </div>

        <div className="button-group">
          {/* While recording */}
          {status === 'recording' && (
            <>
              <button className="btn btn-outline" onClick={onPause} title="Pause — uploads current audio chunk">
                <Pause size={14} /> Pause
              </button>
              <button className="btn btn-danger" onClick={() => onStop(seconds)} title="Stop & generate clinical documents">
                <Square size={14} /> Stop & Scribe
              </button>
            </>
          )}

          {/* While paused */}
          {status === 'paused' && (
            <>
              <button className="btn btn-primary" onClick={onResume}>
                <Play size={14} /> Resume
              </button>
              <button className="btn btn-danger" onClick={() => onStop(seconds)}>
                <Square size={14} /> Stop & Scribe
              </button>
            </>
          )}

          {/* Idle states (scheduled, processing, completed): ALWAYS show Start Recording */}
          {status !== 'recording' && status !== 'paused' && (
            <>
              <button
                className="btn btn-primary"
                disabled={!consentGiven}
                onClick={onStart}
                title={!consentGiven ? 'Provide consent first' : 'Start live Whisper audio capture'}
              >
                <Mic size={14} /> {status === 'completed' || status === 'processing' ? 'Record More Audio' : 'Start Recording'}
              </button>

              {onReset && (status === 'processing' || status === 'completed') && (
                <button
                  className="btn btn-outline"
                  onClick={onReset}
                  title="Reset consultation to clean scheduled state"
                  style={{ fontSize: '0.78rem' }}
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Speaker Diarizer Segmented Control + Chunk Status */}
      {(status === 'recording' || status === 'paused') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>SPEAKER:</span>

            <div className="segmented-control">
              {/* Auto AI Diarizer */}
              <button
                type="button"
                className={`segmented-btn ${currentSpeaker === 'auto' ? 'active' : ''}`}
                onClick={() => onToggleSpeaker('auto')}
                title="Automatically classify Doctor vs Owner using AI clinical turn diarization"
              >
                <Sparkles size={12} color={currentSpeaker === 'auto' ? '#059669' : '#64748b'} />
                <span>Auto AI Diarizer</span>
              </button>

              {/* Veterinarian */}
              <button
                type="button"
                className={`segmented-btn ${currentSpeaker === 'doctor' ? 'active' : ''}`}
                onClick={() => onToggleSpeaker('doctor')}
                title="Force current speaker tag to Attending Veterinarian"
              >
                <Stethoscope size={12} color={currentSpeaker === 'doctor' ? '#0284c7' : '#64748b'} />
                <span>{doctorName ? `Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}` : 'Veterinarian'}</span>
              </button>

              {/* Pet Owner */}
              <button
                type="button"
                className={`segmented-btn ${currentSpeaker === 'owner' ? 'active' : ''}`}
                onClick={() => onToggleSpeaker('owner')}
                title="Force current speaker tag to Pet Owner"
              >
                <User size={12} color={currentSpeaker === 'owner' ? '#475569' : '#64748b'} />
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
        <div style={{ fontSize: '0.74rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Upload size={12} color="#0284c7" />
          <span>Local audio capture active. Transcribing via <strong>OpenAI Whisper API</strong> every 15s.</span>
        </div>
      )}
    </div>
  );
}
