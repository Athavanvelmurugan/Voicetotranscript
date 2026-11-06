import React, { useEffect, useRef } from 'react';
import { User, Stethoscope, Mic, Upload, Sparkles } from 'lucide-react';

export function LiveTranscript({ segments, partialSegment, doctorName, ownerName }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments, partialSegment]);

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
        <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto', padding: '50px 24px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
            <Mic size={28} color="#0284c7" style={{ opacity: 0.8 }} />
          </div>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', letterSpacing: '-0.01em' }}>
            Live Clinical Transcript Ready
          </p>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', lineHeight: 1.6, maxWidth: '320px', margin: '6px auto 0 auto' }}>
            Press <strong>Start Recording</strong> to capture clinical dialogue. Audio is transcribed in real-time via <strong>Whisper API</strong>.
          </p>
        </div>
      )}

      {segments.map((seg) => {
        const isDoctor = seg.speaker_role === 'doctor';
        const sourceIsWhisper = seg.source === 'whisper-1';

        return (
          <div
            key={seg.id || `${seg.consultation_id}-${seg.sequence_number}`}
            className={`transcript-message ${getSpeakerStyle(seg.speaker_role)}`}
          >
            <div className="transcript-meta">
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: isDoctor ? '#e0f2fe' : '#f1f5f9',
                  color: isDoctor ? '#0284c7' : '#475569',
                }}>
                  {isDoctor ? <Stethoscope size={10} /> : <User size={10} />}
                </span>
                <span style={{ letterSpacing: '0.02em' }}>{getSpeakerLabel(seg.speaker_role)}</span>
                {sourceIsWhisper && (
                  <span style={{ fontSize: '0.62rem', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '1px 5px', borderRadius: '9999px', marginLeft: '2px', fontWeight: 700 }}>
                    Whisper
                  </span>
                )}
              </span>

              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: '#64748b' }}>
                #{seg.sequence_number}
                {seg.start_ms > 0 && ` · ${(seg.start_ms / 1000).toFixed(1)}s`}
                {seg.confidence ? ` · ${(seg.confidence * 100).toFixed(0)}%` : ''}
              </span>
            </div>
            <div style={{ color: '#1e293b', fontSize: '0.86rem' }}>{seg.text}</div>
          </div>
        );
      })}

      {/* Partial (live) segment — shown while recording between chunks */}
      {partialSegment && (
        <div className="transcript-message transcript-partial">
          <div className="transcript-meta">
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Upload size={11} color="#d97706" />
              <span>{getSpeakerLabel(partialSegment.speaker)} (Uploading...)</span>
            </span>
            <span style={{ fontSize: '0.7rem', color: '#b45309' }}>processing</span>
          </div>
          <div style={{ color: '#78350f' }}>{partialSegment.text || '...'}</div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
