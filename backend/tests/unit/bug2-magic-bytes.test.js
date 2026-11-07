const test = require('node:test');
const assert = require('node:assert/strict');
const audioStorage = require('../../src/modules/audio/audio.storage');
const audioController = require('../../src/modules/audio/audio.controller');
const db = require('../../src/db/connection');

// Helper to create a valid minimal WAV buffer of a given duration in seconds
function createWavBuffer(durationSeconds = 1.0, sampleRate = 16000, numChannels = 1) {
  const byteRate = sampleRate * numChannels * 2;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  // file length minus 8
  buffer.writeUInt32LE(36 + dataSize, 4);
  // WAVE identifier
  buffer.write('WAVE', 8);
  // fmt chunk identifier
  buffer.write('fmt ', 12);
  // chunk length (16 for PCM)
  buffer.writeUInt32LE(16, 16);
  // sample format (1 = PCM)
  buffer.writeUInt16LE(1, 20);
  // channel count
  buffer.writeUInt16LE(numChannels, 22);
  // sample rate
  buffer.writeUInt32LE(sampleRate, 24);
  // byte rate
  buffer.writeUInt32LE(byteRate, 28);
  // block align
  buffer.writeUInt16LE(numChannels * 2, 32);
  // bits per sample
  buffer.writeUInt16LE(16, 34);
  // data chunk identifier
  buffer.write('data', 36);
  // data chunk length
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

test('BUG 2 Regression Test: Magic-Byte Sniffing & Input Audio Validation', async (t) => {
  t.after(async () => {
    await db.pool.end();
  });

  await t.test('1. audioStorage.validateAudioBuffer must reject 0-byte buffer', () => {
    const emptyBuf = Buffer.alloc(0);
    assert.throws(
      () => audioStorage.validateAudioBuffer(emptyBuf),
      (err) => {
        return err.statusCode === 400 && err.error === 'invalid_audio';
      },
      '0-byte buffer must throw 400 invalid_audio'
    );
  });

  await t.test('2. audioStorage.validateAudioBuffer must reject renamed .txt file', () => {
    const textBuf = Buffer.from('This is a plain text file pretending to be audio.mp3');
    assert.throws(
      () => audioStorage.validateAudioBuffer(textBuf),
      (err) => {
        return err.statusCode === 400 && err.error === 'invalid_audio';
      },
      'Renamed .txt file must throw 400 invalid_audio'
    );
  });

  await t.test('3. audioStorage.validateAudioBuffer must reject truncated WAV header', () => {
    const truncWav = Buffer.from('RIFF1234'); // Missing WAVE and fmt/data
    assert.throws(
      () => audioStorage.validateAudioBuffer(truncWav),
      (err) => {
        return err.statusCode === 400 && err.error === 'invalid_audio';
      },
      'Truncated WAV must throw 400 invalid_audio'
    );
  });

  await t.test('4. audioStorage.validateAudioBuffer must reject audio shorter than 0.5s', () => {
    const shortWav = createWavBuffer(0.2); // 200ms
    assert.throws(
      () => audioStorage.validateAudioBuffer(shortWav),
      (err) => {
        return err.statusCode === 400 && err.error === 'invalid_audio';
      },
      'Audio shorter than 0.5s must throw 400 invalid_audio'
    );
  });

  await t.test('5. audioStorage.validateAudioBuffer must accept valid formats', () => {
    // 5a: Valid WAV (1.0s)
    const validWav = createWavBuffer(1.0);
    const wavResult = audioStorage.validateAudioBuffer(validWav);
    assert.strictEqual(wavResult.format, 'wav');

    // 5b: Valid MP3 (ID3v2 header: ID3 + 3 bytes version/flags + 4 bytes syncsafe size)
    const validMp3Id3 = Buffer.concat([
      Buffer.from('ID3'),
      Buffer.from([0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A]),
      Buffer.alloc(200, 0xFF),
    ]);
    const mp3Result = audioStorage.validateAudioBuffer(validMp3Id3);
    assert.strictEqual(mp3Result.format, 'mp3');

    // 5c: Valid MP3 (MPEG frame sync: 0xFF 0xFB)
    const validMp3Sync = Buffer.concat([
      Buffer.from([0xFF, 0xFB, 0x90, 0x64]),
      Buffer.alloc(200, 0x00),
    ]);
    const mp3SyncResult = audioStorage.validateAudioBuffer(validMp3Sync);
    assert.strictEqual(mp3SyncResult.format, 'mp3');

    // 5d: Valid M4A/MP4 ('ftyp' at offset 4)
    const validM4a = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypM4A '),
      Buffer.alloc(200, 0x00),
    ]);
    const m4aResult = audioStorage.validateAudioBuffer(validM4a);
    assert.strictEqual(m4aResult.format, 'm4a');

    // 5e: Valid WebM (1A 45 DF A3)
    const validWebm = Buffer.concat([
      Buffer.from([0x1A, 0x45, 0xDF, 0xA3]),
      Buffer.alloc(200, 0x00),
    ]);
    const webmResult = audioStorage.validateAudioBuffer(validWebm);
    assert.strictEqual(webmResult.format, 'webm');

    // 5f: Valid OGG (OggS)
    const validOgg = Buffer.concat([
      Buffer.from('OggS'),
      Buffer.alloc(200, 0x00),
    ]);
    const oggResult = audioStorage.validateAudioBuffer(validOgg);
    assert.strictEqual(oggResult.format, 'ogg');

    // 5g: Valid FLAC (fLaC)
    const validFlac = Buffer.concat([
      Buffer.from('fLaC'),
      Buffer.alloc(200, 0x00),
    ]);
    const flacResult = audioStorage.validateAudioBuffer(validFlac);
    assert.strictEqual(flacResult.format, 'flac');

    // 5h: Valid AAC ADTS (0xFF 0xF1)
    const validAac = Buffer.concat([
      Buffer.from([0xFF, 0xF1, 0x50, 0x80]),
      Buffer.alloc(200, 0x00),
    ]);
    const aacResult = audioStorage.validateAudioBuffer(validAac);
    assert.strictEqual(aacResult.format, 'aac');
  });

  await t.test('6. uploadAndScribe rejects invalid audio with 400 and creates NO database row', async () => {
    // Count audio rows before
    const countBefore = await db.query('SELECT COUNT(*) as count FROM consultation_audio');
    const audioCountBefore = parseInt(countBefore.rows[0].count, 10);

    // Mock Express req and res for fake txt file
    const req = {
      file: {
        buffer: Buffer.from('Renamed text file contents not audio'),
        originalname: 'fake_audio.mp3',
        mimetype: 'audio/mpeg',
      },
      params: { id: 1 },
      body: {},
      headers: {},
    };

    let responseStatus = null;
    let responseBody = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await audioController.uploadAndScribe(req, res, () => {});

    assert.strictEqual(responseStatus, 400, 'Should return HTTP 400 on invalid audio');
    assert.strictEqual(responseBody?.error, 'invalid_audio', 'Should return error: "invalid_audio"');

    // Count audio rows after — MUST BE IDENTICAL (NO row created)
    const countAfter = await db.query('SELECT COUNT(*) as count FROM consultation_audio');
    const audioCountAfter = parseInt(countAfter.rows[0].count, 10);
    assert.strictEqual(audioCountAfter, audioCountBefore, 'No row must be inserted into consultation_audio');
  });
});
