const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const whisperClient = require('../../src/modules/transcription/whisper.client');

describe('Whisper Client Unit Tests', () => {
  it('should safely transcribe when given a file path', async () => {
    const result = await whisperClient.transcribe({
      filePath: 'dummy.webm',
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
      filePath: 'dummy.webm',
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
      filePath: 'dummy.webm',
      language: 'ta',
      speakerRole: 'doctor',
      chunkIndex: 0,
      baseSequence: 0,
    });

    assert.equal(tamilResult.detectedLanguage, 'ta');
    assert.ok(tamilResult.segments.length > 0);
  });
});
