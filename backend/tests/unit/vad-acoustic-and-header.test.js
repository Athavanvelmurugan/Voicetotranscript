const test = require('node:test');
const assert = require('node:assert/strict');
const vadService = require('../../src/modules/transcription/vad.service');

// Helper to construct WAV buffers with custom fmt chunk size and signal
function createWav({ durationSec, sampleRate = 16000, fmtChunkSize = 16, signalGenerator }) {
  const numChannels = 1;
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  
  // fmt chunk header: 8 bytes ('fmt ' + size) + fmtChunkSize
  // data chunk header: 8 bytes ('data' + size)
  const headerSize = 12 + (8 + fmtChunkSize) + 8;
  const buffer = Buffer.alloc(headerSize + dataSize);

  let offset = 0;
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(headerSize - 8 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(fmtChunkSize, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * 2, offset); offset += 4;
  buffer.writeUInt16LE(numChannels * 2, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2;

  // Extra bytes if fmtChunkSize > 16 (e.g. 18-byte cbSize = 0)
  if (fmtChunkSize > 16) {
    buffer.fill(0, offset, offset + (fmtChunkSize - 16));
    offset += (fmtChunkSize - 16);
  }

  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  const dataStart = offset;
  for (let i = 0; i < numSamples; i++) {
    const val = signalGenerator(i, sampleRate);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(val))), dataStart + i * 2);
  }

  return buffer;
}

test('Part B.3 VAD Acoustic Verification & Header Integrity', async (t) => {
  await t.test('1. Quiet speech at -35 dBFS is NOT dropped by VAD gate', () => {
    // -35 dBFS amplitude = 32767 * 10^(-35/20) ≈ 583
    const amp35dBFS = Math.round(32767 * Math.pow(10, -35 / 20));
    const wav = createWav({
      durationSec: 3.0,
      fmtChunkSize: 16,
      signalGenerator: (i, sr) => amp35dBFS * Math.sin((2 * Math.PI * 300 * i) / sr),
    });

    const result = vadService.processAudioBuffer(wav);
    assert.strictEqual(result.hasSpeech, true, 'Quiet speech at -35 dBFS must NOT be dropped');
    assert.ok(result.speechRegions.length > 0, 'Must detect at least one speech region');
  });

  await t.test('2. Synthetic fan noise (-46 dBFS stationary hum) returns no_speech_detected', () => {
    // -46 dBFS amplitude = 32767 * 10^(-46/20) ≈ 164. RMS is ~0.0035 (< 0.008 threshold)
    const fanAmp = Math.round(32767 * Math.pow(10, -46 / 20));
    const wav = createWav({
      durationSec: 5.0,
      fmtChunkSize: 16,
      signalGenerator: (i, sr) => {
        // Low frequency motor hum 120Hz + harmonic 240Hz + slight white noise
        const hum = Math.sin((2 * Math.PI * 120 * i) / sr) + 0.5 * Math.sin((2 * Math.PI * 240 * i) / sr);
        const noise = (Math.random() * 2 - 1) * 0.2;
        return (fanAmp / 1.5) * (hum + noise);
      },
    });

    const result = vadService.processAudioBuffer(wav);
    assert.strictEqual(result.hasSpeech, false, 'Synthetic fan noise must return hasSpeech: false');
    assert.strictEqual(result.speechRegions.length, 0, 'Must have zero speech regions');
  });

  await t.test('3. Speech + 30s gap + speech has no text/sound in the gap and drops 30s silence', () => {
    // 2s speech (440Hz, -20dBFS) + 30s silence + 2s speech (440Hz, -20dBFS)
    const amp20dBFS = Math.round(32767 * Math.pow(10, -20 / 20));
    const wav = createWav({
      durationSec: 34.0,
      fmtChunkSize: 16,
      signalGenerator: (i, sr) => {
        const timeSec = i / sr;
        if (timeSec < 2.0 || timeSec >= 32.0) {
          return amp20dBFS * Math.sin((2 * Math.PI * 440 * i) / sr);
        }
        return 0; // 30s silence gap
      },
    });

    const result = vadService.processAudioBuffer(wav);
    assert.strictEqual(result.hasSpeech, true, 'Speech segments must be detected');
    assert.strictEqual(result.speechRegions.length, 2, 'Must detect exactly 2 distinct speech regions');
    
    // Check dropped regions include the 30s gap
    const gapDropped = result.droppedRegions.find(r => (r.endMs - r.startMs) >= 28000);
    assert.ok(gapDropped, 'A silence gap of ~30,000ms must be dropped from audio');
    
    // Trimmed buffer duration must exclude the 30s gap (should be ~4s + padding, < 6s)
    const trimmedDuration = (result.trimmedBuffer.length - 44) / (16000 * 2);
    assert.ok(trimmedDuration < 6.0, `Trimmed buffer (${trimmedDuration.toFixed(1)}s) must exclude 30s gap`);
  });

  await t.test('4. Non-standard WAV header (18-byte fmt chunk, dataOffset = 46) must not corrupt data header', () => {
    const amp20dBFS = Math.round(32767 * Math.pow(10, -20 / 20));
    const wav18 = createWav({
      durationSec: 2.0,
      fmtChunkSize: 18, // Extended fmt chunk
      signalGenerator: (i, sr) => amp20dBFS * Math.sin((2 * Math.PI * 440 * i) / sr),
    });

    // Check header before trimming
    const parsedBefore = vadService._parseWavHeader(wav18);
    assert.strictEqual(parsedBefore.dataOffset, 46, 'Initial data offset should be 46 for 18-byte fmt');

    const result = vadService.processAudioBuffer(wav18);
    assert.strictEqual(result.hasSpeech, true);
    assert.ok(result.trimmedBuffer, 'Trimmed buffer must be produced');

    // Parse the produced trimmed buffer
    const parsedTrimmed = vadService._parseWavHeader(result.trimmedBuffer);
    assert.ok(parsedTrimmed, 'Trimmed buffer must still be valid WAV');
    assert.strictEqual(parsedTrimmed.dataOffset, 46, 'Trimmed buffer dataOffset must remain 46');

    // Check that 'data' chunk marker was not corrupted
    const dataIdx = result.trimmedBuffer.indexOf('data');
    assert.strictEqual(dataIdx, 38, 'ASCII "data" chunk must remain intact at byte 38');
  });
});

