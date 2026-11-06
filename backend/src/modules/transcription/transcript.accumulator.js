const repo = require('../consultations/consultation.repository');

class TranscriptAccumulator {
  constructor() {
    // consultationId -> Map of sequenceNumber -> segment
    this.memoryBuffers = new Map();
  }

  getBuffer(consultationId) {
    if (!this.memoryBuffers.has(consultationId)) {
      this.memoryBuffers.set(consultationId, new Map());
    }
    return this.memoryBuffers.get(consultationId);
  }

  async addSegment({
    consultationId,
    sequenceNumber,
    text,
    isPartial = false,
    speakerRole = 'unknown',
    languageDetected = 'en',
    confidence = 1.0,
    startMs = 0,
    endMs = 0,
    source = 'openai_realtime',
  }) {
    const buffer = this.getBuffer(consultationId);

    // Save final segment in DB
    const saved = await repo.insertTranscriptSegment({
      consultationId,
      sequenceNumber,
      text,
      isPartial,
      speakerRole,
      languageDetected,
      confidence,
      startMs,
      endMs,
      source,
    });

    if (!isPartial) {
      buffer.set(sequenceNumber, saved);
    }

    return saved;
  }

  async getCompleteTranscript(consultationId) {
    // Read directly from DB for completeness and ordering
    const segments = await repo.getTranscriptSegments(consultationId, false);
    const fullText = segments
      .map(s => `[${s.speaker_role.toUpperCase()}] ${s.text}`)
      .join('\n');

    return {
      segments,
      fullText,
      totalSegments: segments.length,
    };
  }

  clearBuffer(consultationId) {
    this.memoryBuffers.delete(consultationId);
  }
}

module.exports = new TranscriptAccumulator();

