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

  // Store latest callbacks in a mutable ref to decouple connection lifecycle from parent callback re-creation
  const callbacksRef = useRef({ onDocumentsReady, onStatusChange });
  useEffect(() => {
    callbacksRef.current = { onDocumentsReady, onStatusChange };
  }, [onDocumentsReady, onStatusChange]);

  // Keep activeConsultationIdRef in sync with the current consultationId
  useEffect(() => {
    activeConsultationIdRef.current = consultationId;
  }, [consultationId]);

  // Safe socket closure helper: ensures connecting sockets aren't aborted prematurely
  const safeClose = useCallback((socket) => {
    if (!socket) return;
    socket._isExplicitClose = true;
    if (socket.readyState === WebSocket.CONNECTING) {
      // Mute error handlers so handshake abort does not trigger console errors
      socket.onerror = () => {};
      socket.onopen = () => {
        try {
          socket.close(1000, 'Session changed');
        } catch (_) {}
      };
      // Fallback: close after 150ms if open never fires
      setTimeout(() => {
        try {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close(1000, 'Session cleanup');
          }
        } catch (_) {}
      }, 150);
    } else if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.close(1000, 'Session ended');
      } catch (_) {}
    }
  }, []);

  const connect = useCallback(() => {
    if (!consultationId) return;

    // Guard: If already connecting or open for the same consultation, do not duplicate
    if (
      wsRef.current &&
      wsRef.current._consultationId === consultationId &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Close any previous socket for a different consultation
    if (wsRef.current) {
      safeClose(wsRef.current);
      wsRef.current = null;
    }

    // Use current host to route through Vite proxy (/ws) or production reverse proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/v1/consultations/${consultationId}`;

    setConnectionStatus('connecting');
    const ws = new WebSocket(wsUrl);
    ws._consultationId = consultationId;
    ws._isExplicitClose = false;
    wsRef.current = ws;

    ws.onopen = () => {
      // If active consultation changed while connecting, abort and close
      if (ws._consultationId !== activeConsultationIdRef.current || ws._isExplicitClose) {
        safeClose(ws);
        return;
      }
      setConnectionStatus('connected');
      ws.send(JSON.stringify({ event: 'auth', token: 'doctor-session-token' }));

      // Request synchronization
      const maxSeq = Array.from(seenSequencesRef.current).reduce((max, s) => Math.max(max, s), 0);
      ws.send(JSON.stringify({ event: 'reconnect', payload: { lastSequence: maxSeq } }));
    };

    ws.onmessage = (event) => {
      // Discard any message received from a socket of an inactive consultation or explicit close
      if (ws._consultationId !== activeConsultationIdRef.current || ws._isExplicitClose) {
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
            if (callbacksRef.current.onStatusChange) {
              callbacksRef.current.onStatusChange(msg.status);
            }
            break;

          case 'extraction_progress':
            setExtractionProgress(msg);
            break;

          case 'documents_ready':
            setExtractionProgress(null);
            if (callbacksRef.current.onDocumentsReady) {
              callbacksRef.current.onDocumentsReady(msg.documents);
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[WS Hook] Message parse error:', err);
      }
    };

    ws.onerror = (err) => {
      // Ignore errors on sockets that are superseded or intentionally closed during teardown
      if (ws._isExplicitClose || ws._consultationId !== activeConsultationIdRef.current) {
        return;
      }
      console.error('[WS Hook] WebSocket error:', err);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      if (ws._consultationId === activeConsultationIdRef.current && !ws._isExplicitClose) {
        setConnectionStatus('disconnected');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (activeConsultationIdRef.current === consultationId) {
            connect();
          }
        }, 3000);
      }
    };
  }, [consultationId, safeClose]);

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
    if (!consultationId) {
      setConnectionStatus('disconnected');
      return;
    }
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        safeClose(wsRef.current);
        wsRef.current = null;
      }
    };
  }, [consultationId, connect, safeClose]);

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

