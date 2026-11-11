/**
 * useMicrophone — Whisper-based Audio Transcription Hook
 * ───────────────────────────────────────────────────────
 * Architecture:
 *   1. Browser MediaRecorder captures live microphone audio
 *   2. Every CHUNK_INTERVAL_MS (default 15s), the recorded blob is uploaded
 *      to POST /api/v1/consultations/:id/audio-chunk as multipart/form-data
 *   3. Node.js backend sends the chunk to Whisper API (whisper-1)
 *   4. Whisper returns timestamped segments → saved to DB → broadcast via WS
 *   5. This hook fires onChunkProcessed callback for each returned segment
 *
 * Speaker control:
 *   The hook tracks currentSpeaker ('doctor' | 'owner') which is attached
 *   to every uploaded chunk. The UI lets the vet toggle who is speaking.
 *
 * Language:
 *   Passed as a param — 'en' | 'ta' | 'en-ta'. Sent with each chunk upload
 *   so Whisper gets the correct language hint.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// How often (ms) to slice the recording and send to Whisper
const CHUNK_INTERVAL_MS = 10000; // 10 seconds continuous streaming

export function useMicrophone({
  consultationId,
  language = 'en',
  doctorId = 1,
  onChunkProcessed,  // callback(segments[]) fired after each Whisper response
  onChunkError,      // callback(error) fired on upload/transcription failure
}) {
  const [isRecording, setIsRecording]       = useState(false);
  const [isPaused, setIsPaused]             = useState(false);
  const [micPermission, setMicPermission]   = useState('prompt'); // 'prompt'|'granted'|'denied'
  const [currentSpeaker, setCurrentSpeaker] = useState('doctor'); // 'doctor'|'owner'
  const [chunkStatus, setChunkStatus]       = useState(null);     // 'uploading'|'processing'|'done'|'error'
  const [chunkCount, setChunkCount]         = useState(0);
  const [error, setError]                   = useState(null);

  const mediaRecorderRef   = useRef(null);
  const streamRef          = useRef(null);
  const chunkIndexRef      = useRef(0);
  const currentSpeakerRef  = useRef(currentSpeaker);
  const overlapBlobRef     = useRef(null); // stores 1.5s trailing slice for Bug 5
  const intervalTimerRef   = useRef(null);

  useEffect(() => {
    currentSpeakerRef.current = currentSpeaker;
  }, [currentSpeaker]);

  // Reset chunk telemetry when switching or creating consultations
  useEffect(() => {
    setChunkCount(0);
    setChunkStatus(null);
    chunkIndexRef.current = 0;
    overlapBlobRef.current = null;
  }, [consultationId]);

  // ─── Upload a single audio blob chunk to backend Whisper endpoint ───────────
  const uploadChunk = useCallback(async (blob, speakerRole) => {
    if (!blob || blob.size < 1000) {
      // Skip tiny or empty chunks (silence / no audio)
      console.log('[Mic] Skipping empty audio chunk:', blob?.size, 'bytes');
      return;
    }

    const idx = chunkIndexRef.current++;
    setChunkStatus('uploading');
    setChunkCount(idx + 1);

    // Determine file extension from MediaRecorder mime type
    const mimeType = blob.type || 'audio/webm';
    const ext = mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('wav') ? 'wav'
      : 'webm';

    const formData = new FormData();
    formData.append('audio', blob, `chunk_${idx}.${ext}`);
    formData.append('speakerRole', speakerRole);
    formData.append('chunkIndex', String(idx));
    formData.append('language', language);

    try {
      setChunkStatus('processing');
      const res = await fetch(`/api/v1/consultations/${consultationId}/audio-chunk`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Whisper transcription failed');
      }

      setChunkStatus('done');

      if (onChunkProcessed && data.data?.segments?.length > 0) {
        onChunkProcessed(data.data.segments);
      }

      return data.data;
    } catch (err) {
      console.error('[Mic] Chunk upload error:', err.message);
      setChunkStatus('error');
      setError(err.message);
      if (onChunkError) onChunkError(err);
    }
  }, [consultationId, language, doctorId, onChunkProcessed, onChunkError]);

  // Process blob with 1.5s boundary overlap (Bug 5) and upload continuously (Bug 8)
  const processAndUploadBlob = useCallback(async (blob) => {
    if (!blob || blob.size < 1000) return;

    let payloadBlob = blob;
    if (overlapBlobRef.current) {
      payloadBlob = new Blob([overlapBlobRef.current, blob], { type: blob.type || 'audio/webm' });
    }

    // Save trailing ~1.5s slice for the next chunk's boundary overlap
    try {
      const overlapSize = Math.floor(blob.size * 0.15); // ~15% of 10s chunk is ~1.5s
      if (overlapSize > 500) {
        overlapBlobRef.current = blob.slice(blob.size - overlapSize, blob.size, blob.type);
      }
    } catch (_) {}

    await uploadChunk(payloadBlob, currentSpeakerRef.current);
  }, [uploadChunk]);

  // ─── Start recording ─────────────────────────────────────────────────────────
  const startCapture = useCallback(async () => {
    setError(null);
    setChunkStatus(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,          // mono — Whisper doesn't need stereo
          sampleRate: 16000,        // 16kHz optimal for Whisper
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      setMicPermission('granted');

      // Determine best mime type the browser supports
      const preferredMime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find(m => MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(stream, {
        ...(preferredMime ? { mimeType: preferredMime } : {}),
      });

      mediaRecorderRef.current = recorder;

      // Continuous streaming: ondataavailable uploads chunks immediately every 10s (Bug 8)
      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          await processAndUploadBlob(e.data);
        }
      };

      recorder.onstop = () => {
        console.log('[Mic] MediaRecorder stopped.');
      };

      recorder.start(CHUNK_INTERVAL_MS);

      // Interval fallback to guarantee periodic chunk requests across all browser implementations
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.requestData();
          } catch (_) {}
        }
      }, CHUNK_INTERVAL_MS);

      setIsRecording(true);
      setIsPaused(false);

    } catch (err) {
      console.error('[Mic] getUserMedia error:', err);
      setMicPermission('denied');
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings, then try again.'
          : err.message,
      );
    }
  }, [processAndUploadBlob]);

  // ─── Pause: pause MediaRecorder without resetting chunk index (Bug 8) ────────
  const pauseCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    if (recorder.state === 'recording') {
      try {
        recorder.requestData(); // flush pending audio before pausing
      } catch (_) {}
      recorder.pause();
    }

    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }

    setIsPaused(true);
    setIsRecording(false);
  }, []);

  // ─── Resume: resume MediaRecorder on same stream ──────────────────────────
  const resumeCapture = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.requestData();
          } catch (_) {}
        }
      }, CHUNK_INTERVAL_MS);
      setIsRecording(true);
      setIsPaused(false);
      return;
    }

    // If recorder was stopped, re-start on existing stream without resetting chunkIndexRef
    if (!streamRef.current) {
      await startCapture();
      return;
    }

    const stream = streamRef.current;
    const preferredMime = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ].find(m => MediaRecorder.isTypeSupported(m)) || '';

    const newRecorder = new MediaRecorder(stream, {
      ...(preferredMime ? { mimeType: preferredMime } : {}),
    });

    mediaRecorderRef.current = newRecorder;

    newRecorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) {
        await processAndUploadBlob(e.data);
      }
    };

    newRecorder.start(CHUNK_INTERVAL_MS);

    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    intervalTimerRef.current = setInterval(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.requestData();
        } catch (_) {}
      }
    }, CHUNK_INTERVAL_MS);

    setIsRecording(true);
    setIsPaused(false);
  }, [processAndUploadBlob, startCapture]);

  // ─── Stop: flush final chunk, release mic ────────────────────────────────────
  const stopCapture = useCallback(() => {
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch (_) {}
      recorder.stop();
    }

    // Release microphone track
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    overlapBlobRef.current   = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // ─── Manual "flush now" — force-upload current buffer before timeslice fires ─
  const flushCurrentChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    // Stop triggers onstop which uploads, then immediately restart
    recorder.stop();
    setTimeout(() => {
      if (streamRef.current) {
        resumeCapture();
      }
    }, 300);
  }, [resumeCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    isRecording,
    isPaused,
    micPermission,
    currentSpeaker,
    setCurrentSpeaker,
    chunkStatus,
    chunkCount,
    error,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    flushCurrentChunk,
  };
}
