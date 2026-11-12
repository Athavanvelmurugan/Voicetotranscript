import React, { useEffect, useRef } from 'react';
import { User, Stethoscope, Mic, Upload, Sparkles, Loader2 } from 'lucide-react';

export function LiveTranscript({ segments, partialSegment, doctorName, ownerName, isUploadingAudio = false }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments, partialSegment, isUploadingAudio]);

  const getSpeakerStyle = (speakerRole) => {
    if (speakerRole === 'doctor') return 'transcript-doctor';
    if (speakerRole === 'owner') return 'transcript-owner';
    return 'transcript-owner';
  };

  const getSpeakerLabel = (speakerRole) => {
    if (speakerRole === 'doctor') {
      return doctorName ? `${doctorName.toUpperCase()} (VET)` : 'VETERINARIAN';
    }
    return ownerName ? `${ownerName.toUpperCase()} (OWNER)` : 'PET OWNER';
  };

  return (
    <div className="transcript-container">
      {segments.length === 0 && !partialSegment && (
        <div className="transcript-empty-state">
          <div className="transcript-empty-icon-box">
            <Mic size={28} />
          </div>
          <p className="transcript-empty-title">
            Live Clinical Transcript Ready
          </p>
          <p className="transcript-empty-sub">
            Press <strong>Start Recording</strong> to capture clinical dialogue. Audio is transcribed in real-time via <strong>Whisper Large V3</strong>.
          </p>
        </div>
      )}

      {segments.map((seg, idx) => {
        const role = seg.speaker_role || seg.speakerRole || 'doctor';
        const isDoctor = role === 'doctor';
        const sourceIsWhisper = seg.source === 'whisper-1' || seg.source === 'whisper_upload';
        const segSeq = seg.sequence_number ?? seg.sequenceOffset ?? (idx + 1);
        const segStartMs = seg.start_ms ?? seg.startMs ?? 0;
        const segKey = seg.id
          || (seg.sequence_number != null ? `${seg.consultation_id || 'c'}-${seg.sequence_number}` : null)
          || (seg.sequenceOffset != null ? `offset-${seg.sequenceOffset}` : `seg-${idx}`);

        return (
          <div
            key={segKey}
            className={`transcript-message ${getSpeakerStyle(role)}`}
          >
            <div className="transcript-meta">
              <span className="transcript-speaker-wrap">
                <span className={`transcript-speaker-avatar ${isDoctor ? 'transcript-speaker-avatar--doctor' : 'transcript-speaker-avatar--owner'}`}>
                  {isDoctor ? <Stethoscope size={10} /> : <User size={10} />}
                </span>
                <span className="transcript-speaker-name">{getSpeakerLabel(role)}</span>
                {sourceIsWhisper && (
                  <span className="transcript-whisper-tag">
                    Whisper
                  </span>
                )}
              </span>

              <span className="transcript-seq-meta">
                #{segSeq}
                {segStartMs > 0 && ` · ${(segStartMs / 1000).toFixed(1)}s`}
                {seg.confidence ? ` · ${(seg.confidence * 100).toFixed(0)}%` : ''}
              </span>
            </div>
            <div className="transcript-body-text">{seg.text}</div>
          </div>
        );
      })}

      {/* Partial (live) segment — shown while recording between chunks */}
      {partialSegment && (
        <div className="transcript-message transcript-partial">
          <div className="transcript-meta">
            <span className="transcript-speaker-wrap">
              <Upload size={11} className="icon-warning" />
              <span>{getSpeakerLabel(partialSegment.speaker)} (Uploading...)</span>
            </span>
            <span className="transcript-partial-status">processing</span>
          </div>
          <div className="transcript-partial-text">{partialSegment.text || '...'}</div>
        </div>
      )}

      {/* Scribe Rolling Loading Animation — shown while audio file is uploading and transcribing */}
      {isUploadingAudio && (
        <div className="transcript-uploading-banner">
          <div className="uploading-visualizer" title="Whisper speech recognition actively scribing audio stream">
            <span className="wave-bar-scribe" />
            <span className="wave-bar-scribe" />
            <span className="wave-bar-scribe" />
            <span className="wave-bar-scribe" />
            <span className="wave-bar-scribe" />
            <span className="wave-bar-scribe" />
            <span className="wave-bar-scribe" />
            <span className="wave-bar-scribe" />
          </div>
          <div className="uploading-text-block">
            <div className="uploading-title">
              <Loader2 size={13} className="spin-animate" />
              <span>Scribing Consultation Audio...</span>
            </div>
            <p className="uploading-subtitle">
              Whisper Large V3 is transcribing audio, detecting voice activity, and diarizing speaker turns.
            </p>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
