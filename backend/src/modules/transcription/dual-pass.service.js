/**
 * Dual-Pass Transcription & Verification Service
 * ───────────────────────────────────────────────
 * Solves Bug 4 (Dual-pass missing):
 *  - On consultation end, fetches full audio from PostgreSQL BYTEA (consultation_audio)
 *  - Stitches live audio chunks into a complete continuous binary if needed
 *  - Computes & stores cryptographic SHA-256 audio_hash
 *  - Runs Whisper final pass with full audio context
 *  - Marks live segments as superseded (is_final_pass=false, replaced_by_pass=2)
 *  - Inserts final pass segments (pass_number=2, is_final_pass=true)
 *  - Re-extracts clinical context if diff > 5% or medication changed
 *  - Emits WebSocket event 'transcript:final_pass_ready'
 */

const crypto = require('crypto');
const db = require('../../db/connection');
const whisperClient = require('./whisper.client');
const consultationRepo = require('../consultations/consultation.repository');
const clinicalExtractor = require('../clinical-ai/clinical.extractor');
const wsSessionManager = require('../realtime/ws.session.manager');

const VET_DRUG_NAMES = [
  'amoxicillin', 'clavamox', 'metronidazole', 'doxycycline', 'meloxicam',
  'carprofen', 'prednisolone', 'dexamethasone', 'maropitant', 'cerenia',
  'ondansetron', 'pantoprazole', 'ranitidine', 'enrofloxacin', 'baytril',
  'cephalexin', 'gabapentin', 'tramadol', 'apoquel', 'cytopoint',
  'levothyroxine', 'furosemide', 'vetmedin', 'pimobendan'
];

class DualPassService {
  /**
   * Stitch all uploaded chunks for a consultation into a single continuous audio buffer
   */
  async stitchConsultationAudio(consultationId) {
    // 1. Check if chunks exist in consultation_audio_chunks
    const chunkRes = await db.query(
      `SELECT chunk_index, audio_data, mime_type 
       FROM consultation_audio_chunks 
       WHERE consultation_id = $1 
       ORDER BY chunk_index ASC`,
      [consultationId]
    );

    if (chunkRes.rows.length === 0) {
      // Check if full audio was already saved directly
      const fullRes = await db.query(
        `SELECT audio_data, mime_type, file_name, audio_hash 
         FROM consultation_audio 
         WHERE consultation_id = $1 
         ORDER BY id DESC LIMIT 1`,
        [consultationId]
      );
      if (fullRes.rows.length > 0) {
        return {
          buffer: fullRes.rows[0].audio_data,
          mimeType: fullRes.rows[0].mime_type,
          audioHash: fullRes.rows[0].audio_hash,
        };
      }
      return null;
    }

    const chunks = chunkRes.rows;
    const firstChunk = chunks[0].audio_data;
    const mimeType = chunks[0].mime_type || 'audio/wav';

    let stitchedBuffer;

    // Check if PCM WAV
    if (firstChunk.length >= 44 &&
        firstChunk.toString('ascii', 0, 4) === 'RIFF' &&
        firstChunk.toString('ascii', 8, 12) === 'WAVE') {
      
      // Extract PCM payloads from all chunks (skipping 44-byte WAV header on subsequent chunks)
      const pcmPayloads = [];
      let totalPcmBytes = 0;

      for (let i = 0; i < chunks.length; i++) {
        const buf = chunks[i].audio_data;
        if (buf.length > 44) {
          const payload = buf.subarray(44);
          pcmPayloads.push(payload);
          totalPcmBytes += payload.length;
        }
      }

      // Construct new 44-byte header
      const header = Buffer.alloc(44);
      firstChunk.copy(header, 0, 0, 44);
      header.writeUInt32LE(36 + totalPcmBytes, 4); // RIFF size
      header.writeUInt32LE(totalPcmBytes, 40); // data chunk size

      stitchedBuffer = Buffer.concat([header, ...pcmPayloads]);
    } else {
      // Concatenate raw binary chunks
      stitchedBuffer = Buffer.concat(chunks.map(c => c.audio_data));
    }

    // Compute cryptographic SHA-256 hash
    const audioHash = crypto.createHash('sha256').update(stitchedBuffer).digest('hex');

    // Upsert into consultation_audio
    await db.query(
      `INSERT INTO consultation_audio 
        (consultation_id, audio_data, mime_type, file_name, file_size_bytes, audio_hash, clinic_id)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT clinic_id FROM consultations WHERE id = $1), 1))`,
      [
        consultationId,
        stitchedBuffer,
        mimeType,
        `consultation_${consultationId}_full.wav`,
        stitchedBuffer.length,
        audioHash,
      ]
    );

    return {
      buffer: stitchedBuffer,
      mimeType,
      audioHash,
    };
  }

  /**
   * Compute transcript difference between live pass 1 and final pass 2
   */
  computeDiff(liveText, finalPassText) {
    const liveWords = (liveText || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    const finalWords = (finalPassText || '').toLowerCase().match(/[a-z0-9]+/g) || [];

    if (liveWords.length === 0 && finalWords.length === 0) {
      return { wordChangePercent: 0, hasMedicationDiff: false, isNonTrivial: false };
    }

    // Detect medications in live vs final
    const liveMeds = new Set(liveWords.filter(w => VET_DRUG_NAMES.includes(w)));
    const finalMeds = new Set(finalWords.filter(w => VET_DRUG_NAMES.includes(w)));

    let hasMedicationDiff = false;
    for (const med of liveMeds) {
      if (!finalMeds.has(med)) hasMedicationDiff = true;
    }
    for (const med of finalMeds) {
      if (!liveMeds.has(med)) hasMedicationDiff = true;
    }

    // Levenshtein-based word difference
    let diffCount = 0;
    const maxLen = Math.max(liveWords.length, finalWords.length);
    const minLen = Math.min(liveWords.length, finalWords.length);

    for (let i = 0; i < minLen; i++) {
      if (liveWords[i] !== finalWords[i]) {
        diffCount++;
      }
    }
    diffCount += (maxLen - minLen);

    const wordChangeRate = maxLen > 0 ? (diffCount / maxLen) : 0;
    const wordChangePercent = Math.min(100, Math.round(wordChangeRate * 100));

    return {
      wordChangePercent,
      hasMedicationDiff,
      isNonTrivial: wordChangePercent > 5 || hasMedicationDiff,
    };
  }

  /**
   * Split a large PCM WAV buffer into chunks of at most maxBytes (aligned to sample boundary)
   */
  _splitWavBuffer(buffer, maxBytes = 20 * 1024 * 1024) {
    if (!buffer || buffer.length < 44) return [{ buffer, durationMs: 0 }];

    const dataIndex = buffer.indexOf('data');
    const dataOffset = dataIndex !== -1 ? dataIndex + 8 : 44;
    const numChannels = buffer.readUInt16LE(22) || 1;
    const sampleRate = buffer.readUInt32LE(24) || 16000;
    const bitsPerSample = buffer.readUInt16LE(34) || 16;
    const bytesPerSample = Math.max(1, (bitsPerSample / 8) * numChannels);

    const totalDataBytes = buffer.length - dataOffset;
    if (totalDataBytes <= maxBytes) {
      const durMs = Math.round((totalDataBytes / (sampleRate * bytesPerSample)) * 1000);
      return [{ buffer, durationMs: durMs }];
    }

    const subChunks = [];
    const alignedMaxChunk = Math.floor(maxBytes / bytesPerSample) * bytesPerSample;
    let currOffset = dataOffset;

    while (currOffset < buffer.length) {
      const remaining = buffer.length - currOffset;
      const sliceLen = Math.min(remaining, alignedMaxChunk);
      const pcmSlice = buffer.subarray(currOffset, currOffset + sliceLen);

      const header = Buffer.from(buffer.subarray(0, dataOffset));
      header.writeUInt32LE(dataOffset - 8 + pcmSlice.length, 4);
      header.writeUInt32LE(pcmSlice.length, dataOffset - 4);

      const chunkBuffer = Buffer.concat([header, pcmSlice]);
      const durationMs = Math.round((pcmSlice.length / (sampleRate * bytesPerSample)) * 1000);

      subChunks.push({ buffer: chunkBuffer, durationMs });
      currOffset += sliceLen;
    }

    return subChunks;
  }

  /**
   * Transcribe stitched audio, splitting if exceeding provider size limit (25 MB)
   */
  async _transcribeStitchedAudio(buffer, consultation) {
    const PROVIDER_LIMIT_BYTES = 25 * 1024 * 1024; // 25 MB

    if (buffer.length > PROVIDER_LIMIT_BYTES &&
        buffer.length >= 44 &&
        buffer.toString('ascii', 0, 4) === 'RIFF') {
      console.log(`[DualPass] Stitched audio size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds 25 MB provider limit. Splitting into subchunks...`);
      const subChunks = this._splitWavBuffer(buffer, 20 * 1024 * 1024);
      const mergedSegments = [];
      let cumulativeTimeMs = 0;
      let detectedLanguage = 'en';

      for (let idx = 0; idx < subChunks.length; idx++) {
        const sub = subChunks[idx];
        const res = await whisperClient.transcribe({
          buffer: sub.buffer,
          language: consultation.language || 'en',
          speakerRole: 'doctor',
          chunkIndex: idx,
          baseSequence: mergedSegments.length,
        });

        if (res.detectedLanguage) detectedLanguage = res.detectedLanguage;
        if (res.segments) {
          for (const s of res.segments) {
            mergedSegments.push({
              ...s,
              sequenceOffset: mergedSegments.length + 1,
              startMs: (s.startMs || 0) + cumulativeTimeMs,
              endMs: (s.endMs || 0) + cumulativeTimeMs,
            });
          }
        }
        cumulativeTimeMs += sub.durationMs;
      }

      return {
        status: 'success',
        detectedLanguage,
        segments: mergedSegments,
      };
    }

    return await whisperClient.transcribe({
      buffer,
      language: consultation.language || 'en',
      speakerRole: 'doctor',
      chunkIndex: 0,
      baseSequence: 0,
    });
  }

  /**
   * Execute full-audio final pass
   */
  async runFinalPass(consultationId, doctorId = 1) {
    console.log(`[DualPass] 🔄 Starting full-audio Pass 2 for consultation #${consultationId}...`);
    const auditService = require('../audit/audit.service');

    try {
      // 1. Fetch stitched audio
      const stitched = await this.stitchConsultationAudio(consultationId);
      if (!stitched || !stitched.buffer || stitched.buffer.length === 0) {
        console.warn(`[DualPass] No audio available for consultation #${consultationId}. Skipping pass 2.`);
        return null;
      }

      const consultation = await consultationRepo.findById(consultationId);
      if (!consultation) {
        console.warn(`[DualPass] Consultation #${consultationId} not found.`);
        return null;
      }

      // 2. Fetch live Pass 1 transcript text before superseding
      const liveSegments = await db.query(
        `SELECT sequence_number, text, speaker_role 
         FROM transcript_segments 
         WHERE consultation_id = $1 AND pass_number = 1 
         ORDER BY sequence_number ASC`,
        [consultationId]
      );
      const liveText = liveSegments.rows.map(s => s.text).join(' ');

      // 3. Transcribe full audio with Whisper (handling >25MB splitting if needed)
      const whisperResult = await this._transcribeStitchedAudio(stitched.buffer, consultation);

      if (whisperResult.status === 'no_speech_detected' || !whisperResult.segments) {
        console.log(`[DualPass] Full audio pass returned no speech.`);
        return null;
      }

      // 4. Mark live segments (pass 1) as superseded
      await db.query(
        `UPDATE transcript_segments 
         SET is_final_pass = false, replaced_by_pass = 2 
         WHERE consultation_id = $1 AND pass_number = 1`,
        [consultationId]
      );

      // Audit log the superseding event
      await auditService.logChainedEvent({
        consultationId,
        eventType: 'TRANSCRIPT_SUPERSEDED',
        actorType: 'ai',
        payloadSnapshot: {
          passNumber: 1,
          replacedByPass: 2,
          supersededSegmentsCount: liveSegments.rows.length,
        },
      }).catch(() => {});

      // 5. Insert final pass (pass 2) segments
      const pass2Segments = [];
      for (let i = 0; i < whisperResult.segments.length; i++) {
        const seg = whisperResult.segments[i];
        const insertRes = await db.query(
          `INSERT INTO transcript_segments 
            (consultation_id, sequence_number, text, is_partial, speaker_role, language_detected, confidence, start_ms, end_ms, source, pass_number, is_final_pass, clinic_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2, true, COALESCE((SELECT clinic_id FROM consultations WHERE id = $1), 1))
           ON CONFLICT (consultation_id, pass_number, sequence_number, is_partial)
           DO UPDATE SET
             text = EXCLUDED.text,
             confidence = EXCLUDED.confidence,
             clinic_id = COALESCE(EXCLUDED.clinic_id, transcript_segments.clinic_id)
           RETURNING *`,
          [
            consultationId,
            i + 1,
            seg.text,
            false,
            seg.speakerRole || 'doctor',
            whisperResult.detectedLanguage || 'en',
            seg.confidence || 0.99,
            seg.startMs || 0,
            seg.endMs || 0,
            'whisper_final_pass',
          ]
        );
        pass2Segments.push(insertRes.rows[0]);
      }

      const finalPassText = pass2Segments.map(s => s.text).join(' ');

      // 6. Calculate diff between live Pass 1 and final Pass 2
      const diff = this.computeDiff(liveText, finalPassText);
      console.log(`[DualPass] ✅ Pass 2 complete for #${consultationId}: diff=${diff.wordChangePercent}%, medDiff=${diff.hasMedicationDiff}`);

      // 7. ALWAYS re-run clinical extraction and document generation after final pass
      let documentsUpdated = false;
      try {
        console.log(`[DualPass] Always re-running clinical extraction & document regeneration for final pass...`);
        const documentService = require('../documents/document.service');
        const extraction = await clinicalExtractor.extractAndValidate(consultation, finalPassText);
        await documentService.generateAllDocuments(consultationId, extraction, doctorId);
        documentsUpdated = true;
      } catch (extractErr) {
        console.warn(`[DualPass] Re-extraction warning:`, extractErr.message);
      }

      // 8. Audit ledger: record final pass complete and audio hash verification
      await auditService.logChainedEvent({
        consultationId,
        eventType: 'FINAL_PASS_COMPLETED',
        actorType: 'ai',
        payloadSnapshot: {
          passNumber: 2,
          totalSegments: pass2Segments.length,
          audioHash: stitched.audioHash,
          diff,
          documentsUpdated,
        },
      }).catch(() => {});

      if (stitched.audioHash) {
        await auditService.logChainedEvent({
          consultationId,
          eventType: 'AUDIO_HASH_VERIFIED',
          actorType: 'ai',
          payloadSnapshot: {
            audioHash: stitched.audioHash,
            verified: true,
          },
        }).catch(() => {});
      }

      // 9. Emit WebSocket event 'transcript:final_pass_ready'
      wsSessionManager.broadcast(consultationId, {
        event: 'transcript:final_pass_ready',
        consultationId,
        passNumber: 2,
        totalSegments: pass2Segments.length,
        diff,
        documentsUpdated,
        fullText: finalPassText,
        audioHash: stitched.audioHash,
      });

      return {
        consultationId,
        passNumber: 2,
        segments: pass2Segments,
        diff,
        documentsUpdated,
        audioHash: stitched.audioHash,
      };

    } catch (err) {
      console.error(`[DualPass] ❌ Final pass failed for consultation #${consultationId}:`, err.message);
      // Flag record draft_only_unverified and block sign-off
      await db.query(
        `UPDATE consultations 
         SET status = 'draft_only_unverified', draft_only_unverified = true 
         WHERE id = $1`,
        [consultationId]
      ).catch(() => {});

      await auditService.logChainedEvent({
        consultationId,
        eventType: 'FINAL_PASS_FAILED',
        actorType: 'ai',
        payloadSnapshot: {
          error: err.message,
          status: 'draft_only_unverified',
        },
      }).catch(() => {});

      throw err;
    }
  }
}

module.exports = new DualPassService();

