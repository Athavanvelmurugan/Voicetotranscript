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
const CHUNK_INTERVAL_MS = 15000; // 15 seconds

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

  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const chunkIndexRef    = useRef(0);
  const chunkBufferRef   = useRef([]); // collects blobs during recording interval

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
        headers: { 'x-doctor-id': String(doctorId) },
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
  }, [consultationId, language, onChunkProcessed, onChunkError]);

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
      chunkBufferRef.current   = [];

      // Collect blobs (fires every timeslice interval)
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunkBufferRef.current.push(e.data);
        }
      };

      // On each timeslice stop → merge blobs → upload → restart
      recorder.onstop = async () => {
        const blobs = chunkBufferRef.current.splice(0);
        if (blobs.length === 0) return;

        const merged = new Blob(blobs, { type: blobs[0].type || 'audio/webm' });

        // Use the currentSpeaker captured at stop time (via ref)
        await uploadChunk(merged, currentSpeaker);
      };

      // Start with timeslice — fires ondataavailable every interval
      recorder.start(CHUNK_INTERVAL_MS);
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
  }, [currentSpeaker, uploadChunk]);

  // ─── Pause: stop MediaRecorder (triggers final chunk) ────────────────────────
  const pauseCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.stop(); // triggers onstop → uploads the current buffer
    setIsPaused(true);
    setIsRecording(false);
  }, []);

  // ─── Resume: re-create MediaRecorder on same stream ──────────────────────────
  const resumeCapture = useCallback(async () => {
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

    const recorder = new MediaRecorder(stream, {
      ...(preferredMime ? { mimeType: preferredMime } : {}),
    });

    mediaRecorderRef.current = recorder;
    chunkBufferRef.current   = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunkBufferRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blobs = chunkBufferRef.current.splice(0);
      if (blobs.length === 0) return;
      const merged = new Blob(blobs, { type: blobs[0].type || 'audio/webm' });
      await uploadChunk(merged, currentSpeaker);
    };

    recorder.start(CHUNK_INTERVAL_MS);
    setIsRecording(true);
    setIsPaused(false);
  }, [currentSpeaker, startCapture, uploadChunk]);

  // ─── Stop: flush final chunk, release mic ────────────────────────────────────
  const stopCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // triggers onstop → uploads last chunk
    }

    // Release microphone track
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

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
