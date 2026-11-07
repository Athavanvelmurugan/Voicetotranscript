const consultationService = require('./consultation.service');
const auditService = require('../audit/audit.service');

class ConsultationController {
  // Helper to extract doctor ID from auth/header (defaults to primary vet #1)
  getDoctorId(req) {
    return parseInt(req.headers['x-doctor-id'], 10) || req.user?.id || 1;
  }

  // Helper to validate and parse integer consultation ID from URL parameters
  parseId(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) {
      res.status(400).json({ success: false, error: 'A valid integer consultation ID is required' });
      return null;
    }
    return id;
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
      const id = this.parseId(req, res);
      if (!id) return;
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
      const id = this.parseId(req, res);
      if (!id) return;
      const consultation = await consultationService.getConsultation(id);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async updateDoctor(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
      const { doctorId } = req.body;
      if (!doctorId || isNaN(parseInt(doctorId, 10))) {
        return res.status(400).json({ success: false, error: 'A valid integer doctorId is required' });
      }
      const actorId = this.getDoctorId(req);
      const consultation = await consultationService.updateConsultationDoctor(id, parseInt(doctorId, 10), actorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async consent(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
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
      const id = this.parseId(req, res);
      if (!id) return;
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.startRecording(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async pause(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.pauseRecording(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async resume(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.resumeRecording(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async stop(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
      const doctorId = this.getDoctorId(req);
      const { audioDurationSeconds } = req.body || {};
      const consultation = await consultationService.stopRecording(id, doctorId, { audioDurationSeconds });

      // Trigger background dual-pass full audio pass (Bug 4)
      try {
        const dualPassService = require('../transcription/dual-pass.service');
        dualPassService.runFinalPass(id, doctorId).catch((dpErr) => {
          console.warn('[ConsultationController] Dual-pass final pass warning:', dpErr.message);
        });
      } catch (dpInitErr) {
        console.warn('[ConsultationController] Dual-pass init warning:', dpInitErr.message);
      }

      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async complete(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
      const doctorId = this.getDoctorId(req);
      const consultation = await consultationService.completeConsultation(id, doctorId);
      res.json({ success: true, data: consultation });
    } catch (err) {
      next(err);
    }
  }

  async getTranscript(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
      const includePartial = req.query.includePartial === 'true';
      const transcript = await consultationService.getTranscript(id, includePartial);
      res.json({ success: true, data: transcript });
    } catch (err) {
      next(err);
    }
  }

  async getAudit(req, res, next) {
    try {
      const id = this.parseId(req, res);
      if (!id) return;
      const auditTrail = await auditService.getAuditTrail(id);
      res.json({ success: true, data: auditTrail });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConsultationController();

