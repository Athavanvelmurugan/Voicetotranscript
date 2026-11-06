const { WebSocketServer } = require('ws');
const sessionManager = require('./ws.session.manager');
const transcriptAccumulator = require('../transcription/transcript.accumulator');
const consultationService = require('../consultations/consultation.service');
const documentService = require('../documents/document.service');
const clinicalExtractor = require('../clinical-ai/clinical.extractor');

function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/v1\/consultations\/(\d+)$/);

    if (!match) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const consultationId = parseInt(match[1], 10);

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, consultationId);
    });
  });

  wss.on('connection', async (ws, request, consultationId) => {
    console.log(`[WS] Connection established for consultation #${consultationId}`);
    const doctorId = 1; // default or from auth header

    let session = sessionManager.getSession(consultationId);
    if (!session) {
      session = sessionManager.createSession(consultationId, ws, doctorId);
    } else {
      sessionManager.addSocketToSession(consultationId, ws);
    }

    // Send connection acknowledgement
    ws.send(JSON.stringify({
      event: 'connected',
      consultationId,
      sequenceNumber: session.sequenceNumber,
      isPaused: session.isPaused,
    }));

    ws.on('message', async (data) => {
      try {
        let msg;
        if (typeof data === 'string') {
          msg = JSON.parse(data);
        } else {
          try {
            msg = JSON.parse(data.toString());
          } catch {
            // Raw binary audio chunk received
            msg = { event: 'audio_chunk', binary: true };
          }
        }

        const { event, payload } = msg;

        switch (event) {
          case 'auth': {
            ws.send(JSON.stringify({ event: 'auth_ok', consultationId }));
            break;
          }

          case 'transcript_partial': {
            if (session.isPaused) return;
            const seq = payload?.sequence || session.sequenceNumber + 1;
            // Broadcast partial segment without saving to permanent DB
            sessionManager.broadcast(consultationId, {
              event: 'transcript_partial',
              text: payload.text,
              speaker: payload.speaker || 'unknown',
              sequence: seq,
            });
            break;
          }

          case 'transcript_final': {
            if (session.isPaused) return;
            const seq = sessionManager.nextSequence(consultationId);
            const saved = await transcriptAccumulator.addSegment({
              consultationId,
              sequenceNumber: seq,
              text: payload.text,
              isPartial: false,
              speakerRole: payload.speaker || 'unknown',
              languageDetected: payload.language || 'en',
              confidence: payload.confidence || 0.98,
              startMs: payload.startMs || 0,
              endMs: payload.endMs || 0,
            });

            sessionManager.broadcast(consultationId, {
              event: 'transcript_final',
              segment: saved,
            });
            break;
          }

          case 'pause': {
            session.isPaused = true;
            await consultationService.pauseRecording(consultationId, doctorId).catch(() => {});
            sessionManager.broadcast(consultationId, { event: 'status_change', status: 'paused' });
            break;
          }

          case 'resume': {
            session.isPaused = false;
            await consultationService.resumeRecording(consultationId, doctorId).catch(() => {});
            sessionManager.broadcast(consultationId, { event: 'status_change', status: 'recording' });
            break;
          }

          case 'stop': {
            sessionManager.broadcast(consultationId, { event: 'status_change', status: 'processing' });
            const stopped = await consultationService.stopRecording(consultationId, doctorId, {
              audioDurationSeconds: payload?.audioDurationSeconds || 0,
            }).catch(() => null);

            // Automatically trigger clinical AI extraction & doc generation
            try {
              sessionManager.broadcast(consultationId, {
                event: 'extraction_progress',
                stage: 'extracting_clinical_context',
                percent: 30,
              });

              const consultation = await consultationService.getConsultation(consultationId);
              const { fullText } = await transcriptAccumulator.getCompleteTranscript(consultationId);

              const extraction = await clinicalExtractor.extractAndValidate(consultation, fullText);

              sessionManager.broadcast(consultationId, {
                event: 'extraction_progress',
                stage: 'generating_five_documents',
                percent: 70,
              });

              const docs = await documentService.generateAllDocuments(consultationId, extraction, doctorId);

              // Persist completion state in database & audit log
              await consultationService.completeConsultation(consultationId, doctorId).catch((e) => {
                console.warn('[WS] completeConsultation warning:', e.message);
              });

              sessionManager.broadcast(consultationId, {
                event: 'extraction_progress',
                stage: 'completed',
                percent: 100,
              });

              sessionManager.broadcast(consultationId, {
                event: 'documents_ready',
                consultationId,
                documents: docs,
              });

              sessionManager.broadcast(consultationId, { event: 'status_change', status: 'completed' });
            } catch (err) {
              console.error('[WS] Error during auto document generation on stop:', err);
              sessionManager.broadcast(consultationId, {
                event: 'error',
                code: 'DOCUMENT_GENERATION_FAILED',
                message: err.message,
              });
            }
            break;
          }

          case 'reconnect': {
            const clientLastSeq = payload?.lastSequence || 0;
            const segments = await consultationService.getTranscript(consultationId);
            ws.send(JSON.stringify({
              event: 'reconnect_ok',
              consultationId,
              latestSequence: session.sequenceNumber,
              missedSegments: segments.filter(s => s.sequence_number > clientLastSeq),
            }));
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[WS] Message processing error:', err.message);
        ws.send(JSON.stringify({ event: 'error', message: err.message }));
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Connection closed for consultation #${consultationId}`);
      sessionManager.removeSocket(ws);
    });
  });

  return wss;
}

module.exports = { setupWebSocketServer };

