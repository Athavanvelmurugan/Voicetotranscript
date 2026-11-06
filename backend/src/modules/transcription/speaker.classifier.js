/**
 * Semantic Clinical Speaker Classifier (Turn Diarization)
 * ───────────────────────────────────────────────────────
 * Analyzes transcribed utterances during live clinical consultations and
 * attributes them to 'doctor' (veterinarian) or 'owner' (pet owner)
 * based on linguistic markers, clinical inquiry, examination, and anamnesis.
 */

class SpeakerClassifier {
  constructor() {
    // Phrases & terminology typical of attending veterinarian
    this.doctorPatterns = [
      /\b(how long|when did (she|he|it)|any vomiting|any diarrhea|appetite|drinking water)\b/i,
      /\b(let('s| me) (take a look|examine|check|listen|feel)|auscultat|heart rate|bpm|temperature|lungs|mucous membrane)\b/i,
      /\b(i recommend|my diagnosis|i suspect|we need to run|blood work|cbc|urinalysis|x-ray|radiograph|ultrasound)\b/i,
      /\b(prescrib|dosage|tablet|mg|ml|twice daily|once a day|with food|antibiotic|anti-inflammatory|amoxicillin|doxycycline|meloxicam|prednisone)\b/i,
      /\b(schedule a follow-up|re-check in|bring (her|him) back|keep an eye on|monitor for)\b/i,
    ];

    // Phrases typical of pet owner presenting the patient
    this.ownerPatterns = [
      /\b((she|he) started|noticed it|at home|in the yard|since yesterday|for (a few|two|three|several) days)\b/i,
      /\b((she|he) won't eat|(not|hasn't been) eating|throwing up|scratching|lethargic|limping|whining|crying)\b/i,
      /\b(my (dog|cat|puppy|kitten)|is (she|he) going to be okay|what should i do|thank you doctor|thanks doctor)\b/i,
    ];
  }

  /**
   * Classify speaker role from utterance text
   * @param {string} text - Transcribed sentence/segment
   * @param {string} forcedRole - Role provided by manual toggle if not 'auto'
   * @returns {'doctor' | 'owner'}
   */
  classify(text, forcedRole = 'auto') {
    if (forcedRole && forcedRole !== 'auto' && forcedRole !== 'unknown') {
      return forcedRole;
    }

    if (!text || typeof text !== 'string') {
      return 'doctor'; // Default to primary clinician
    }

    const cleanText = text.trim();

    // 1. Check Doctor patterns
    for (const pattern of this.doctorPatterns) {
      if (pattern.test(cleanText)) {
        return 'doctor';
      }
    }

    // 2. Check Owner patterns
    for (const pattern of this.ownerPatterns) {
      if (pattern.test(cleanText)) {
        return 'owner';
      }
    }

    // 3. Fallback: Questions are usually Doctor inquiries, statements of symptoms are usually Owner
    if (cleanText.endsWith('?')) {
      return 'doctor';
    }

    return 'doctor';
  }
}

module.exports = new SpeakerClassifier();

