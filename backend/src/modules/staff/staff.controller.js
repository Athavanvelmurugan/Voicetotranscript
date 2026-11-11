const staffService = require('./staff.service');
const { parsePagination, buildPaginatedResponse } = require('../../utils/pagination');

class StaffController {
  async getStaff(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query);
      const role = req.query.role || '';
      const { staff, totalCount } = await staffService.getStaff(req.user.clinicId, {
        page, limit, offset, search, role
      });
      res.json(buildPaginatedResponse(staff, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async getDoctorPatients(req, res, next) {
    try {
      const doctorId = parseInt(req.params.id, 10);
      const { page, limit, offset, search } = parsePagination(req.query);
      const { patients, totalCount } = await staffService.getDoctorPatients(req.user.clinicId, doctorId, {
        page, limit, offset, search
      });
      res.json(buildPaginatedResponse(patients, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async updateRole(req, res, next) {
    try {
      const staffId = parseInt(req.params.id, 10);
      const { role } = req.body;

      if (!['doctor', 'staff', 'clinic_admin'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Role must be doctor, staff, or clinic_admin.' });
      }

      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await staffService.updateRole(req.user.clinicId, staffId, role, req.user.id, reqInfo);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async deactivate(req, res, next) {
    try {
      const staffId = parseInt(req.params.id, 10);
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await staffService.deactivateStaff(req.user.clinicId, staffId, req.user.id, reqInfo);
      res.json({ success: true, message: 'Staff member deactivated and sessions revoked.', data: updated });
    } catch (err) {
      next(err);
    }
  }

  async reactivate(req, res, next) {
    try {
      const staffId = parseInt(req.params.id, 10);
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await staffService.reactivateStaff(req.user.clinicId, staffId, req.user.id, reqInfo);
      res.json({ success: true, message: 'Staff member reactivated.', data: updated });
    } catch (err) {
      next(err);
    }
  }

  async approveLicense(req, res, next) {
    try {
      const staffId = parseInt(req.params.id, 10);
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await staffService.approveLicense(req.user.clinicId, staffId, req.user.id, reqInfo);
      res.json({ success: true, message: 'Doctor license approved and account activated.', data: updated });
    } catch (err) {
      next(err);
    }
  }

  async onboardDoctor(req, res, next) {
    try {
      const { name, email, password, phone, licenseNumber, specialty, autoVerifyLicense } = req.body;
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const doctor = await staffService.onboardDoctor(
        req.user.clinicId,
        { name, email, password, phone, licenseNumber, specialty, autoVerifyLicense },
        req.user.id,
        reqInfo
      );
      res.status(201).json({
        success: true,
        message: `Dr. ${doctor.name.replace(/^Dr\.?\s*/i, '')} has been successfully onboarded!`,
        data: doctor,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();

