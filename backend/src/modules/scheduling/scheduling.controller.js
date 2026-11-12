const schedulingService = require('./scheduling.service');
const { parsePagination, buildPaginatedResponse } = require('../../utils/pagination');

class SchedulingController {
  async getAppointments(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query);
      const { doctorId, startDate, endDate, status } = req.query;
      const { appointments, totalCount } = await schedulingService.getAppointments(req.user.clinicId, {
        page,
        limit,
        offset,
        search,
        doctorId: doctorId ? parseInt(doctorId, 10) : null,
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || null,
      });
      res.json(buildPaginatedResponse(appointments, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async getTodayQueue(req, res, next) {
    try {
      // If doctor role, default to their own queue unless query overrides and user is admin
      let doctorId = req.user.role === 'doctor' ? req.user.id : null;
      if (req.query.doctorId) {
        doctorId = parseInt(req.query.doctorId, 10);
      }

      const queue = await schedulingService.getTodayQueue(req.user.clinicId, doctorId);
      res.json({ success: true, data: queue });
    } catch (err) {
      next(err);
    }
  }

  async getSlots(req, res, next) {
    try {
      const { doctorId, date } = req.query;
      if (!doctorId || !date) {
        return res.status(400).json({ success: false, error: 'doctorId and date (YYYY-MM-DD) are required.' });
      }

      const slots = await schedulingService.getAvailableSlots(
        req.user.clinicId,
        parseInt(doctorId, 10),
        date
      );
      res.json({ success: true, data: slots });
    } catch (err) {
      next(err);
    }
  }

  async getDoctorAvailability(req, res, next) {
    try {
      const doctorId = parseInt(req.params.doctorId, 10);
      const blocks = await schedulingService.getDoctorAvailability(req.user.clinicId, doctorId);
      res.json({ success: true, data: blocks });
    } catch (err) {
      next(err);
    }
  }

  async setDoctorAvailability(req, res, next) {
    try {
      const doctorId = parseInt(req.params.doctorId, 10);
      const { blocks } = req.body;
      if (!Array.isArray(blocks)) {
        return res.status(400).json({ success: false, error: 'blocks array is required.' });
      }

      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const saved = await schedulingService.setDoctorAvailability(
        req.user.clinicId,
        doctorId,
        blocks,
        req.user.id,
        reqInfo
      );
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Valid appointment ID is required.' });
      }
      const apt = await schedulingService.getAppointmentById(req.user.clinicId, id);
      res.json({ success: true, data: apt });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { pet_id, doctor_id, scheduled_at, duration_min, type, reason, source } = req.body;
      if (!pet_id || !scheduled_at) {
        return res.status(400).json({ success: false, error: 'pet_id and scheduled_at are required.' });
      }

      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const apt = await schedulingService.createAppointment(
        req.user.clinicId,
        {
          pet_id: parseInt(pet_id, 10),
          doctor_id: doctor_id ? parseInt(doctor_id, 10) : req.user.id,
          scheduled_at,
          duration_min: duration_min ? parseInt(duration_min, 10) : 15,
          type: type || 'general_checkup',
          reason: reason || '',
          source: source || 'desk',
        },
        req.user.id,
        reqInfo
      );
      res.status(201).json({ success: true, data: apt });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Valid appointment ID is required.' });
      }
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await schedulingService.updateAppointment(
        req.user.clinicId,
        id,
        req.body,
        req.user.id,
        reqInfo
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SchedulingController();

