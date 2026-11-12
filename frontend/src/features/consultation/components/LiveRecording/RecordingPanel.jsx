import React from 'react';
import { Mic, Activity, Sparkles, Loader2 } from 'lucide-react';
import { RecordingControls } from './RecordingControls';
import { LiveTranscript } from './LiveTranscript';

export function RecordingPanel({
  status,
  consentGiven,
  hasConsultation = true,
  onGrantConsent,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  segments,
  partialSegment,
  // Clinical identity props
  doctorName,
  ownerName,
  // Microphone / Whisper props
  currentSpeaker,
  onToggleSpeaker,
  chunkStatus,
  chunkCount,
  micPermission,
  micError,
  // Audio Upload Props
  onUploadAudio,
  isUploadingAudio = false,
  // Bottom Generate / Insights Trigger
  onOpenInsightsModal,
  isGenerating,
}) {
  return (
    <section className="recording-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Mic size={17} className="icon-primary" />
          <span>Live Audio & Whisper Scribe</span>
        </div>
        <div className="panel-segments-meta">
          <Activity size={13} className="icon-success" />
          <span className="panel-segments-count">
            {segments.length} segment{segments.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <RecordingControls
        status={status}
        consentGiven={consentGiven}
        hasConsultation={hasConsultation}
        onGrantConsent={onGrantConsent}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onReset={onReset}
        doctorName={doctorName}
        ownerName={ownerName}
        currentSpeaker={currentSpeaker}
        onToggleSpeaker={onToggleSpeaker}
        chunkStatus={chunkStatus}
        chunkCount={chunkCount}
        micPermission={micPermission}
        micError={micError}
        onUploadAudio={onUploadAudio}
        isUploadingAudio={isUploadingAudio}
      />

      <div className="transcript-scroll-body">
        <LiveTranscript
          segments={segments}
          partialSegment={partialSegment}
          doctorName={doctorName}
          ownerName={ownerName}
          isUploadingAudio={isUploadingAudio}
        />
      </div>

      {/* Bottom Generate & Clinical Insights Action Dock */}
      {onOpenInsightsModal && (
        <div className="transcript-bottom-bar">
          <button
            type="button"
            className="btn btn-primary btn-generate-insights"
            onClick={onOpenInsightsModal}
            disabled={isGenerating}
            title="Generate and view clinical insights popup (Summary, Medicine, Tests, Follow-ups)"
          >
            {isGenerating ? (
              <div className="btn-insights-content">
                <Loader2 size={18} className="spin-animate" />
                <div className="btn-insights-text">
                  <span className="btn-insights-title">Extracting Clinical Insights...</span>
                  <span className="btn-insights-subtitle">Synthesizing audio transcripts with AI</span>
                </div>
              </div>
            ) : (
              <div className="btn-insights-content">
                <div className="btn-insights-icon-box">
                  <Sparkles size={18} className="icon-on-primary" />
                </div>
                <div className="btn-insights-text">
                  <span className="btn-insights-title">Generate & View Clinical Insights</span>
                  <span className="btn-insights-subtitle">Summary • Prescription • Lab Tests</span>
                </div>
              </div>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
