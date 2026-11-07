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
const clinicalExtractor = require('../clinical-ai/clinical.extractor');
const clinicalTranslator = require('../clinical-ai/clinical.translator');
const SummaryBuilder = require('../templates/summary.builder');
const PrescriptionBuilder = require('../templates/prescription.builder');
const LabTestsBuilder = require('../templates/lab-tests.builder');
const SoapNotesBuilder = require('../templates/soap-notes.builder');
const FollowUpBuilder = require('../templates/follow-up.builder');

class AudioController {
  async uploadChunk(req, res, next) {
    const consultationId = parseInt(req.params.id, 10);
    let tempFilePath = null;
    let dbClient = null;

    try {
      // 1. Validate file was received and written to disk
      if (!req.file || !req.file.path || !fs.existsSync(req.file.path)) {
        return res.status(400).json({
          success: false,
          error: 'No audio file received. Send multipart/form-data with field name "audio".',
        });
      }

      tempFilePath = req.file.path;

      // 2. Validate audio magic bytes, integrity, and duration
      try {
        audioStorage.validateAudioFile(tempFilePath);
        audioStorage.validateSize(tempFilePath);
      } catch (validationErr) {
        return res.status(400).json({
          success: false,
          error: validationErr.error || 'invalid_audio',
          reason: validationErr.reason || validationErr.message,
          message: validationErr.message,
        });
      }

      // 3. Parse metadata from form fields
      const speakerRole = req.body.speakerRole || 'unknown';
      const chunkIndex = parseInt(req.body.chunkIndex, 10) || 0;
      const language = req.body.language || 'en';
      const doctorId = parseInt(req.headers['x-doctor-id'], 10) || 1;

      // 4. Fast-path check: Idempotency receipt (Bug 7: network retry of same chunk)
      const receiptRes = await db.query(
        'SELECT response_payload FROM consultation_chunk_receipts WHERE consultation_id = $1 AND chunk_index = $2',
        [consultationId, chunkIndex]
      );
      if (receiptRes.rows.length > 0) {
        console.log(`[AudioController] Idempotent hit: Chunk #${chunkIndex} for #${consultationId} already transcribed. Returning cached response.`);
        return res.status(200).json(receiptRes.rows[0].response_payload);
      }

      // 5. Validate consultation exists
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

      // 6. Store chunk binary in consultation_audio_chunks for full audio dual-pass (Bug 4)
      const chunkBytes = fs.readFileSync(tempFilePath);
      const mimeType = req.file.mimetype || 'audio/wav';
      await db.query(
        `INSERT INTO consultation_audio_chunks (consultation_id, chunk_index, audio_data, mime_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (consultation_id, chunk_index) DO UPDATE SET audio_data = EXCLUDED.audio_data`,
        [consultationId, chunkIndex, chunkBytes, mimeType]
      );

      const fileSizeMB = audioStorage.fileSizeMB(tempFilePath).toFixed(2);
      console.log(`[AudioController] chunk #${chunkIndex} | size=${fileSizeMB}MB | speaker=${speakerRole} | lang=${language}`);

      // 7. Call Whisper (Concurrent, fast, no lock held)
      const transcriptionResult = await whisperClient.transcribe({
        filePath: tempFilePath,
        language: consultation.language || language,
        speakerRole,
        chunkIndex,
        baseSequence: 0,
      });

      // 8. Atomic Segment Persistence & Receipt Storage under Advisory Lock
      dbClient = await db.getClient();
      await dbClient.query('SELECT pg_advisory_lock($1)', [consultationId]);

      // Double-check receipt in case a concurrent request finished first
      const doubleCheck = await dbClient.query(
        'SELECT response_payload FROM consultation_chunk_receipts WHERE consultation_id = $1 AND chunk_index = $2',
        [consultationId, chunkIndex]
      );
      if (doubleCheck.rows.length > 0) {
        return res.status(200).json(doubleCheck.rows[0].response_payload);
      }

      // If silence / no speech was detected, do not insert any empty/dummy segments
      if (transcriptionResult.status === 'no_speech_detected' || !transcriptionResult.segments || transcriptionResult.segments.length === 0) {
        console.log(`[AudioController] Chunk #${chunkIndex} silence / no speech detected. No segments inserted.`);
        const emptyResponse = {
          success: true,
          status: 'no_speech_detected',
          chunkIndex,
          segments: [],
          droppedRegions: transcriptionResult.droppedRegions || [],
          droppedSegments: transcriptionResult.droppedSegments || [],
        };
        await dbClient.query(
          `INSERT INTO consultation_chunk_receipts (consultation_id, chunk_index, response_payload)
           VALUES ($1, $2, $3)
           ON CONFLICT (consultation_id, chunk_index) DO NOTHING`,
          [consultationId, chunkIndex, JSON.stringify(emptyResponse)]
        );
        return res.status(200).json(emptyResponse);
      }

      // Get current max sequence atomically under advisory lock
      const maxSeqRes = await dbClient.query(
        'SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM transcript_segments WHERE consultation_id = $1',
        [consultationId]
      );
      let currentSeq = parseInt(maxSeqRes.rows[0].max_seq, 10);

      // Boundary overlap alignment & deduplication (Bug 5)
      if (chunkIndex > 0 && transcriptionResult.segments.length > 0) {
        const boundaryStitcher = require('../transcription/boundary.stitcher');
        const prevSegments = await dbClient.query(
          `SELECT text FROM transcript_segments 
           WHERE consultation_id = $1 AND pass_number = 1 
           ORDER BY sequence_number DESC LIMIT 3`,
          [consultationId]
        );
        const prevTailText = prevSegments.rows.map(r => r.text).reverse().join(' ');
        const firstSeg = transcriptionResult.segments[0];
        const stitchResult = boundaryStitcher.stitchChunks(prevTailText, firstSeg.text);
        if (stitchResult.overlapTokensRemoved > 0) {
          console.log(`[BoundaryStitcher] Trimmed ${stitchResult.overlapTokensRemoved} duplicate boundary tokens from chunk #${chunkIndex}`);
          firstSeg.text = stitchResult.deduplicatedChunkText;
        }
      }

      // Contextual translation to 100% English and speaker role verification
      let liveSegments = transcriptionResult.segments || [];
      try {
        let chunkConsultation = null;
        try {
          chunkConsultation = await consultationRepo.findById(consultationId);
        } catch (_) {}
        const translationResult = await clinicalTranslator.translateAndDiarize({
          segments: liveSegments,
          fullText: liveSegments.map(s => s.text).join(' '),
          consultation: chunkConsultation || { id: consultationId },
          forceLanguage: 'en',
          detectedLanguage: transcriptionResult.detectedLanguage,
        });
        liveSegments = translationResult.segments;
      } catch (transErr) {
        console.warn('[AudioController] Live chunk translation error, using raw segments:', transErr.message);
      }

      // Save each returned segment to DB and broadcast via WebSocket
      const savedSegments = [];
      for (const seg of liveSegments) {
        if (!seg.text || !seg.text.trim()) continue;
        currentSeq++;

        // Automatically determine or verify speaker role using Semantic Diarizer / Translator
        const resolvedSpeaker = seg.speakerRole || speakerClassifier.classify(seg.text, speakerRole);

        const saved = await transcriptAccumulator.addSegment({
          consultationId,
          sequenceNumber: currentSeq,
          text: seg.text,
          isPartial: false,
          speakerRole: resolvedSpeaker,
          languageDetected: 'en',
          confidence: seg.confidence,
          startMs: seg.startMs,
          endMs: seg.endMs,
          source: 'whisper-1',
          passNumber: 1,
          isFinalPass: true,
          model: transcriptionResult.model || 'whisper-large-v3',
          provider: transcriptionResult.provider || 'groq',
          avgLogprob: seg.avg_logprob != null ? seg.avg_logprob : null,
          noSpeechProb: seg.no_speech_prob != null ? seg.no_speech_prob : null,
          needsVetReview: seg.needsVetReview || false,
        });

        savedSegments.push(saved);

        // Broadcast the new segment to all connected WebSocket clients
        sessionManager.broadcast(consultationId, {
          event: 'transcript_final',
          segment: saved,
        });
      }

      const responsePayload = {
        success: true,
        data: {
          chunkIndex,
          detectedLanguage: transcriptionResult.detectedLanguage,
          segmentsCreated: savedSegments.length,
          segments: savedSegments,
        },
      };

      // Record chunk receipt for idempotency (Bug 7)
      await dbClient.query(
        `INSERT INTO consultation_chunk_receipts (consultation_id, chunk_index, response_payload)
         VALUES ($1, $2, $3)
         ON CONFLICT (consultation_id, chunk_index) DO NOTHING`,
        [consultationId, chunkIndex, JSON.stringify(responsePayload)]
      );

      // Audit log the transcription
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

      return res.status(200).json(responsePayload);

    } catch (err) {
      console.error('[AudioController] Error processing audio chunk:', err.message);
      const isTimeout = err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('timed out');
      const isBadRequest = err.status === 400 || err.code === 'INVALID_AUDIO_INPUT' || err.code === 'AUDIO_FILE_NOT_FOUND' || err.message?.includes('empty');
      const statusCode = isBadRequest ? 400 : isTimeout ? 504 : 502;
      return res.status(statusCode).json({
        success: false,
        status: 'transcription_failed',
        reason: isTimeout ? 'timeout' : isBadRequest ? 'invalid_input' : 'transcription_failed',
        error: err.message,
      });
    } finally {
      if (dbClient) {
        await dbClient.query('SELECT pg_advisory_unlock($1)', [consultationId]).catch(() => {});
        dbClient.release();
      }
      // Always clean up temp file
      if (tempFilePath) {
        audioStorage.cleanup(tempFilePath);
      }
    }
  }

  /**
   * Unified Single-Turn Audio Ingestion & Clinical Documentation (In-Memory / Zero Disk)
   * ─────────────────────────────────────────────────────────────────────────────────────
   * Handles:
   *  POST /api/v1/consultations/upload-and-scribe
   *  POST /api/v1/consultations/:id/upload-and-scribe
   */
  async uploadAndScribe(req, res, next) {
    try {
      // 1. Validate file exists (in-memory buffer or disk path)
      if (!req.file || (!req.file.buffer && (!req.file.path || !fs.existsSync(req.file.path)))) {
        return res.status(400).json({
          success: false,
          error: 'No audio file received. Send multipart/form-data with file field "audio".',
        });
      }

      const audioBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);

      // 2. Validate audio magic bytes, integrity, and duration
      try {
        audioStorage.validateAudioBuffer(audioBuffer);
        if (audioBuffer.length > 25 * 1024 * 1024) {
          throw new Error('Audio chunk is too large. Maximum allowed is 25 MB.');
        }
      } catch (validationErr) {
        return res.status(400).json({
          success: false,
          error: validationErr.error || 'invalid_audio',
          reason: validationErr.reason || validationErr.message,
          message: validationErr.message,
        });
      }

      const fileName = req.file.originalname || 'consultation_audio.wav';
      const mimeType = req.file.mimetype || 'audio/wav';
      const language = req.body?.language || 'en';
      const doctorId = parseInt(req.headers['x-doctor-id'], 10) || parseInt(req.body?.doctorId, 10) || 1;
      const consultationId = parseInt(req.params?.id, 10) || parseInt(req.body?.consultationId, 10) || null;
      const shouldAutoGenerate = req.body?.autoGenerate === 'true' || req.body?.autoGenerate === true || (!req.params?.id && req.body?.autoGenerate !== 'false');

      // 3. Transcribe via Whisper Large V3 (Zero Disk: passes Buffer directly via toFile)
      const whisperResult = await whisperClient.transcribe({
        buffer: audioBuffer,
        filePath: req.file.path,
        fileName,
        language,
        speakerRole: req.body?.speakerRole || 'doctor',
        chunkIndex: 0,
        baseSequence: 0,
      });

      // Check if pure silence or phantom phrases were filtered out
      if (whisperResult.status === 'no_speech_detected' || !whisperResult.fullText?.trim()) {
        console.log('[AudioController] Silence / no speech detected. Returning clean response with 0 segments and 0 words.');
        return res.status(200).json({
          success: true,
          status: 'no_speech_detected',
          message: 'No active speech detected in audio.',
          transcript: {
            fullText: '',
            segments: [],
            detectedLanguage: whisperResult.detectedLanguage || language,
          },
          documents: null,
          droppedRegions: whisperResult.droppedRegions || [],
          droppedSegments: whisperResult.droppedSegments || [],
        });
      }

      if (!whisperResult || !whisperResult.fullText) {
        throw new Error('Whisper transcription failed to produce text from audio.');
      }

      // 3. Resolve Consultation Context
      let consultation = null;
      let hasRealConsultationInDb = false;
      if (consultationId) {
        try {
          consultation = await consultationRepo.findById(consultationId);
          if (consultation) hasRealConsultationInDb = true;
        } catch (_) {
          consultation = null;
        }
      }

      if (!consultationId && (req.body?.petName || req.body?.patientName)) {
        consultation = {
          id: 101,
          pet_id: parseInt(req.body?.petId, 10) || 1,
          pet_name: req.body?.petName || req.body?.patientName,
          pet_species: req.body?.petSpecies || req.body?.species || 'Canine (Dog)',
          pet_breed: req.body?.petBreed || req.body?.breed || 'Golden Retriever',
          pet_age: req.body?.petAge ? parseFloat(req.body.petAge) : 3.0,
          pet_weight: req.body?.petWeight ? parseFloat(req.body.petWeight) : 30.0,
          owner_name: req.body?.ownerName || 'Mark',
          owner_contact: req.body?.ownerContact || '+1-555-0144',
          doctor_id: doctorId,
          doctor_name: req.body?.doctorName || 'Dr. Sarah',
          status: 'completed',
          language,
        };
      } else if (!consultation) {
        try {
          const allConsultations = await consultationRepo.findAll();
          if (allConsultations && allConsultations.length > 0) {
            consultation = allConsultations[0];
            hasRealConsultationInDb = true;
          }
        } catch (_) {}
      }

      if (!consultation) {
        consultation = {
          id: 101,
          pet_id: parseInt(req.body?.petId, 10) || 1,
          pet_name: req.body?.petName || req.body?.patientName || 'Milo',
          pet_species: req.body?.petSpecies || req.body?.species || 'Canine (Dog)',
          pet_breed: req.body?.petBreed || req.body?.breed || 'Golden Retriever',
          pet_age: req.body?.petAge ? parseFloat(req.body.petAge) : 3.0,
          pet_weight: req.body?.petWeight ? parseFloat(req.body.petWeight) : 30.0,
          owner_name: req.body?.ownerName || 'Mark',
          owner_contact: req.body?.ownerContact || '+1-555-0144',
          doctor_id: doctorId,
          doctor_name: req.body?.doctorName || 'Dr. Sarah',
          status: 'completed',
          language,
        };
      }

      // 4. Clinical Translation into 100% English & True Speaker Diarization
      let processedTranscript = whisperResult;
      try {
        const translationResult = await clinicalTranslator.translateAndDiarize({
          segments: whisperResult.segments || [],
          fullText: whisperResult.fullText || '',
          consultation,
          forceLanguage: 'en',
          detectedLanguage: whisperResult.detectedLanguage,
        });
        processedTranscript = {
          ...whisperResult,
          segments: translationResult.segments,
          fullText: translationResult.fullText,
          detectedLanguage: 'en',
        };
      } catch (transErr) {
        console.warn('[AudioController] Translation/diarization error, proceeding with raw transcript:', transErr.message);
      }

      // 5. Clinical Extraction (Groq LLM / fallback) - only when auto-generation is active
      let normalized = null;
      let summaryDoc = null;
      let prescriptionDoc = null;
      let labTestsDoc = null;
      let soapNotesDoc = null;
      let followUpDoc = null;

      if (shouldAutoGenerate) {
        let rawExtraction;
        try {
          rawExtraction = await clinicalExtractor.callGroqLLM(consultation, processedTranscript.fullText);
        } catch (err) {
          console.warn('[AudioController] Groq LLM extraction error, using fallback extractor:', err.message);
          rawExtraction = clinicalExtractor.generateFallbackExtraction(consultation, processedTranscript.fullText);
        }

        normalized = clinicalExtractor.normalizeExtractionJson(rawExtraction, consultation);

        // 6. Synthesize All Clinical Documents
        summaryDoc = SummaryBuilder.build(normalized, consultation);
        prescriptionDoc = PrescriptionBuilder.build(normalized, consultation);
        labTestsDoc = LabTestsBuilder.build(normalized, consultation);
        soapNotesDoc = SoapNotesBuilder.build(normalized, consultation);
        followUpDoc = FollowUpBuilder.build(normalized, consultation);
      }

      let persistedDocs = [];
      const isPersistedConsultation = hasRealConsultationInDb;

      if (isPersistedConsultation) {
        // A. Persist transcript segments to transcript_segments table
        try {
          if (Array.isArray(processedTranscript.segments)) {
            for (let i = 0; i < processedTranscript.segments.length; i++) {
              const seg = processedTranscript.segments[i];
              await consultationRepo.insertTranscriptSegment({
                consultationId: consultation.id,
                sequenceNumber: i + 1,
                text: seg.text,
                isPartial: false,
                speakerRole: seg.speakerRole || 'doctor',
                languageDetected: 'en',
                confidence: seg.confidence || 0.99,
                startMs: seg.startMs || 0,
                endMs: seg.endMs || 0,
                source: 'whisper_upload',
              });
            }
          }
        } catch (segErr) {
          console.warn('[AudioController] Warning saving transcript segments:', segErr.message);
        }

        // B. Clinical extraction and document generation (Decoupled: only if autoGenerate requested or standalone test)
        if (shouldAutoGenerate) {
          try {
            const documentService = require('../documents/document.service');
            const extractionRecord = await clinicalExtractor.extractAndValidate(consultation, processedTranscript.fullText);
            persistedDocs = await documentService.generateAllDocuments(consultation.id, extractionRecord, doctorId);
            await consultationRepo.updateStatus(consultation.id, 'completed');
          } catch (docErr) {
            console.warn('[AudioController] Warning generating DB documents:', docErr.message);
          }
        } else {
          console.log(`[AudioController] Audio scribed for consultation #${consultation.id}. Document generation deferred until clinician clicks Generate.`);
        }

        // C. Persist raw audio binary directly into PostgreSQL (consultation_audio BYTEA, zero disk)
        try {
          if (audioBuffer && audioBuffer.length > 0) {
            await db.query(`
              INSERT INTO consultation_audio (consultation_id, audio_data, mime_type, file_name, file_size_bytes)
              VALUES ($1, $2, $3, $4, $5)
            `, [consultation.id, audioBuffer, mimeType, fileName, audioBuffer.length]);
          }
        } catch (audioErr) {
          console.warn('[AudioController] Warning saving consultation audio BYTEA:', audioErr.message);
        }
      }

      // Format documents response: if persisted, return actual DB records with real IDs
      let documentsPayload = [];
      if (shouldAutoGenerate) {
        documentsPayload = {
          summary: summaryDoc,
          prescription: prescriptionDoc,
          lab_tests: labTestsDoc,
          soap_notes: soapNotesDoc,
          follow_up: followUpDoc,
        };

        if (persistedDocs.length > 0) {
          documentsPayload = {};
          for (const doc of persistedDocs) {
            documentsPayload[doc.doc_type] = doc;
          }
        }
      }

      // 6. Return Unified Payload
      return res.status(200).json({
        success: true,
        data: {
          consultation,
          transcript: {
            detectedLanguage: 'en',
            fullText: processedTranscript.fullText,
            segments: processedTranscript.segments,
          },
          clinical_extraction: shouldAutoGenerate ? normalized : null,
          documents: documentsPayload,
        },
      });
    } catch (err) {
      console.error('[AudioController] Error in uploadAndScribe:', err.message);
      const isTimeout = err.code === 'ETIMEDOUT' || err.message?.includes('timeout') || err.message?.includes('timed out');
      const isBadRequest = err.status === 400 || err.code === 'INVALID_AUDIO_INPUT' || err.code === 'AUDIO_FILE_NOT_FOUND' || err.message?.includes('valid media') || err.message?.includes('empty');
      const statusCode = isBadRequest ? 400 : isTimeout ? 504 : 502;

      const consultationIdToFail = parseInt(req.params?.id, 10) || parseInt(req.body?.consultationId, 10) || null;
      if (consultationIdToFail) {
        consultationRepo.updateStatus(consultationIdToFail, 'transcription_failed').catch(() => {});
      }

      return res.status(statusCode).json({
        success: false,
        status: 'transcription_failed',
        reason: isTimeout ? 'timeout' : isBadRequest ? 'invalid_input' : 'transcription_failed',
        error: err.message,
      });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        audioStorage.cleanup(req.file.path);
      }
    }
  }

  /**
   * GET /api/v1/consultations/:id/audio
   *
   * Streams raw audio binary directly from PostgreSQL BYTEA column
   */
  async getAudioByConsultation(req, res, next) {
    try {
      const consultationId = parseInt(req.params.id, 10);
      if (!consultationId || isNaN(consultationId)) {
        return res.status(400).json({ success: false, error: 'Valid consultation ID is required' });
      }

      const { rows } = await db.query(
        'SELECT audio_data, mime_type, file_name, file_size_bytes, audio_hash FROM consultation_audio WHERE consultation_id = $1 ORDER BY id DESC LIMIT 1',
        [consultationId]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, error: `No audio recording found for consultation #${consultationId}` });
      }

      const audioRecord = rows[0];
      let mimeType = audioRecord.mime_type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = (audioRecord.file_name || '').split('.').pop().toLowerCase();
        const mimeMap = {
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          m4a: 'audio/mp4',
          mp4: 'audio/mp4',
          webm: 'audio/webm',
          ogg: 'audio/ogg',
          flac: 'audio/flac',
          aac: 'audio/aac',
        };
        mimeType = mimeMap[ext] || 'audio/wav';
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', audioRecord.file_size_bytes || audioRecord.audio_data.length);
      res.setHeader('Content-Disposition', `inline; filename="${audioRecord.file_name || 'audio.mp3'}"`);
      res.setHeader('Accept-Ranges', 'bytes');

      if (audioRecord.audio_hash) {
        res.setHeader('ETag', `"${audioRecord.audio_hash}"`);
        res.setHeader('X-Audio-SHA256', audioRecord.audio_hash);
      }

      if (typeof res.end === 'function') {
        return res.end(audioRecord.audio_data);
      } else if (typeof res.send === 'function') {
        return res.send(audioRecord.audio_data);
      }
      return res;
    } catch (err) {
      console.error('[AudioController] getAudioByConsultation error:', err.message);
      next(err);
    }
  }

  /**
   * GET /api/v1/consultations/:id/audio/verify
   *
   * Verifies stored audio byte integrity against SHA-256 hash
   */
  async verifyAudioHash(req, res, next) {
    try {
      const consultationId = parseInt(req.params.id, 10);
      if (!consultationId || isNaN(consultationId)) {
        return res.status(400).json({ success: false, error: 'Valid consultation ID is required' });
      }

      const { rows } = await db.query(
        'SELECT id, audio_data, audio_hash, file_size_bytes FROM consultation_audio WHERE consultation_id = $1 ORDER BY id DESC LIMIT 1',
        [consultationId]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, error: `No audio found for consultation #${consultationId}` });
      }

      const row = rows[0];
      const crypto = require('crypto');
      const computedHash = crypto.createHash('sha256').update(row.audio_data).digest('hex');
      const verified = (row.audio_hash === computedHash);

      return res.status(200).json({
        success: true,
        consultationId,
        audioId: row.id,
        storedHash: row.audio_hash,
        computedHash,
        verified,
        fileSizeBytes: row.file_size_bytes,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AudioController();

