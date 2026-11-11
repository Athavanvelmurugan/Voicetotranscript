const invitationService = require('./invitation.service');
const authController = require('../auth/auth.controller');

class InvitationController {
  async create(req, res, next) {
    try {
      const { email, role = 'doctor' } = req.body;
      const clinicId = req.user.clinicId;
      const invitedBy = req.user.id;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required to invite staff.' });
      }

      if (!['doctor', 'staff', 'clinic_admin'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Role must be doctor, staff, or clinic_admin.' });
      }

      const result = await invitationService.createInvitation({
        clinicId,
        email,
        role,
        invitedBy,
      });

      res.status(201).json({
        success: true,
        message: 'Invitation generated successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async verify(req, res, next) {
    try {
      const token = req.query.token || req.params.token;
      const invite = await invitationService.verifyInvitation(token);
      res.json({
        success: true,
        data: invite,
      });
    } catch (err) {
      next(err);
    }
  }

  async accept(req, res, next) {
    try {
      const { token, name, password, phone, licenseNumber } = req.body;

      if (!token || !name || !password) {
        return res.status(400).json({
          success: false,
          error: 'token, name, and password are required fields.',
        });
      }

      if (password.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 10 characters long.',
        });
      }

      const result = await invitationService.acceptInvitation({
        rawToken: token,
        name,
        password,
        phone,
        licenseNumber,
      });

      authController.setAuthCookies(res, result.tokens);

      res.json({
        success: true,
        message: 'Account created and joined clinic successfully.',
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const list = await invitationService.listClinicInvitations(req.user.clinicId);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InvitationController();

