/**
 * Whisper Audio Transcription Client (Powered by Groq API)
 * ──────────────────────────────────────────────────────────
 * Uses Groq's ultra-fast Whisper API (whisper-large-v3) or OpenAI Whisper.
 *
 * Key features:
 *  - Groq LPU inference: sub-second transcription latency
 *  - model: 'whisper-large-v3' (state of the art multilingual accuracy)
 *  - response_format: 'verbose_json' gives per-segment start/end timestamps
 *  - seeds the model with veterinary context prompt to preserve drug names
 *  - multilingual support (en / ta / en-ta Tanglish)
 */

const fs = require('fs');
const path = require('path');
const { toFile } = require('openai');
const config = require('../../config');
const vadService = require('./vad.service');
const drugNormalizer = require('./drug-alias.normalizer');

const LANGUAGE_MAP = {
  en: 'en',
  ta: 'ta',
  'en-ta': null, // auto-detect
};

const VETERINARY_PROMPT = `Veterinary medical consultation between a veterinarian and pet owner.
Preserve exact drug names, dosages, and units: Doxycycline, Amoxicillin, Metronidazole, Prednisone, Meloxicam, Apoquel, mg, ml, kg, bpm.`;

const TAMIL_PROMPT = `இது ஒரு கால்நடை மருத்துவ கலந்தாய்வு. ஆங்கில மருந்து பெயர்களை அப்படியே வைத்திருக்கவும்.
This is a Tamil veterinary consultation. English drug names, doses, and medical terms must stay in English.`;

const PHANTOM_BLOCKLIST = [
  'thank you for watching',
  'thanks for watching',
  'please subscribe',
  'like and subscribe',
  'subtitles by',
  'copyright',
  'all rights reserved',
  'thank you very much for watching',
  'see you in the next video',
  'subscribe to my channel',
  'subscribe to our channel',
];

class WhisperClient {
  constructor() {
    this.client = null;
    this.provider = null;
    this.model = null;
    this._init();
  }

  _init() {
    const { OpenAI } = require('openai');

    // Startup check: mock mode is strictly prohibited in production
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_WHISPER_MOCK === 'true') {
      throw new Error('[Whisper FATAL] Mock transcription is strictly forbidden in production mode.');
    }

    // 1. Prefer Groq if key is configured
    if (config.groq?.apiKey && !config.groq.apiKey.startsWith('mock')) {
      try {
        this.client = new OpenAI({
          apiKey: config.groq.apiKey,
          baseURL: config.groq.baseURL,
        });
        this.provider = 'groq';
        this.model = config.groq.whisperModel || 'whisper-large-v3';
        console.log(`[Whisper] ✅ Groq API active (model: ${this.model})`);
        return;
      } catch (err) {
        console.warn('[Whisper] Failed to initialize Groq client:', err.message);
      }
    }

    // 2. Fallback to OpenAI if configured
    if (config.openai?.apiKey && !config.openai.apiKey.startsWith('mock')) {
      try {
        this.client = new OpenAI({ apiKey: config.openai.apiKey });
        this.provider = 'openai';
        this.model = 'whisper-1';
        console.log(`[Whisper] ✅ OpenAI API active (model: ${this.model})`);
        return;
      } catch (err) {
        console.warn('[Whisper] Failed to initialize OpenAI client:', err.message);
      }
    }

    // 3. Mock mode fallback: ONLY allowed in test environment with explicit flag
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_WHISPER_MOCK === 'true') {
      this.provider = 'mock';
      console.log('[Whisper] [TEST-MOCK] Running in explicit test mock mode.');
      return;
    }

    this.provider = null;
    console.error('[Whisper] ⚠️ No live API key detected. Transcription requests will fail loudly without mocks.');
  }

  /**
   * Transcribe an audio file or in-memory buffer
   */
  async transcribe({ filePath, buffer, fileName = 'audio.wav', language = 'en', speakerRole = 'unknown', chunkIndex = 0, baseSequence = 0 }) {
    // 1. Pre-ASR VAD gate: check PCM energy and trim silence before sending to Whisper
    let targetBuffer = buffer;
    if (!targetBuffer && filePath && fs.existsSync(filePath)) {
      try {
        targetBuffer = fs.readFileSync(filePath);
      } catch (_) {}
    }

    if (targetBuffer && Buffer.isBuffer(targetBuffer)) {
      const vadResult = vadService.processAudioBuffer(targetBuffer);
      if (!vadResult.hasSpeech) {
        console.log('[Whisper] 🔇 Pure silence / no speech detected by VAD gate. Skipping Whisper call.');
        return {
          status: 'no_speech_detected',
          detectedLanguage: language || 'en',
          fullText: '',
          segments: [],
          droppedRegions: vadResult.droppedRegions,
        };
      }
      if (vadResult.trimmedBuffer) {
        buffer = vadResult.trimmedBuffer;
      }
    }

    if (this.client) {
      // Must FAIL LOUDLY on error — never catch and fabricate clinical mock text!
      return await this._transcribeLive({ filePath, buffer, fileName, language, speakerRole, chunkIndex, baseSequence });
    }

    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_WHISPER_MOCK === 'true') {
      return this._mockTranscription({ language, speakerRole, chunkIndex, baseSequence });
    }

    const err = new Error('Transcription service is unavailable: No live API client configured.');
    err.status = 502;
    err.code = 'TRANSCRIPTION_SERVICE_UNAVAILABLE';
    throw err;
  }

  /**
   * Call Groq / OpenAI Whisper endpoint (supports in-memory buffer or disk file)
   */
  async _transcribeLive({ filePath, buffer, fileName = 'audio.wav', language, speakerRole, chunkIndex, baseSequence }) {
    let filePayload;
    if (buffer && Buffer.isBuffer(buffer)) {
      if (buffer.length === 0) {
        const err = new Error('Audio buffer is empty (0 bytes).');
        err.status = 400;
        err.code = 'INVALID_AUDIO_INPUT';
        throw err;
      }
      filePayload = await toFile(buffer, fileName);
    } else if (filePath && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        const err = new Error(`Audio file on disk is empty (0 bytes): ${filePath}`);
        err.status = 400;
        err.code = 'INVALID_AUDIO_INPUT';
        throw err;
      }
      filePayload = fs.createReadStream(filePath);
    } else {
      const err = new Error(`Neither audio buffer nor valid audio file found on disk (${filePath}).`);
      err.status = 400;
      err.code = 'AUDIO_FILE_NOT_FOUND';
      throw err;
    }

    const whisperLanguage = LANGUAGE_MAP[language] ?? null;
    const prompt = language === 'ta' ? TAMIL_PROMPT : VETERINARY_PROMPT;

    console.log(`[Whisper:${this.provider}] Transcribing chunk #${chunkIndex} via ${this.model} | lang=${whisperLanguage || 'auto'} | speaker=${speakerRole}`);

    const response = await this.client.audio.transcriptions.create({
      file: filePayload,
      model: this.model,
      ...(whisperLanguage ? { language: whisperLanguage } : {}),
      response_format: 'verbose_json',
      prompt,
      temperature: 0.0,
    });

    return this._parseWhisperResponse(response, speakerRole, chunkIndex, baseSequence);
  }

  _parseWhisperResponse(response, speakerRole, chunkIndex, baseSequence) {
    const detectedLanguage = response.language || 'en';
    const rawSegments = response.segments || [];

    // Helper to test for phantom hallucination phrases
    const isPhantomPhrase = (text) => {
      if (!text) return true;
      const clean = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      return PHANTOM_BLOCKLIST.some(phrase => clean.includes(phrase) || phrase.includes(clean));
    };

    // Helper to test if a segment is noise or hallucination
    const isDroppedSegment = (seg) => {
      const text = seg.text?.trim() || '';
      if (!text) return true;
      if (isPhantomPhrase(text)) return true;
      if (seg.no_speech_prob != null && seg.no_speech_prob > 0.6 && seg.avg_logprob != null && seg.avg_logprob < -1.0) {
        return true;
      }
      return false;
    };

    if (rawSegments.length === 0 && response.text?.trim()) {
      if (isPhantomPhrase(response.text)) {
        return {
          status: 'no_speech_detected',
          detectedLanguage,
          fullText: '',
          segments: [],
          droppedSegments: [{ text: response.text, reason: 'phantom_blocklist' }],
        };
      }
      return {
        status: 'success',
        detectedLanguage,
        fullText: response.text.trim(),
        segments: [{
          sequenceOffset: baseSequence + 1,
          text: response.text.trim(),
          speakerRole,
          startMs: 0,
          endMs: 0,
          confidence: 0.98,
          chunkIndex,
        }],
      };
    }

    const validSegments = [];
    const droppedSegments = [];

    for (let idx = 0; idx < rawSegments.length; idx++) {
      const seg = rawSegments[idx];
      if (isDroppedSegment(seg)) {
        const reason = isPhantomPhrase(seg.text) ? 'phantom_blocklist' : 'high_no_speech_prob';
        droppedSegments.push({
          text: seg.text,
          startMs: Math.round((seg.start || 0) * 1000),
          endMs: Math.round((seg.end || 0) * 1000),
          no_speech_prob: seg.no_speech_prob,
          avg_logprob: seg.avg_logprob,
          reason,
        });
        console.warn(`[Whisper Post-Filter] Dropped hallucinated/silent segment: "${seg.text}" (reason: ${reason})`);
      } else {
        const avgLogprob = seg.avg_logprob != null ? parseFloat(Number(seg.avg_logprob).toFixed(3)) : null;
        const noSpeechProb = seg.no_speech_prob != null ? parseFloat(Number(seg.no_speech_prob).toFixed(3)) : null;
        const isLowConfidence = avgLogprob != null && avgLogprob < -1.0;
        const containsMedicalToken = /\b(mg|ml|mcg|microgram|tablet|tab|bid|sid|tid|qid|prn|kg|doxycycline|amoxicillin|clavamox|metronidazole|meloxicam|carprofen|prednisone|prednisolone|maropitant|ondansetron|pantoprazole|cephalexin|gabapentin|tramadol|apoquel|cytopoint|levothyroxine|furosemide|dose|dosage)\b/i.test(seg.text);

        const rawSegText = seg.text.trim();
        const norm = drugNormalizer.normalizeText(rawSegText);
        const correctedText = norm.correctedText;
        const hasPossibleDrug = norm.possibleDrugs.length > 0;
        const needsVetReview = (isLowConfidence && containsMedicalToken) || hasPossibleDrug;

        validSegments.push({
          sequenceOffset: baseSequence + validSegments.length + 1,
          raw_text: rawSegText,
          text: correctedText,
          speakerRole,
          startMs: Math.round((seg.start || 0) * 1000),
          endMs: Math.round((seg.end || 0) * 1000),
          confidence: noSpeechProb != null ? parseFloat((1 - noSpeechProb).toFixed(3)) : 0.98,
          avg_logprob: avgLogprob,
          no_speech_prob: noSpeechProb,
          low_confidence: isLowConfidence,
          needs_vet_review: needsVetReview,
          drug_corrections: norm.corrections,
          possible_drugs: norm.possibleDrugs,
          chunkIndex,
        });
      }
    }

    if (validSegments.length === 0) {
      return {
        status: 'no_speech_detected',
        model: this.model,
        provider: this.provider,
        detectedLanguage,
        fullText: '',
        segments: [],
        droppedSegments,
      };
    }

    return {
      status: 'success',
      model: this.model,
      provider: this.provider,
      detectedLanguage,
      fullText: validSegments.map(s => s.text).join(' '),
      segments: validSegments,
      droppedSegments,
    };
  }

  _mockTranscription({ language, speakerRole, chunkIndex, baseSequence }) {
    const mockPhrases = {
      owner: [
        'Bella has been coughing non-stop for the past three days and seems very tired.',
        'She is not eating her dry kibble, only taking small amounts of wet food.',
        'She was at the dog park last weekend and played with other dogs.',
        'No, she has no known allergies. Her last vaccine was about eight months ago.',
      ],
      doctor: [
        'On auscultation, her lungs sound clear bilaterally. Heart rate is 110 beats per minute.',
        'There is mild tracheal sensitivity on palpation. Temperature is 38.6 degrees Celsius.',
        'Based on the presentation, this looks like infectious tracheobronchitis, commonly called kennel cough.',
        'I am going to prescribe Doxycycline 100 milligrams, one tablet twice daily with food for 10 days.',
        'Also prescribing a cough suppressant — half a tablet of Hycodan every 8 to 12 hours as needed.',
        'Please switch to a harness during walks to avoid pressure on the trachea.',
        'Bring her back in one week if the cough has not improved, or immediately if breathing becomes labored.',
      ],
      unknown: [
        'The consultation is in progress.',
      ],
    };

    const pool = mockPhrases[speakerRole] || mockPhrases.unknown;
    const phraseIndex = chunkIndex % pool.length;
    const text = pool[phraseIndex];

    return {
      detectedLanguage: language === 'ta' ? 'ta' : 'en',
      fullText: text,
      segments: [{
        sequenceOffset: baseSequence + 1,
        text,
        speakerRole,
        startMs: 0,
        endMs: 10000,
        confidence: 0.97,
        chunkIndex,
      }],
    };
  }
}

module.exports = new WhisperClient();
