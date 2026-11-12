const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const authRoutes = require('./modules/auth/auth.routes');
const invitationRoutes = require('./modules/invitations/invitation.routes');
const consultationRoutes = require('./modules/consultations/consultation.routes');
const directoryRoutes = require('./modules/directory/directory.routes');
const documentRoutes = require('./modules/documents/document.routes');
const documentController = require('./modules/documents/document.controller');
const audioRoutes = require('./modules/audio/audio.routes');
const staffRoutes = require('./modules/staff/staff.routes');
const ownerRoutes = require('./modules/owners/owner.routes');
const petRoutes = require('./modules/pets/pet.routes');
const schedulingRoutes = require('./modules/scheduling/scheduling.routes');
const clinicSettingsRoutes = require('./modules/clinic-settings/settings.routes');
const auditViewerRoutes = require('./modules/audit-viewer/audit.viewer.routes');
const verifyRoutes = require('./modules/verify/verify.routes');
const ownerAuthRoutes = require('./modules/owner-portal/owner.auth.routes');
const ownerPortalRoutes = require('./modules/owner-portal/owner.portal.routes');
const superAdminRoutes = require('./modules/super-admin/super.admin.routes');
const adminHospitalsRoutes = require('./modules/super-admin/admin.hospitals.routes');
const practiceRoutes = require('./modules/practices/practice.routes');
const { authenticate } = require('./middleware/authenticate');
const { authorize } = require('./middleware/authorize');
const { tenantContext } = require('./middleware/tenantContext');
const { setupWebSocketServer } = require('./modules/realtime/ws.server');

const app = express();

// Middleware: CORS with credentials support
app.use(cors({
  origin: (origin, callback) => {
    // Allow local development ports and same-origin/no-origin calls
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    callback(null, origin);
  },
  credentials: true,
}));

app.use(cookieParser(config.auth.cookieSecret));
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

// Phase 1 Auth & Invitation Routes (Public & Self-guarded)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/invitations', invitationRoutes);

// Phase 3 Public Document Verification & Owner Portal Auth
app.use('/api/v1/verify', verifyRoutes);
app.use('/api/v1/owner-auth', ownerAuthRoutes);
app.use('/api/v1/owner-portal', ownerPortalRoutes);

// Super Admin Platform Control Plane & Hospital Approvals
app.use('/api/v1/super-admin', authenticate, tenantContext, authorize(['super_admin']), superAdminRoutes);
app.use('/api/v1/admin/hospitals', authenticate, authorize(['super_admin']), adminHospitalsRoutes);

// Multi-Practice Discovery, Independent Practice Launch, Invitations & Join Requests
app.use('/api/v1/practices', practiceRoutes);

// Protected Core Tenant APIs
app.use('/api/v1/consultations', authenticate, tenantContext, consultationRoutes);
app.use('/api/v1/consultations', authenticate, tenantContext, audioRoutes);   // audio-chunk upload (Whisper)
app.use('/api/v1/directory', authenticate, tenantContext, directoryRoutes);
app.use('/api/v1/documents', authenticate, tenantContext, documentRoutes);

// Phase 2 Hospital Admin, Registry & Scheduling APIs
app.use('/api/v1/staff', authenticate, tenantContext, staffRoutes);
app.use('/api/v1/owners', authenticate, tenantContext, ownerRoutes);
app.use('/api/v1/pets', authenticate, tenantContext, petRoutes);
app.use('/api/v1/scheduling', authenticate, tenantContext, schedulingRoutes);
app.use('/api/v1/clinic-settings', authenticate, tenantContext, clinicSettingsRoutes);
app.use('/api/v1/audit-viewer', authenticate, tenantContext, auditViewerRoutes);

// Nested routes for documents under consultations
app.get('/api/v1/consultations/:consultationId/documents', authenticate, tenantContext, (req, res, next) => {
  documentController.getByConsultation(req, res, next);
});

app.post('/api/v1/consultations/:consultationId/generate', authenticate, tenantContext, (req, res, next) => {
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

// Setup WebSocket server with authenticated handshake
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
