const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const whisperClient = require('../../src/modules/transcription/whisper.client');

function createVoiceWavBuffer(durationSec = 1.0, sampleRate = 16000) {
  const dataSize = Math.floor(durationSec * sampleRate * 2);
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < dataSize / 2; i++) {
    buf.writeInt16LE(Math.round(5000 * Math.sin(i / 8)), 44 + i * 2);
  }
  return buf;
}

describe('Whisper Client Unit Tests', () => {
  let tempWavPath;
  let origClient;

  before(() => {
    tempWavPath = path.join(os.tmpdir(), `whisper_unit_${Date.now()}.wav`);
    fs.writeFileSync(tempWavPath, createVoiceWavBuffer(1.0));
    origClient = whisperClient.client;
    whisperClient.client = {
      audio: {
        transcriptions: {
          create: async ({ language }) => ({
            text: language === 'ta' ? 'நாய் கடந்த மூன்று நாட்களாக சோர்வாக உள்ளது.' : 'The dog has been lethargic and vomiting for three days.',
            language: language || 'en',
            segments: [
              {
                id: 0,
                text: language === 'ta' ? 'நாய் கடந்த மூன்று நாட்களாக சோர்வாக உள்ளது.' : 'The dog has been lethargic and vomiting for three days.',
                start: 0.0,
                end: 2.5,
                avg_logprob: -0.25,
                no_speech_prob: 0.02,
              },
            ],
          }),
        },
      },
    };
  });

  after(() => {
    whisperClient.client = origClient;
    if (tempWavPath && fs.existsSync(tempWavPath)) {
      fs.unlinkSync(tempWavPath);
    }
  });

  it('should safely transcribe when given a file path', async () => {
    const result = await whisperClient.transcribe({
      filePath: tempWavPath,
      language: 'en',
      speakerRole: 'doctor',
      chunkIndex: 0,
      baseSequence: 0,
    });

    assert.ok(result);
    assert.equal(result.detectedLanguage, 'en');
    assert.ok(result.segments.length > 0);
    assert.equal(result.segments[0].speakerRole, 'doctor');
    assert.equal(result.segments[0].sequenceOffset, 1);
    assert.ok(result.segments[0].text.length > 10);
  });

  it('should preserve speaker role and increment sequence offset correctly', async () => {
    const ownerResult = await whisperClient.transcribe({
      filePath: tempWavPath,
      language: 'en',
      speakerRole: 'owner',
      chunkIndex: 1,
      baseSequence: 5,
    });

    assert.equal(ownerResult.segments[0].speakerRole, 'owner');
    assert.equal(ownerResult.segments[0].sequenceOffset, 6);
  });

  it('should handle Tamil language request', async () => {
    const tamilResult = await whisperClient.transcribe({
      filePath: tempWavPath,
      language: 'ta',
      speakerRole: 'doctor',
      chunkIndex: 0,
      baseSequence: 0,
    });

    assert.equal(tamilResult.detectedLanguage, 'ta');
    assert.ok(tamilResult.segments.length > 0);
  });
});
