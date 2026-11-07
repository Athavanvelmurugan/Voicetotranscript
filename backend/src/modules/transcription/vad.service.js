/**
 * VAD (Voice Activity Detection) Service
 * ───────────────────────────────────────
 * Pre-ASR audio gating & silence trimming:
 *  - High-precision frame-based PCM energy (RMS) calculation
 *  - Drops non-speech / silent regions with 300ms hangover padding
 *  - Bypasses Whisper completely when no speech is detected
 *  - Logs dropped regions (start, end, reason, RMS) for clinical transparency
 */

class VadService {
  constructor() {
    this.FRAME_DURATION_MS = 20; // 20ms analysis frames
    this.SPEECH_RMS_THRESHOLD = 0.008; // -42 dB speech detection gate
    this.PADDING_MS = 300; // 300ms padding around speech regions
  }

  /**
   * Parse PCM metadata from standard WAV header
   */
  _parseWavHeader(buffer) {
    if (!buffer || buffer.length < 44) return null;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      return null;
    }

    const fmtIndex = buffer.indexOf('fmt ');
    if (fmtIndex === -1 || fmtIndex + 16 > buffer.length) return null;

    const audioFormat = buffer.readUInt16LE(fmtIndex + 8);
    const numChannels = buffer.readUInt16LE(fmtIndex + 10);
    const sampleRate = buffer.readUInt32LE(fmtIndex + 12);
    const bitsPerSample = buffer.readUInt16LE(fmtIndex + 22);

    const dataIndex = buffer.indexOf('data');
    if (dataIndex === -1 || dataIndex + 8 > buffer.length) return null;

    const dataOffset = dataIndex + 8;
    const dataSize = buffer.readUInt32LE(dataIndex + 4);

    return {
      audioFormat,
      numChannels,
      sampleRate,
      bitsPerSample,
      dataOffset,
      dataSize: Math.min(dataSize, buffer.length - dataOffset),
    };
  }

  /**
   * Process an audio buffer through the Pre-ASR VAD gate
   */
  processAudioBuffer(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return { hasSpeech: false, trimmedBuffer: null, speechRegions: [], droppedRegions: [] };
    }

    const wavInfo = this._parseWavHeader(buffer);
    // If not uncompressed 16-bit PCM WAV, pass through to Post-ASR gate
    if (!wavInfo || wavInfo.audioFormat !== 1 || wavInfo.bitsPerSample !== 16) {
      return {
        hasSpeech: true,
        trimmedBuffer: buffer,
        speechRegions: [],
        droppedRegions: [],
        isPcmWav: false,
      };
    }

    const { numChannels, sampleRate, dataOffset, dataSize } = wavInfo;
    const bytesPerSample = 2; // 16-bit = 2 bytes
    const bytesPerFrame = Math.floor((sampleRate * this.FRAME_DURATION_MS) / 1000) * numChannels * bytesPerSample;
    const totalFrames = Math.floor(dataSize / bytesPerFrame);

    if (totalFrames === 0) {
      return { hasSpeech: false, trimmedBuffer: null, speechRegions: [], droppedRegions: [] };
    }

    const frameSpeech = new Array(totalFrames).fill(false);
    const frameRms = new Array(totalFrames).fill(0);

    // 1. Calculate RMS per frame
    for (let f = 0; f < totalFrames; f++) {
      const frameStartByte = dataOffset + f * bytesPerFrame;
      let sumSq = 0;
      let sampleCount = 0;

      for (let offset = frameStartByte; offset < frameStartByte + bytesPerFrame; offset += numChannels * bytesPerSample) {
        if (offset + 2 <= buffer.length) {
          // Read 16-bit signed integer sample
          const sample = buffer.readInt16LE(offset) / 32768.0;
          sumSq += sample * sample;
          sampleCount++;
        }
      }

      const rms = sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : 0;
      frameRms[f] = rms;
      if (rms >= this.SPEECH_RMS_THRESHOLD) {
        frameSpeech[f] = true;
      }
    }

    // 2. Apply 300ms hangover padding before and after speech
    const paddingFrames = Math.ceil(this.PADDING_MS / this.FRAME_DURATION_MS);
    const paddedSpeech = new Array(totalFrames).fill(false);

    for (let f = 0; f < totalFrames; f++) {
      if (frameSpeech[f]) {
        const startPad = Math.max(0, f - paddingFrames);
        const endPad = Math.min(totalFrames - 1, f + paddingFrames);
        for (let p = startPad; p <= endPad; p++) {
          paddedSpeech[p] = true;
        }
      }
    }

    // 3. Extract continuous speech and dropped regions
    const speechRegions = [];
    const droppedRegions = [];

    let inSpeech = false;
    let regionStartFrame = 0;

    for (let f = 0; f < totalFrames; f++) {
      const isSpeechFrame = paddedSpeech[f];

      if (isSpeechFrame && !inSpeech) {
        // Speech region start
        if (f > 0 && !inSpeech) {
          // Record preceding silence region
          const startMs = regionStartFrame * this.FRAME_DURATION_MS;
          const endMs = f * this.FRAME_DURATION_MS;
          const avgRms = frameRms.slice(regionStartFrame, f).reduce((a, b) => a + b, 0) / (f - regionStartFrame || 1);
          droppedRegions.push({
            startMs,
            endMs,
            reason: 'silence',
            rms: parseFloat(avgRms.toFixed(5)),
          });
        }
        inSpeech = true;
        regionStartFrame = f;
      } else if (!isSpeechFrame && inSpeech) {
        // Speech region end
        const startMs = regionStartFrame * this.FRAME_DURATION_MS;
        const endMs = f * this.FRAME_DURATION_MS;
        const startByte = dataOffset + regionStartFrame * bytesPerFrame;
        const endByte = dataOffset + f * bytesPerFrame;
        speechRegions.push({ startMs, endMs, startByte, endByte });
        inSpeech = false;
        regionStartFrame = f;
      }
    }

    // Close final region
    if (inSpeech) {
      const startMs = regionStartFrame * this.FRAME_DURATION_MS;
      const endMs = totalFrames * this.FRAME_DURATION_MS;
      const startByte = dataOffset + regionStartFrame * bytesPerFrame;
      const endByte = dataOffset + totalFrames * bytesPerFrame;
      speechRegions.push({ startMs, endMs, startByte, endByte });
    } else {
      const startMs = regionStartFrame * this.FRAME_DURATION_MS;
      const endMs = totalFrames * this.FRAME_DURATION_MS;
      if (endMs > startMs) {
        const avgRms = frameRms.slice(regionStartFrame, totalFrames).reduce((a, b) => a + b, 0) / (totalFrames - regionStartFrame || 1);
        droppedRegions.push({
          startMs,
          endMs,
          reason: 'silence',
          rms: parseFloat(avgRms.toFixed(5)),
        });
      }
    }

    // Log dropped silent regions
    for (const dropped of droppedRegions) {
      console.log(`[VAD] Dropped silence region: ${dropped.startMs}ms - ${dropped.endMs}ms (rms=${dropped.rms})`);
    }

    // If no speech detected at all
    if (speechRegions.length === 0) {
      return {
        hasSpeech: false,
        trimmedBuffer: null,
        speechRegions: [],
        droppedRegions,
        isPcmWav: true,
      };
    }

    // If speech was found, construct trimmed PCM WAV preserving exact header chunks
    const speechChunks = speechRegions.map(r => buffer.subarray(r.startByte, r.endByte));
    const totalSpeechDataSize = speechChunks.reduce((acc, c) => acc + c.length, 0);

    const header = Buffer.from(buffer.subarray(0, dataOffset));
    // Update RIFF total size: header.length - 8 + totalSpeechDataSize at offset 4
    header.writeUInt32LE(dataOffset - 8 + totalSpeechDataSize, 4);
    // Update data chunk size at offset (dataOffset - 4)
    header.writeUInt32LE(totalSpeechDataSize, dataOffset - 4);

    const trimmedBuffer = Buffer.concat([header, ...speechChunks]);

    return {
      hasSpeech: true,
      trimmedBuffer,
      speechRegions,
      droppedRegions,
      isPcmWav: true,
    };
  }
}

module.exports = new VadService();

