/**
 * Audio Storage Service
 * ─────────────────────
 * Manages temporary audio chunk files on disk.
 * Files are written to OS temp dir, used for Whisper upload, then deleted.
 * No audio is stored permanently without an explicit retain policy.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class AudioStorage {
  constructor() {
    // Primary temp directory: OS temp dir
    this.tempDir = path.join(os.tmpdir(), 'vetscribe-audio');
    this.ensureTempDir();
  }

  ensureTempDir() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[AudioStorage] OS temp directory inaccessible, falling back to local workspace temp:', err.message);
      this.tempDir = path.join(process.cwd(), 'temp', 'vetscribe-audio');
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    }
    return this.tempDir;
  }

  /**
   * Build a deterministic temp file path for a given consultation + chunk
   */
  getTempPath(consultationId, chunkIndex, ext = 'webm') {
    return path.join(this.tempDir, `consult_${consultationId}_chunk_${chunkIndex}_${Date.now()}.${ext}`);
  }

  /**
   * Safely delete a temp file after transcription
   */
  cleanup(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('[AudioStorage] Could not delete temp file:', filePath, err.message);
    }
  }

  /**
   * Check file size in MB
   */
  fileSizeMB(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size / (1024 * 1024);
    } catch {
      return 0;
    }
  }

  /**
   * Sniff magic bytes on an audio buffer to detect format
   * Supports: WAV, MP3 (ID3 & frame sync), M4A/MP4, WebM/MKV, OGG, FLAC, AAC ADTS
   */
  sniffAudioFormat(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
      return null;
    }

    // 1. WAV: starts with "RIFF" and has "WAVE" at offset 8
    if (buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE') {
      return 'wav';
    }

    // 2. MP3 ID3 header ("ID3")
    if (buffer.toString('ascii', 0, 3) === 'ID3') {
      return 'mp3';
    }

    // 3. AAC ADTS: 0xFF followed by 0xF1, 0xF9
    if (buffer[0] === 0xFF && (buffer[1] === 0xF1 || buffer[1] === 0xF9)) {
      return 'aac';
    }

    // 4. MP3 MPEG frame sync: 0xFF and 0xFB, 0xF3, 0xF2
    if (buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xF3 || buffer[1] === 0xF2)) {
      return 'mp3';
    }

    // 5. M4A / MP4: 'ftyp' at offset 4
    if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      return 'm4a';
    }

    // 6. WebM / MKV: 0x1A 0x45 0xDF 0xA3
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
      return 'webm';
    }

    // 7. OGG: "OggS"
    if (buffer.toString('ascii', 0, 4) === 'OggS') {
      return 'ogg';
    }

    // 8. FLAC: "fLaC"
    if (buffer.toString('ascii', 0, 4) === 'fLaC') {
      return 'flac';
    }

    return null;
  }

  /**
   * Validates an in-memory audio buffer:
   *  - Rejects 0-byte or non-buffer inputs
   *  - Enforces magic-byte format detection
   *  - Validates WAV headers and rejects clips shorter than 0.5s
   *  - Throws typed 400 error if validation fails
   */
  validateAudioBuffer(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      const err = new Error('Audio file is empty (0 bytes).');
      err.statusCode = 400;
      err.error = 'invalid_audio';
      err.reason = 'empty_file';
      throw err;
    }

    const format = this.sniffAudioFormat(buffer);
    if (!format) {
      const err = new Error('Invalid audio format: file header does not match any supported audio signature.');
      err.statusCode = 400;
      err.error = 'invalid_audio';
      err.reason = 'unrecognized_magic_bytes';
      throw err;
    }

    let duration = null;

    if (format === 'wav') {
      if (buffer.length < 44) {
        const err = new Error('Invalid audio format: truncated WAV header.');
        err.statusCode = 400;
        err.error = 'invalid_audio';
        err.reason = 'truncated_wav_header';
        throw err;
      }

      // Check for byteRate and data chunk
      let byteRate = 0;
      let dataSize = 0;

      // Check fmt subchunk
      const fmtIndex = buffer.indexOf('fmt ');
      if (fmtIndex !== -1 && fmtIndex + 16 <= buffer.length) {
        byteRate = buffer.readUInt32LE(fmtIndex + 16);
      }

      // Check data subchunk
      const dataIndex = buffer.indexOf('data');
      if (dataIndex !== -1 && dataIndex + 8 <= buffer.length) {
        dataSize = buffer.readUInt32LE(dataIndex + 4);
      } else {
        dataSize = buffer.length - 44;
      }

      if (byteRate > 0 && dataSize > 0) {
        duration = dataSize / byteRate;
        if (duration < 0.5) {
          const err = new Error(`Audio too short (${duration.toFixed(2)}s). Minimum duration is 0.5s.`);
          err.statusCode = 400;
          err.error = 'invalid_audio';
          err.reason = 'audio_too_short';
          err.duration = duration;
          throw err;
        }
      }
    } else {
      // General length guard for compressed formats: an audio clip of >= 0.5s must be at least 100 bytes
      if (buffer.length < 100) {
        const err = new Error('Invalid audio format: file too small to contain valid audio.');
        err.statusCode = 400;
        err.error = 'invalid_audio';
        err.reason = 'truncated_audio';
        throw err;
      }
    }

    return { valid: true, format, duration, size: buffer.length };
  }

  /**
   * Validates an on-disk audio file path
   */
  validateAudioFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      const err = new Error('Audio file does not exist on disk.');
      err.statusCode = 400;
      err.error = 'invalid_audio';
      err.reason = 'file_not_found';
      throw err;
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      const err = new Error('Audio file is empty (0 bytes).');
      err.statusCode = 400;
      err.error = 'invalid_audio';
      err.reason = 'empty_file';
      throw err;
    }

    const buf = fs.readFileSync(filePath);
    return this.validateAudioBuffer(buf);
  }

  /**
   * Whisper API has a 25MB per-file limit.
   * Reject anything larger before sending.
   */
  validateSize(filePath) {
    const size = this.fileSizeMB(filePath);
    if (size > 24.5) {
      throw new Error(`Audio chunk is too large (${size.toFixed(1)} MB). Maximum allowed is 25 MB. Record shorter segments.`);
    }
  }
}

module.exports = new AudioStorage();

