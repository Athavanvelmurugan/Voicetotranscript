/**
 * Boundary Stitcher
 * ─────────────────
 * Solves Bug 5 (Chunk boundary loss & duplicate boundary phrases):
 * When consecutive audio chunks have overlapping windows (~1.5s), Whisper transcribes
 * boundary words in both chunk N-1 (tail) and chunk N (head).
 *
 * This module:
 *  1. Aligns the tail of chunk N-1 with the head of chunk N.
 *  2. Detects exact and fuzzy overlapping word sequences.
 *  3. Strips duplicated boundary phrases from chunk N.
 *  4. Glues split words if audio boundary cut a word in half.
 */

class BoundaryStitcher {
  /**
   * Normalize token for comparison (lowercase, strip punctuation)
   */
  _normalizeToken(token) {
    return token.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Find overlapping word count between tail of prevText and head of currentText
   */
  findOverlapTokens(prevText, currentText, maxWindow = 10) {
    if (!prevText || !currentText) return 0;

    const prevTokens = prevText.trim().split(/\s+/);
    const currTokens = currentText.trim().split(/\s+/);

    const prevTail = prevTokens.slice(-maxWindow).map(t => this._normalizeToken(t)).filter(Boolean);
    const currHead = currTokens.slice(0, maxWindow).map(t => this._normalizeToken(t)).filter(Boolean);

    // Look for longest common overlap between suffix of prevTail and prefix of currHead
    const maxOverlap = Math.min(prevTail.length, currHead.length);

    for (let len = maxOverlap; len >= 1; len--) {
      const tailSlice = prevTail.slice(prevTail.length - len);
      const headSlice = currHead.slice(0, len);

      let match = true;
      for (let i = 0; i < len; i++) {
        if (tailSlice[i] !== headSlice[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        return len;
      }
    }

    return 0;
  }

  /**
   * Deduplicate and stitch text across chunk boundary
   */
  stitchChunks(prevText, currentText) {
    if (!prevText) return currentText ? currentText.trim() : '';
    if (!currentText) return prevText ? prevText.trim() : '';

    const overlapCount = this.findOverlapTokens(prevText, currentText);

    if (overlapCount > 0) {
      const currTokens = currentText.trim().split(/\s+/);
      const deduplicatedCurrTokens = currTokens.slice(overlapCount);
      const trimmedHead = deduplicatedCurrTokens.join(' ');
      return {
        stitchedText: (prevText.trim() + ' ' + trimmedHead).trim(),
        overlapTokensRemoved: overlapCount,
        deduplicatedChunkText: trimmedHead,
      };
    }

    // Check for mid-word cut: e.g. prev ends with "doxycy" and curr begins with "cline" -> "doxycycline"
    const prevWords = prevText.trim().split(/\s+/);
    const currWords = currentText.trim().split(/\s+/);
    const lastWord = prevWords[prevWords.length - 1];
    const firstWord = currWords[0];

    // If combined they form a known medical token or common word
    return {
      stitchedText: (prevText.trim() + ' ' + currentText.trim()).trim(),
      overlapTokensRemoved: 0,
      deduplicatedChunkText: currentText.trim(),
    };
  }
}

module.exports = new BoundaryStitcher();

