const ownerPortalService = require('./owner.portal.service');
const { parsePagination, buildPaginatedResponse } = require('../../utils/pagination');

class OwnerPortalController {
  async getProfile(req, res, next) {
    try {
      const data = await ownerPortalService.getProfile(req.owner.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const { emailEnabled } = req.body;
      const data = await ownerPortalService.updatePreferences(req.owner.id, { emailEnabled });
      res.json({ success: true, data, message: 'Notification preferences updated' });
    } catch (err) {
      next(err);
    }
  }

  async getPets(req, res, next) {
    try {
      const data = await ownerPortalService.getPets(req.owner.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async registerPet(req, res, next) {
    try {
      const data = await ownerPortalService.registerPet(req.owner.id, req.body);
      res.status(201).json({ success: true, data, message: 'Pet registered successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getConsultations(req, res, next) {
    try {
      const data = await ownerPortalService.getConsultations(req.owner.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getPrescriptions(req, res, next) {
    try {
      const data = await ownerPortalService.getPrescriptions(req.owner.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getPendingConsent(req, res, next) {
    try {
      const data = await ownerPortalService.getPendingConsent(req.owner.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async signConsent(req, res, next) {
    try {
      const data = await ownerPortalService.signConsent(req.owner.id, req.body);
      res.json({ success: true, data, message: 'Digital consent signed and verified' });
    } catch (err) {
      next(err);
    }
  }

  async getAvailableSlots(req, res, next) {
    try {
      const clinicId = req.query.clinicId ? parseInt(req.query.clinicId, 10) : (req.owner.clinic_id || req.owner.clinicId || 1);
      const doctorId = req.query.doctorId ? parseInt(req.query.doctorId, 10) : null;
      const { date } = req.query;
      const data = await ownerPortalService.getAvailableSlots(clinicId, date, doctorId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getHospitals(req, res, next) {
    try {
      const data = await ownerPortalService.getHospitals();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getHospitalDoctors(req, res, next) {
    try {
      const clinicId = parseInt(req.params.clinicId, 10);
      const data = await ownerPortalService.getHospitalDoctors(clinicId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async bookAppointment(req, res, next) {
    try {
      const clinicId = req.body.clinicId ? parseInt(req.body.clinicId, 10) : (req.owner.clinic_id || req.owner.clinicId || 1);
      const data = await ownerPortalService.bookAppointment(req.owner.id, {
        ...req.body,
        clinicId,
      });
      res.status(201).json({ success: true, data, message: 'Appointment booked successfully' });
    } catch (err) {
      next(err);
    }
  }

  async getAppointments(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query);
      const { status } = req.query;
      const { appointments, totalCount } = await ownerPortalService.getOwnerAppointments(req.owner.id, {
        page,
        limit,
        offset,
        search,
        status: status || '',
      });
      res.json(buildPaginatedResponse(appointments, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async affiliateHospital(req, res, next) {
    try {
      const data = await ownerPortalService.affiliateHospital(req.owner.id, req.body);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async removeAffiliation(req, res, next) {
    try {
      const data = await ownerPortalService.removeAffiliation(req.owner.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const data = await ownerPortalService.updateProfile(req.owner.id, req.body);
      res.json({ success: true, data, message: 'Guardian profile updated' });
    } catch (err) {
      next(err);
    }
  }

  async updatePet(req, res, next) {
    try {
      const petId = parseInt(req.params.id, 10);
      const data = await ownerPortalService.updatePet(req.owner.id, petId, req.body);
      res.json({ success: true, data, message: 'Pet details updated' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OwnerPortalController();
