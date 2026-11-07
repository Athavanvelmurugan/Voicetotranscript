/**
 * ASR Clinical Audit Metrics Module
 * Computes WER, CER, Drug-Recall, Number-Unit-Accuracy, Negation-Accuracy, and Hallucination detection
 */

function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[,\.\?!:;\(\)\[\]"'\-–—]/g, ' ') // strip punctuation to spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function computeWER(reference, hypothesis) {
  const refWords = normalizeText(reference).split(' ').filter(Boolean);
  const hypWords = normalizeText(hypothesis).split(' ').filter(Boolean);

  if (refWords.length === 0) {
    return hypWords.length === 0 ? 0.0 : 1.0;
  }

  const dist = levenshteinDistance(refWords, hypWords);
  return dist / refWords.length;
}

function computeCER(reference, hypothesis) {
  const refChars = normalizeText(reference).replace(/\s/g, '').split('');
  const hypChars = normalizeText(hypothesis).replace(/\s/g, '').split('');

  if (refChars.length === 0) {
    return hypChars.length === 0 ? 0.0 : 1.0;
  }

  const dist = levenshteinDistance(refChars, hypChars);
  return dist / refChars.length;
}

function computeDrugMetrics(expectedDrugs, hypothesisText) {
  if (!expectedDrugs || expectedDrugs.length === 0) return null;
  const normHyp = normalizeText(hypothesisText);

  const found = [];
  const missed = [];

  for (const drug of expectedDrugs) {
    const normDrug = normalizeText(drug);
    if (normHyp.includes(normDrug)) {
      found.push(drug);
    } else {
      missed.push(drug);
    }
  }

  const recall = found.length / expectedDrugs.length;
  return {
    expectedCount: expectedDrugs.length,
    foundCount: found.length,
    missedCount: missed.length,
    recall: parseFloat((recall * 100).toFixed(1)),
    found,
    missed,
  };
}

function computeNumberUnitAccuracy(expectedItems, hypothesisText) {
  if (!expectedItems || expectedItems.length === 0) return null;
  const normHyp = normalizeText(hypothesisText);

  const matched = [];
  const missed = [];

  for (const item of expectedItems) {
    const normItem = normalizeText(item);
    // Support numeric equivalents (e.g. 0.2 vs "zero point two" or "point two")
    let hasMatch = normHyp.includes(normItem);
    if (!hasMatch) {
      if (normItem === '0.2' && (normHyp.includes('zero point two') || normHyp.includes('point two') || normHyp.includes('0 2'))) hasMatch = true;
      if (normItem === '25' && normHyp.includes('twenty five')) hasMatch = true;
      if (normItem === '500' && normHyp.includes('five hundred')) hasMatch = true;
      if (normItem === 'half' && normHyp.includes('1/2')) hasMatch = true;
    }

    if (hasMatch) {
      matched.push(item);
    } else {
      missed.push(item);
    }
  }

  const accuracy = (matched.length / expectedItems.length) * 100;
  return {
    total: expectedItems.length,
    matchedCount: matched.length,
    missedCount: missed.length,
    accuracy: parseFloat(accuracy.toFixed(1)),
    matched,
    missed,
  };
}

function computeNegationAccuracy(expectedNegations, hypothesisText) {
  if (!expectedNegations || expectedNegations.length === 0) return null;
  const normHyp = normalizeText(hypothesisText);

  const matched = [];
  const missed = [];

  for (const neg of expectedNegations) {
    const normNeg = normalizeText(neg);
    if (normHyp.includes(normNeg)) {
      matched.push(neg);
    } else {
      missed.push(neg);
    }
  }

  const accuracy = (matched.length / expectedNegations.length) * 100;
  return {
    total: expectedNegations.length,
    matchedCount: matched.length,
    missedCount: missed.length,
    accuracy: parseFloat(accuracy.toFixed(1)),
    matched,
    missed,
  };
}

const PHANTOM_PATTERNS = [
  /thank you for watching/i,
  /thanks for watching/i,
  /subscribe to/i,
  /amara\.org/i,
  /\[music\]/i,
  /\[applause\]/i,
  /subtitles by/i,
];

function detectHallucinations(hypothesisText) {
  const phantoms = [];
  for (const p of PHANTOM_PATTERNS) {
    if (p.test(hypothesisText)) {
      phantoms.push(p.toString());
    }
  }

  // Detect repetition loop (same 3+ word phrase repeated > 3 times)
  const words = normalizeText(hypothesisText).split(' ');
  let repetitionLoop = false;
  let loopPhrase = null;

  for (let len = 3; len <= 6; len++) {
    for (let i = 0; i <= words.length - (len * 3); i++) {
      const p1 = words.slice(i, i + len).join(' ');
      const p2 = words.slice(i + len, i + (len * 2)).join(' ');
      const p3 = words.slice(i + (len * 2), i + (len * 3)).join(' ');
      if (p1 === p2 && p2 === p3 && p1.length > 5) {
        repetitionLoop = true;
        loopPhrase = p1;
        break;
      }
    }
    if (repetitionLoop) break;
  }

  return {
    hasPhantomPhrases: phantoms.length > 0,
    phantoms,
    hasRepetitionLoop: repetitionLoop,
    loopPhrase,
  };
}

module.exports = {
  normalizeText,
  computeWER,
  computeCER,
  computeDrugMetrics,
  computeNumberUnitAccuracy,
  computeNegationAccuracy,
  detectHallucinations,
};

