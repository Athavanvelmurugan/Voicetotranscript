/**
 * Audio Upload Controller
 * ───────────────────────
 * Handles POST /api/v1/consultations/:id/audio-chunk
 *
 * Flow:
 *  1. Receive multipart/form-data audio blob (from browser MediaRecorder)
 *  2. Validate consultation ownership and consent
 *  3. Send audio file to Whisper API for transcription
 *  4. Parse returned timestamped segments
 *  5. Save each segment to DB (with deduplication)
 *  6. Broadcast each segment to WebSocket subscribers
 *  7. Delete temp audio file
 *  8. Return segments to the calling browser
 */

const fs = require('fs');
const whisperClient = require('../transcription/whisper.client');
const speakerClassifier = require('../transcription/speaker.classifier');
const audioStorage = require('./audio.storage');
const transcriptAccumulator = require('../transcription/transcript.accumulator');
const consultationRepo = require('../consultations/consultation.repository');
const sessionManager = require('../realtime/ws.session.manager');
const auditService = require('../audit/audit.service');
const db = require('../../db/connection');

class AudioController {
  async uploadChunk(req, res, next) {
    const consultationId = parseInt(req.params.id, 10);
    let tempFilePath = null;

    try {
      // 1. Validate file was received and written to disk
      if (!req.file || !req.file.path || !fs.existsSync(req.file.path)) {
        return res.status(400).json({
          success: false,
          error: 'No audio file received. Send multipart/form-data with field name "audio".',
        });
      }

      tempFilePath = req.file.path;

      // 2. Parse metadata from form fields
      const speakerRole = req.body.speakerRole || 'unknown';
      const chunkIndex = parseInt(req.body.chunkIndex, 10) || 0;
      const language = req.body.language || 'en';
      const doctorId = parseInt(req.headers['x-doctor-id'], 10) || 1;

      // 3. Validate consultation exists
      const consultation = await consultationRepo.findById(consultationId);
      if (!consultation) {
        return res.status(404).json({ success: false, error: `Consultation #${consultationId} not found.` });
      }

      if (!['recording', 'paused', 'processing'].includes(consultation.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot upload audio for consultation in '${consultation.status}' state. It must be recording or paused.`,
        });
      }

      // 4. Validate file size (Whisper limit: 25MB)
      audioStorage.validateSize(tempFilePath);

      const fileSizeMB = audioStorage.fileSizeMB(tempFilePath).toFixed(2);
      console.log(`[AudioController] chunk #${chunkIndex} | size=${fileSizeMB}MB | speaker=${speakerRole} | lang=${language}`);

      // 5. Get current max sequence for this consultation to avoid gaps
      const existingSegments = await consultationRepo.getTranscriptSegments(consultationId, false);
      const baseSequence = existingSegments.length > 0
        ? Math.max(...existingSegments.map(s => s.sequence_number))
        : 0;

      // 6. Call Whisper
      const transcriptionResult = await whisperClient.transcribe({
        filePath: tempFilePath,
        language: consultation.language || language,
        speakerRole,
        chunkIndex,
        baseSequence,
      });

      // 7. Save each returned segment to DB and broadcast via WebSocket
      const savedSegments = [];
      for (const seg of transcriptionResult.segments) {
        // Automatically determine or verify speaker role using Semantic Diarizer
        const resolvedSpeaker = speakerClassifier.classify(seg.text, speakerRole);

        const saved = await transcriptAccumulator.addSegment({
          consultationId,
          sequenceNumber: seg.sequenceOffset,
          text: seg.text,
          isPartial: false,
          speakerRole: resolvedSpeaker,
          languageDetected: transcriptionResult.detectedLanguage,
          confidence: seg.confidence,
          startMs: seg.startMs,
          endMs: seg.endMs,
          source: 'whisper-1',
        });

        savedSegments.push(saved);

        // Broadcast the new segment to all connected WebSocket clients
        sessionManager.broadcast(consultationId, {
          event: 'transcript_final',
          segment: saved,
        });
      }

      // 8. Audit log the transcription
      await auditService.log({
        consultationId,
        actorId: doctorId,
        actorType: 'system',
        action: 'audio_chunk_transcribed',
        entityType: 'transcript_segments',
        metadata: {
          chunkIndex,
          segmentsCreated: savedSegments.length,
          detectedLanguage: transcriptionResult.detectedLanguage,
          speakerRole,
          fileSizeMB,
        },
      });

      return res.json({
        success: true,
        data: {
          chunkIndex,
          detectedLanguage: transcriptionResult.detectedLanguage,
          segmentsCreated: savedSegments.length,
          segments: savedSegments,
        },
      });

    } catch (err) {
      console.error('[AudioController] Error processing audio chunk:', err.message);
      next(err);
    } finally {
      // Always clean up temp file
      if (tempFilePath) {
        audioStorage.cleanup(tempFilePath);
      }
    }
  }
}

module.exports = new AudioController();

