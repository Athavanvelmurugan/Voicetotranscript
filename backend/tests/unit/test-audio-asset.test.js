const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Generated Test Audio Asset Verification', () => {
  const audioFilePath = path.resolve(__dirname, '../../../frontend/test-assets/test audio.wav');

  it('should verify test audio.wav exists and is non-empty', () => {
    assert.strictEqual(fs.existsSync(audioFilePath), true, 'File test audio.wav must exist');
    const stat = fs.statSync(audioFilePath);
    assert.ok(stat.size > 1024 * 1024, `File size (${stat.size} bytes) should be > 1MB`);
  });

  it('should verify RIFF WAVE headers and audio specs (16-bit, 22.05kHz, Mono)', () => {
    const fd = fs.openSync(audioFilePath, 'r');
    const headerBuf = Buffer.alloc(44);
    fs.readSync(fd, headerBuf, 0, 44, 0);
    fs.closeSync(fd);

    const riff = headerBuf.toString('ascii', 0, 4);
    const wave = headerBuf.toString('ascii', 8, 12);
    const channels = headerBuf.readUInt16LE(22);
    const sampleRate = headerBuf.readUInt32LE(24);
    const byteRate = headerBuf.readUInt32LE(28);
    const bitsPerSample = headerBuf.readUInt16LE(34);

    assert.strictEqual(riff, 'RIFF');
    assert.strictEqual(wave, 'WAVE');
    assert.strictEqual(channels, 1, 'Audio should be Mono');
    assert.strictEqual(sampleRate, 22050, 'Audio sample rate should be 22050 Hz');
    assert.strictEqual(bitsPerSample, 16, 'Audio bit depth should be 16-bit PCM');

    const stat = fs.statSync(audioFilePath);
    const durationSeconds = (stat.size - 44) / byteRate;
    assert.ok(durationSeconds >= 180 && durationSeconds <= 240, `Duration (${durationSeconds}s) should be ~3 minutes`);
  });
});

