import { useEffect, useRef, useState, useCallback } from 'react';

export function useConsultationWebSocket(consultationId, onDocumentsReady, onStatusChange) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const [segments, setSegments] = useState([]);
  const [partialSegment, setPartialSegment] = useState(null);
  const [extractionProgress, setExtractionProgress] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const seenSequencesRef = useRef(new Set());
  const activeConsultationIdRef = useRef(consultationId);

  // Keep activeConsultationIdRef in sync with the current consultationId
  useEffect(() => {
    activeConsultationIdRef.current = consultationId;
  }, [consultationId]);

  const connect = useCallback(() => {
    if (!consultationId) return;

    // Use current host or proxy ws url
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/v1/consultations/${consultationId}`;

    setConnectionStatus('connecting');
    const ws = new WebSocket(wsUrl);
    ws._consultationId = consultationId;
    ws._isExplicitClose = false;
    wsRef.current = ws;

    ws.onopen = () => {
      // If active consultation changed while connecting, abort and close
      if (ws._consultationId !== activeConsultationIdRef.current) {
        ws._isExplicitClose = true;
        ws.close();
        return;
      }
      setConnectionStatus('connected');
      ws.send(JSON.stringify({ event: 'auth', token: 'doctor-session-token' }));

      // Request synchronization
      const maxSeq = Array.from(seenSequencesRef.current).reduce((max, s) => Math.max(max, s), 0);
      ws.send(JSON.stringify({ event: 'reconnect', payload: { lastSequence: maxSeq } }));
    };

    ws.onmessage = (event) => {
      // Discard any message received from a socket of an inactive consultation
      if (ws._consultationId !== activeConsultationIdRef.current) {
        return;
      }
      try {
        const msg = JSON.parse(event.data);

        switch (msg.event) {
          case 'connected':
            setConnectionStatus('connected');
            break;

          case 'transcript_partial':
            setPartialSegment({
              text: msg.text,
              speaker: msg.speaker,
              sequence: msg.sequence,
            });
            break;

          case 'transcript_final': {
            setPartialSegment(null);
            const seg = msg.segment;
            if (seg && !seenSequencesRef.current.has(seg.sequence_number)) {
              seenSequencesRef.current.add(seg.sequence_number);
              setSegments((prev) => [...prev, seg]);
            }
            break;
          }

          case 'reconnect_ok': {
            if (msg.missedSegments && msg.missedSegments.length > 0) {
              msg.missedSegments.forEach((seg) => {
                if (!seenSequencesRef.current.has(seg.sequence_number)) {
                  seenSequencesRef.current.add(seg.sequence_number);
                  setSegments((prev) => [...prev, seg]);
                }
              });
            }
            break;
          }

          case 'status_change':
            if (onStatusChange) onStatusChange(msg.status);
            break;

          case 'extraction_progress':
            setExtractionProgress(msg);
            break;

          case 'documents_ready':
            setExtractionProgress(null);
            if (onDocumentsReady) onDocumentsReady(msg.documents);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[WS Hook] Message parse error:', err);
      }
    };

    ws.onerror = (err) => {
      if (ws._consultationId === activeConsultationIdRef.current) {
        console.error('[WS Hook] WebSocket error:', err);
        setConnectionStatus('error');
      }
    };

    ws.onclose = () => {
      if (ws._consultationId === activeConsultationIdRef.current) {
        setConnectionStatus('disconnected');
      }
      // Reconnect only if this socket belongs to the currently active consultation and wasn't explicitly closed
      if (!ws._isExplicitClose && ws._consultationId === activeConsultationIdRef.current) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };
  }, [consultationId, onDocumentsReady, onStatusChange]);

  // ─── Initial HTTP fetch of saved transcript segments ─────────────────────────
  useEffect(() => {
    activeConsultationIdRef.current = consultationId;
    setSegments([]);
    setPartialSegment(null);
    seenSequencesRef.current = new Set();

    if (!consultationId) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    fetch(`/api/v1/consultations/${consultationId}/transcript`, { signal })
      .then((res) => res.json())
      .then((data) => {
        if (signal.aborted) return;
        if (activeConsultationIdRef.current !== consultationId) return;
        if (data.success && Array.isArray(data.data)) {
          const loaded = data.data;
          const set = new Set();
          loaded.forEach((seg) => {
            if (seg.sequence_number != null) {
              set.add(seg.sequence_number);
            }
          });
          seenSequencesRef.current = set;
          setSegments(loaded);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('[WS Hook] Error loading initial transcript:', err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [consultationId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current._isExplicitClose = true;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const reloadTranscript = useCallback(async () => {
    if (!consultationId) {
      setSegments([]);
      setPartialSegment(null);
      seenSequencesRef.current = new Set();
      return;
    }
    try {
      const res = await fetch(`/api/v1/consultations/${consultationId}/transcript`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const set = new Set();
        data.data.forEach((seg) => {
          if (seg.sequence_number != null) set.add(seg.sequence_number);
        });
        seenSequencesRef.current = set;
        setSegments(data.data);
      }
    } catch (err) {
      console.error('[WS Hook] Error reloading transcript:', err);
    }
  }, [consultationId]);

  const sendEvent = useCallback((event, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, payload }));
    }
  }, []);

  const sendTranscriptFinal = useCallback((text, speaker = 'doctor') => {
    sendEvent('transcript_final', { text, speaker });
  }, [sendEvent]);

  const sendTranscriptPartial = useCallback((text, speaker = 'doctor') => {
    sendEvent('transcript_partial', { text, speaker });
  }, [sendEvent]);

  const sendPause = useCallback(() => sendEvent('pause'), [sendEvent]);
  const sendResume = useCallback(() => sendEvent('resume'), [sendEvent]);
  const sendStop = useCallback((audioDurationSeconds) => sendEvent('stop', { audioDurationSeconds }), [sendEvent]);

  return {
    connectionStatus,
    segments,
    setSegments,
    reloadTranscript,
    partialSegment,
    extractionProgress,
    sendTranscriptFinal,
    sendTranscriptPartial,
    sendPause,
    sendResume,
    sendStop,
  };
}

