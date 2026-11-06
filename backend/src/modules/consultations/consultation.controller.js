const consultationService = require('./consultation.service');
const auditService = require('../audit/audit.service');

class ConsultationController {
  // Helper to extract doctor ID from auth/header (defaults to primary vet #1)
  getDoctorId(req) {
    return parseInt(req.headers['x-doctor-id'], 10) || req.user?.id || 1;
  }

  async getAll(req, res, next) {
    try {
      const consultations = await consultationService.getAllConsultations();
      res.json({ success: true, data: consultations });
    } catch (err) {
      next(err);
    }
  }

  async getPets(req, res, next) {
    try {
      const pets = await consultationService.getAllPets();
      res.json({ success: true, data: pets });
    } catch (err) {
      next(err);
    }
  }

  async reset(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.resetConsultation(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const doctorId = this.getDoctorId(req);
      const { appointmentId, petId, language, consentGiven } = req.body;

      if (!petId) {
        return res.status(400).json({ success: false, error: 'petId is required' });
      }

      const consultation = await consultationService.createConsultation({
        appointmentId: appointmentId ? parseInt(appointmentId, 10) : null,
        petId: parseInt(petId, 10),
        language: language || 'en',
        consentGiven: !!consentGiven,
      }, doctorId);

      res.status(201).json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const consultation = await consultationService.getConsultation(id);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async consent(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const { givenBy } = req.body;

      if (!givenBy) {
        return res.status(400).json({ success: false, error: 'givenBy (name of pet owner) is required for consent' });
      }

      const result = await consultationService.recordConsent(id, {
        givenBy,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }, doctorId);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async start(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.startRecording(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async pause(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.pauseRecording(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async resume(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.resumeRecording(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async stop(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const { audioDurationSeconds } = req.body || {};
      const consultation = await consultationService.stopRecording(id, doctorId, { audioDurationSeconds });
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async complete(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.completeConsultation(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async getTranscript(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const includePartial = req.query.includePartial === 'true';
      const transcript = await consultationService.getTranscript(id, includePartial);
      res.json({ success: true, data: transcript });
    } catch (err) {
      next(err);
    }
  }

  async getAudit(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const auditTrail = await auditService.getAuditTrail(id);
      res.json({ success: true, data: auditTrail });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConsultationController();

