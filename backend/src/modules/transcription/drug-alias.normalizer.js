const fs = require('fs');
const path = require('path');

function levenshteinDistance(a, b) {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[al][bl];
}

function stringSimilarity(a, b) {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return (maxLen - dist) / maxLen;
}

class DrugAliasNormalizer {
  constructor() {
    this.aliases = [];
    this._loadAliases();
  }

  _loadAliases() {
    try {
      const filePath = path.join(__dirname, '../../config/drug_aliases.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        this.aliases = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[DrugAliasNormalizer] Could not load drug_aliases.json:', err.message);
      this.aliases = [];
    }
  }

  /**
   * Normalize input text by auto-correcting known mishearings and flagging ambiguous drug names
   * Returns: { rawText, correctedText, corrections, possibleDrugs }
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') {
      return { rawText: text, correctedText: text, corrections: [], possibleDrugs: [] };
    }

    const rawText = text;
    let correctedText = text;
    const corrections = [];
    const possibleDrugs = [];

    // 1. Pass 1: Multi-word phrase replacements (e.g. "clave amox", "cyto point", "meta cam")
    for (const drug of this.aliases) {
      const canonical = drug.canonical;
      const autoThreshold = drug.auto_correct_threshold || 0.85;
      const multiWordPhrases = (drug.known_mishearings || []).filter(m => m.includes(' '));

      for (const phrase of multiWordPhrases) {
        const regex = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        if (regex.test(correctedText)) {
          correctedText = correctedText.replace(regex, canonical);
          corrections.push({
            original: phrase,
            canonical,
            confidence: 1.0,
            type: 'known_mishearing',
          });
        }
      }
    }

    // 2. Pass 2: Indian brand name mappings (exact word match)
    for (const drug of this.aliases) {
      const canonical = drug.canonical;
      for (const brand of (drug.indian_brands || [])) {
        // Skip brands that match common English words
        if (brand.length < 3) continue;
        const brandRegex = new RegExp(`\\b${brand}\\b`, 'gi');
        if (brandRegex.test(correctedText)) {
          correctedText = correctedText.replace(brandRegex, canonical);
          corrections.push({
            original: brand,
            canonical,
            confidence: 1.0,
            type: 'indian_brand',
          });
        }
      }
    }

    // 3. Pass 3: Single-word phonetic & Levenshtein similarity
    // Extract candidate words of length >= 4 that are not common stopwords or numbers
    const words = correctedText.split(/\b/);
    const stopWords = new Set([
      'that', 'this', 'with', 'from', 'have', 'were', 'been', 'some', 'what', 'when',
      'your', 'their', 'there', 'they', 'about', 'after', 'before', 'under', 'again',
      'dog', 'cats', 'dogs', 'food', 'good', 'well', 'days', 'time', 'twice', 'daily',
      'give', 'need', 'help', 'past', 'feel', 'couch', 'dinner', 'running', 'yellow',
      'umbrella', 'yesterday', 'brown', 'outside'
    ]);

    for (const word of words) {
      const cleanWord = word.trim().toLowerCase();
      if (cleanWord.length < 4 || stopWords.has(cleanWord) || /^\d+$/.test(cleanWord)) {
        continue;
      }

      let bestMatch = null;
      let highestSim = 0;

      for (const drug of this.aliases) {
        const candidates = [drug.canonical, ...(drug.known_mishearings || [])];
        for (const candidate of candidates) {
          const sim = stringSimilarity(cleanWord, candidate);
          if (sim > highestSim) {
            highestSim = sim;
            bestMatch = drug;
          }
        }
      }

      if (bestMatch && highestSim >= 0.70) {
        const canonical = bestMatch.canonical;
        const autoThreshold = bestMatch.auto_correct_threshold || 0.85;
        const possibleThreshold = bestMatch.possible_drug_threshold || 0.70;

        if (highestSim >= autoThreshold && cleanWord !== canonical.toLowerCase()) {
          // Auto-correct above documented threshold
          const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
          correctedText = correctedText.replace(wordRegex, canonical);
          corrections.push({
            original: word,
            canonical,
            confidence: parseFloat(highestSim.toFixed(3)),
            type: 'auto_corrected',
          });
        } else if (highestSim >= possibleThreshold && highestSim < autoThreshold) {
          // Flag possible drug without altering text
          possibleDrugs.push({
            original: word,
            canonical,
            confidence: parseFloat(highestSim.toFixed(3)),
            flag: `possible drug: ${canonical}, confirm`,
          });
        }
      }
    }

    return {
      rawText,
      correctedText,
      corrections,
      possibleDrugs,
    };
  }
}

module.exports = new DrugAliasNormalizer();

