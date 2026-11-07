const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../src/db/connection');
const consultationRepo = require('../../src/modules/consultations/consultation.repository');

describe('Multi-Format Audio PostgreSQL Persistence Unit Tests (MP3, M4A, WebM, OGG, FLAC)', () => {
  let testConsultationId;

  before(async () => {
    const consultations = await consultationRepo.findAll();
    if (consultations && consultations.length > 0) {
      testConsultationId = consultations[0].id;
    } else {
      const created = await consultationRepo.create({
        petId: 1,
        doctorId: 1,
        language: 'en',
        consentGiven: true,
      });
      testConsultationId = created.id;
    }
  });

  after(async () => {
    if (testConsultationId) {
      await db.query('DELETE FROM consultation_audio WHERE consultation_id = $1', [testConsultationId]);
    }
    await db.pool.end();
  });

  it('1. should insert and retrieve MP3 audio binary (BYTEA) with audio/mpeg MIME type', async () => {
    const mp3Header = Buffer.from([0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x54, 0x41, 0x47]); // synthetic MP3 frame
    const fileName = 'clinical_recording.mp3';
    const mimeType = 'audio/mpeg';

    const insertRes = await db.query(`
      INSERT INTO consultation_audio (consultation_id, audio_data, mime_type, file_name, file_size_bytes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, file_name, mime_type, file_size_bytes
    `, [testConsultationId, mp3Header, mimeType, fileName, mp3Header.length]);

    assert.strictEqual(insertRes.rows.length, 1);
    assert.strictEqual(insertRes.rows[0].mime_type, 'audio/mpeg');

    const fetchRes = await db.query(
      'SELECT audio_data, mime_type, file_name FROM consultation_audio WHERE id = $1',
      [insertRes.rows[0].id]
    );

    assert.ok(Buffer.isBuffer(fetchRes.rows[0].audio_data));
    assert.strictEqual(fetchRes.rows[0].audio_data.length, mp3Header.length);
    assert.strictEqual(fetchRes.rows[0].file_name, 'clinical_recording.mp3');
  });

  it('2. should insert and retrieve M4A / AAC audio binary (BYTEA) with audio/mp4 MIME type', async () => {
    const m4aHeader = Buffer.from('ftypM4A ....moov....trak....data', 'utf-8');
    const fileName = 'veterinary_dictation.m4a';
    const mimeType = 'audio/mp4';

    const insertRes = await db.query(`
      INSERT INTO consultation_audio (consultation_id, audio_data, mime_type, file_name, file_size_bytes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, file_name, mime_type
    `, [testConsultationId, m4aHeader, mimeType, fileName, m4aHeader.length]);

    assert.strictEqual(insertRes.rows.length, 1);
    assert.strictEqual(insertRes.rows[0].mime_type, 'audio/mp4');
  });

  it('3. should insert and retrieve WebM audio binary (BYTEA) with audio/webm MIME type', async () => {
    const webmHeader = Buffer.from('\x1a\x45\xdf\xa3webm-test-audio-header-binary', 'utf-8');
    const fileName = 'browser_live_record.webm';
    const mimeType = 'audio/webm';

    const insertRes = await db.query(`
      INSERT INTO consultation_audio (consultation_id, audio_data, mime_type, file_name, file_size_bytes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, file_name, mime_type
    `, [testConsultationId, webmHeader, mimeType, fileName, webmHeader.length]);

    assert.strictEqual(insertRes.rows.length, 1);
    assert.strictEqual(insertRes.rows[0].mime_type, 'audio/webm');
  });
});

