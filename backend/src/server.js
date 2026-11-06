const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const consultationRoutes = require('./modules/consultations/consultation.routes');
const directoryRoutes = require('./modules/directory/directory.routes');
const documentRoutes = require('./modules/documents/document.routes');
const documentController = require('./modules/documents/document.controller');
const audioRoutes = require('./modules/audio/audio.routes');
const { setupWebSocketServer } = require('./modules/realtime/ws.server');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  if (config.nodeEnv !== 'test') {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'vetscribe-backend',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/consultations', audioRoutes);   // audio-chunk upload (Whisper)
app.use('/api/v1/directory', directoryRoutes);
app.use('/api/v1/documents', documentRoutes);

// Nested routes for documents under consultations
app.get('/api/v1/consultations/:consultationId/documents', (req, res, next) => {
  documentController.getByConsultation(req, res, next);
});

app.post('/api/v1/consultations/:consultationId/generate', (req, res, next) => {
  documentController.generate(req, res, next);
});

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[Error] ${statusCode} - ${err.message}`);
  res.status(statusCode).json({
    success: false,
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
  });
});

const server = http.createServer(app);

// Setup WebSocket server
setupWebSocketServer(server);

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🏥 AI Veterinary Scribe Server running on port ${config.port}`);
    console.log(`🌐 HTTP API: http://localhost:${config.port}`);
    console.log(`🔌 WebSocket: ws://localhost:${config.port}/ws/v1/consultations/:id`);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server };

