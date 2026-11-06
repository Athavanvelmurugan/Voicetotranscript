class WsSessionManager {
  constructor() {
    // Map of consultationId -> Session Object
    this.sessions = new Map();
  }

  createSession(consultationId, socket, doctorId) {
    const session = {
      consultationId,
      doctorId,
      sockets: new Set([socket]),
      sequenceNumber: 0,
      isPaused: false,
      startedAt: Date.now(),
      segments: [],
    };
    this.sessions.set(consultationId, session);
    return session;
  }

  getSession(consultationId) {
    return this.sessions.get(consultationId);
  }

  addSocketToSession(consultationId, socket) {
    const session = this.sessions.get(consultationId);
    if (session) {
      session.sockets.add(socket);
      return session;
    }
    return null;
  }

  removeSocket(socket) {
    for (const [consultationId, session] of this.sessions.entries()) {
      if (session.sockets.has(socket)) {
        session.sockets.delete(socket);
        if (session.sockets.size === 0) {
          // retain session state in memory for reconnection, clean up later
        }
      }
    }
  }

  nextSequence(consultationId) {
    const session = this.sessions.get(consultationId);
    if (!session) return 1;
    session.sequenceNumber += 1;
    return session.sequenceNumber;
  }

  broadcast(consultationId, message) {
    const session = this.sessions.get(consultationId);
    if (!session) return;
    const payload = JSON.stringify(message);
    for (const socket of session.sockets) {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(payload);
      }
    }
  }

  endSession(consultationId) {
    this.sessions.delete(consultationId);
  }
}

module.exports = new WsSessionManager();

