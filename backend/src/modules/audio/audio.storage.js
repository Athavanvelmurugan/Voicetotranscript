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

