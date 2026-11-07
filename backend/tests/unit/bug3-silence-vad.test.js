const test = require('node:test');
const assert = require('node:assert/strict');
const whisperClient = require('../../src/modules/transcription/whisper.client');
const vadService = require('../../src/modules/transcription/vad.service');

// Helper to create a 16kHz 16-bit mono WAV buffer with given duration and signal
function createWavBuffer(durationSeconds = 1.0, signalType = 'silence', sampleRate = 16000) {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(numChannels * 2, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  if (signalType === 'silence') {
    // Fill with digital zeroes
    buffer.fill(0, 44);
  } else if (signalType === 'speech_tone') {
    // Generate 440Hz sine wave at moderate speech amplitude (~0.15 = 4915 in 16-bit signed)
    const freq = 440;
    const amplitude = 5000;
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.round(amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate));
      buffer.writeInt16LE(sample, 44 + i * 2);
    }
  } else if (signalType === 'speech_then_silence') {
    // First 5s tone, next 25s silence
    const speechSamples = Math.min(numSamples, 5 * sampleRate);
    const freq = 440;
    const amplitude = 5000;
    for (let i = 0; i < speechSamples; i++) {
      const sample = Math.round(amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate));
      buffer.writeInt16LE(sample, 44 + i * 2);
    }
    // Remaining are zeroes
    buffer.fill(0, 44 + speechSamples * 2);
  }

  return buffer;
}

test('BUG 3 Regression Test: Silence Hallucination & VAD Gating', async (t) => {
  await t.test('1. Pre-ASR VAD gate must reject 60s pure silence and NOT call Whisper API', async () => {
    const silenceWav = createWavBuffer(60.0, 'silence');
    
    // Check VAD service directly
    const vadResult = vadService.processAudioBuffer(silenceWav);
    assert.strictEqual(vadResult.hasSpeech, false, 'VAD must detect NO speech in 60s pure silence');
    assert.strictEqual(vadResult.speechRegions.length, 0, 'No speech regions should be found');

    // Call whisperClient.transcribe — must NOT call API, must return status: "no_speech_detected"
    let apiCalled = false;
    const originalTranscribeLive = whisperClient._transcribeLive;
    whisperClient._transcribeLive = async () => {
      apiCalled = true;
      throw new Error('API should not have been called for pure silence!');
    };

    try {
      const result = await whisperClient.transcribe({ buffer: silenceWav, fileName: 'silence.wav' });
      assert.strictEqual(apiCalled, false, 'Whisper API must NOT be called for silent audio');
      assert.strictEqual(result.status, 'no_speech_detected', 'Status must be no_speech_detected');
      assert.strictEqual(result.fullText, '', 'fullText must be empty');
      assert.strictEqual(result.segments.length, 0, 'segments count must be 0');
    } finally {
      whisperClient._transcribeLive = originalTranscribeLive;
    }
  });

  await t.test('2. Pre-ASR VAD gate trims 25s silence trailer after 5s speech tone', () => {
    const mixedWav = createWavBuffer(30.0, 'speech_then_silence'); // 5s tone + 25s silence
    const vadResult = vadService.processAudioBuffer(mixedWav);
    assert.strictEqual(vadResult.hasSpeech, true, 'Speech must be detected in the first 5 seconds');
    assert.ok(vadResult.trimmedBuffer, 'Trimmed buffer must be returned');
    
    // Trimmed buffer duration should be ~5s + 300ms padding (~5.3s), NOT 30s!
    const trimmedDuration = (vadResult.trimmedBuffer.length - 44) / (16000 * 2);
    assert.ok(trimmedDuration < 8.0, `Trimmed duration (${trimmedDuration.toFixed(2)}s) must be < 8s, silence trailer removed`);
    assert.ok(trimmedDuration >= 4.5, `Trimmed duration (${trimmedDuration.toFixed(2)}s) must retain speech`);
  });

  await t.test('3. Post-ASR filter drops phantom hallucination phrases', () => {
    const mockWhisperResponse = {
      text: 'Thank you for watching. Please subscribe to our channel.',
      language: 'en',
      segments: [
        {
          id: 0,
          text: 'Thank you for watching.',
          start: 0.0,
          end: 2.5,
          no_speech_prob: 0.75,
          avg_logprob: -1.2,
        },
        {
          id: 1,
          text: 'Please subscribe to our channel.',
          start: 2.5,
          end: 5.0,
          no_speech_prob: 0.8,
          avg_logprob: -1.5,
        },
      ],
    };

    const parsed = whisperClient._parseWhisperResponse(mockWhisperResponse, 'doctor', 0, 0);
    assert.strictEqual(parsed.segments.length, 0, 'All phantom hallucination segments must be dropped');
    assert.strictEqual(parsed.fullText, '', 'fullText must be empty after dropping phantoms');
    assert.strictEqual(parsed.status, 'no_speech_detected', 'Status must be no_speech_detected when all segments are dropped');
  });

  await t.test('4. Post-ASR filter drops high no_speech_prob (> 0.6) and low logprob (< -1.0) segments', () => {
    const mockWhisperResponse = {
      text: 'Patient examination normal. [whisper noise]',
      language: 'en',
      segments: [
        {
          id: 0,
          text: 'Patient examination normal.',
          start: 0.0,
          end: 2.0,
          no_speech_prob: 0.05,
          avg_logprob: -0.2,
        },
        {
          id: 1,
          text: '[whisper noise]',
          start: 2.0,
          end: 4.0,
          no_speech_prob: 0.85,
          avg_logprob: -1.6,
        },
      ],
    };

    const parsed = whisperClient._parseWhisperResponse(mockWhisperResponse, 'doctor', 0, 0);
    assert.strictEqual(parsed.segments.length, 1, 'Only genuine speech segment must be retained');
    assert.strictEqual(parsed.segments[0].text, 'Patient examination normal.');
    assert.ok(!parsed.fullText.includes('[whisper noise]'), 'Noise segment must be dropped');
  });
});

