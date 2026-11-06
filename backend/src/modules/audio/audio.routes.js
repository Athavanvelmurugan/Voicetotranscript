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
  // Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm
  const allowed = [
    'audio/webm',
    'audio/wav',
    'audio/wave',
    'audio/mp4',
    'audio/mpeg',
    'audio/mp3',
    'audio/m4a',
    'audio/ogg',
    'audio/x-m4a',
    'application/octet-stream', // some browsers send raw binary
  ];

  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|wav|mp3|mp4|m4a|ogg)$/i)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format: ${file.mimetype}. Use webm, wav, mp3, or mp4.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB — Whisper API hard limit
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

module.exports = router;

