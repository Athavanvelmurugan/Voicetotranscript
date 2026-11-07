const test = require('node:test');
const assert = require('node:assert/strict');
const drugNormalizer = require('../../src/modules/transcription/drug-alias.normalizer');

test('Part B.5 Drug Alias Layer & Mishearing Normalizer', async (t) => {
  await t.test('1. Seeded mishearings auto-correct to Canonical', () => {
    const cases = [
      { input: 'Prescribing clave amox 250 mg for 7 days.', expectedToken: 'Clavamox' },
      { input: 'Give maropitin injection for nausea.', expectedToken: 'Maropitant' },
      { input: 'Inject Ondanstran 4 mg IV.', expectedToken: 'Ondansetron' },
      { input: 'Start on Medicam 0.1 mg per kg.', expectedToken: 'Metacam' },
      { input: 'Switch to Cefalexin 500 mg tablets.', expectedToken: 'Cephalexin' },
    ];

    for (const { input, expectedToken } of cases) {
      const result = drugNormalizer.normalizeText(input);
      assert.strictEqual(result.rawText, input, 'rawText must be preserved unchanged');
      assert.ok(result.correctedText.includes(expectedToken), `Expected "${result.correctedText}" to contain "${expectedToken}"`);
      assert.ok(result.corrections.some(c => c.canonical === expectedToken), `Expected corrections list to record "${expectedToken}"`);
    }
  });

  await t.test('2. Ambiguous spelling (similarity between 0.70 and 0.85) flags possible drug confirm WITHOUT altering text', () => {
    // "cefalex" is truncated cephalexin (sim ~0.78), below 0.85 auto-correct threshold
    const input = 'Give cefalex once daily.';
    const result = drugNormalizer.normalizeText(input);

    // Must NOT alter raw token in correctedText
    assert.ok(result.correctedText.includes('cefalex'), 'Text must NOT be altered when below auto-correct threshold');
    // Must flag possible drug confirm
    assert.ok(result.possibleDrugs.length > 0, 'Must produce a possible drug confirm flag');
    assert.strictEqual(result.possibleDrugs[0].canonical, 'Cephalexin');
    assert.ok(result.possibleDrugs[0].flag.includes('possible drug: Cephalexin, confirm'));
  });

  await t.test('3. Random everyday words do NOT resolve to any drug', () => {
    const input = 'The brown dog was running outside under the yellow umbrella yesterday before dinner.';
    const result = drugNormalizer.normalizeText(input);

    assert.strictEqual(result.correctedText, input, 'Non-drug text must remain completely unchanged');
    assert.strictEqual(result.corrections.length, 0, 'Must have 0 auto-corrections');
    assert.strictEqual(result.possibleDrugs.length, 0, 'Must have 0 possible drug flags');
  });

  await t.test('4. Indian brand names resolve to Canonical drug family', () => {
    const input = 'Prescribed Augmentin 625 and Melonex 0.5 ml.';
    const result = drugNormalizer.normalizeText(input);

    assert.ok(result.correctedText.includes('Clavamox') || result.corrections.some(c => c.canonical === 'Clavamox'));
    assert.ok(result.correctedText.includes('Metacam') || result.corrections.some(c => c.canonical === 'Metacam'));
  });
});

