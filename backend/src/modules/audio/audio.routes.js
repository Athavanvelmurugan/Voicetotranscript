const express = require('express');
const multer = require('multer');
const os = require('os');
const path = require('path');
const router = express.Router();
const audioController = require('./audio.controller');
const audioStorage = require('./audio.storage');

/**
 * Multer disk storage configuration
 *  - destination: OS temp dir (no permanent storage)
 *  - filename: descriptive name with consultation ID and timestamp
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const dir = audioStorage.ensureTempDir();
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const consultationId = req.params.id || 'unknown';
    const chunkIndex = req.body?.chunkIndex || '0';
    const ext = file.mimetype.includes('webm') ? 'webm'
      : file.mimetype.includes('wav') ? 'wav'
      : file.mimetype.includes('mp4') ? 'mp4'
      : file.mimetype.includes('mpeg') ? 'mp3'
      : 'webm';

    const fileName = `consult_${consultationId}_chunk_${chunkIndex}_${Date.now()}.${ext}`;
    cb(null, fileName);
  },
});

const fileFilter = (_req, file, cb) => {
  // Support comprehensive audio formats: MP3, WAV, M4A, WEBM, OGG, FLAC, AAC, MP4
  const allowedMimes = [
    'audio/webm',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp4',
    'audio/mpeg',
    'audio/mp3',
    'audio/m4a',
    'audio/x-m4a',
    'audio/ogg',
    'audio/flac',
    'audio/x-flac',
    'audio/aac',
    'audio/x-aac',
    'video/mp4',
    'video/webm',
  ];

  const hasAudioExtension = Boolean(file.originalname && file.originalname.match(/\.(webm|wav|mp3|mp4|m4a|ogg|flac|aac|mpeg|mpga)$/i));

  // Reject generic octet-stream unless file extension indicates audio; magic-bytes will be sniffed on the buffer
  if (allowedMimes.includes(file.mimetype) || (file.mimetype === 'application/octet-stream' && hasAudioExtension) || hasAudioExtension) {
    cb(null, true);
  } else {
    const err = new Error(`Unsupported audio format: ${file.mimetype}. Supported formats: mp3, wav, m4a, webm, ogg, flac, aac.`);
    err.statusCode = 400;
    err.error = 'invalid_audio';
    cb(err);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB — Whisper API hard limit
  },
});

// In-Memory storage: Zero disk writes, stored directly into PostgreSQL as BYTEA
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

/**
 * POST /api/v1/consultations/:id/audio-chunk
 *
 * Accepts:
 *  - audio: (file)       — recorded audio blob (webm/wav)
 *  - speakerRole: (body) — 'doctor' | 'owner' | 'unknown'
 *  - chunkIndex: (body)  — sequential integer chunk counter
 *  - language: (body)    — 'en' | 'ta' | 'en-ta'
 *
 * Returns:
 *  - Array of transcript segments saved to DB and broadcast via WebSocket
 */
router.post(
  '/:id/audio-chunk',
  upload.single('audio'),
  (req, res, next) => audioController.uploadChunk(req, res, next)
);

/**
 * POST /api/v1/consultations/upload-and-scribe
 * POST /api/v1/consultations/:id/upload-and-scribe
 *
 * Unified single-turn endpoint (In-Memory / Zero Disk):
 *  - Ingests multipart audio directly into RAM
 *  - Transcribes audio via Whisper Large V3
 *  - Saves binary into PostgreSQL (consultation_audio BYTEA)
 *  - Extracts structured clinical entities (diagnoses, meds, labs)
 *  - Synthesizes Summary, Prescription, Lab Tests, SOAP Notes, Follow-up
 */
router.post(
  '/upload-and-scribe',
  memoryUpload.single('audio'),
  (req, res, next) => audioController.uploadAndScribe(req, res, next)
);

router.post(
  '/:id/upload-and-scribe',
  memoryUpload.single('audio'),
  (req, res, next) => audioController.uploadAndScribe(req, res, next)
);

/**
 * GET /api/v1/consultations/:id/audio
 *
 * Streams raw audio binary directly from PostgreSQL BYTEA column
 */
router.get(
  '/:id/audio',
  (req, res, next) => audioController.getAudioByConsultation(req, res, next)
);

/**
 * GET /api/v1/consultations/:id/audio/verify
 *
 * Verifies byte integrity of stored audio against SHA-256 hash
 */
router.get(
  '/:id/audio/verify',
  (req, res, next) => audioController.verifyAudioHash(req, res, next)
);

module.exports = router;

