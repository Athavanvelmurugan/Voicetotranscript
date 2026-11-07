const test = require('node:test');
const assert = require('node:assert/strict');
const boundaryStitcher = require('../../src/modules/transcription/boundary.stitcher');

test('BUG 5 Regression Test: Chunk Boundary Overlap & Deduplication', async (t) => {
  await t.test('1. Deduplicates exact repeated boundary tokens from 1.5s overlap', () => {
    const prevChunkText = 'The patient has mild dehydration and we administered subcutaneous fluids';
    const currChunkText = 'subcutaneous fluids twice today and prescribed Cerenia';

    const result = boundaryStitcher.stitchChunks(prevChunkText, currChunkText);
    assert.strictEqual(result.overlapTokensRemoved, 2, 'Should detect 2 overlapping tokens ("subcutaneous", "fluids")');
    assert.strictEqual(result.deduplicatedChunkText, 'twice today and prescribed Cerenia');
    assert.strictEqual(
      result.stitchedText,
      'The patient has mild dehydration and we administered subcutaneous fluids twice today and prescribed Cerenia'
    );
  });

  await t.test('2. Handles no overlap cleanly', () => {
    const prev = 'Normal heart sounds and clear lungs.';
    const curr = 'Temperature is thirty-eight point five.';

    const result = boundaryStitcher.stitchChunks(prev, curr);
    assert.strictEqual(result.overlapTokensRemoved, 0);
    assert.strictEqual(result.stitchedText, 'Normal heart sounds and clear lungs. Temperature is thirty-eight point five.');
  });

  await t.test('3. Ignores punctuation and casing differences when finding overlap', () => {
    const prev = 'Stop Meloxicam immediately!';
    const curr = 'meloxicam immediately. Start Tramadol.';

    const result = boundaryStitcher.stitchChunks(prev, curr);
    assert.strictEqual(result.overlapTokensRemoved, 2);
    assert.strictEqual(result.deduplicatedChunkText, 'Start Tramadol.');
  });
});

