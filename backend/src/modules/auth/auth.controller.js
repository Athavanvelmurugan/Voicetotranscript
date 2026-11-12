const { z } = require('zod');
const authService = require('./auth.service');
const config = require('../../config');

const hospitalRegisterSchema = z.object({
  hospitalName: z.string().trim().min(2, 'Hospital name is required.'),
  hospitalEmail: z.string().trim().email('Valid hospital email is required.'),
  contactNumber: z.string().trim().min(6, 'Contact number is required.'),
  address: z.string().trim().min(3, 'Complete address is required.'),
  city: z.string().trim().min(2, 'City is required.'),
  state: z.string().trim().min(2, 'State is required.'),
  pinCode: z.string().trim().min(3, 'PIN/ZIP code is required.'),
  registrationNumber: z.string().trim().min(2, 'Hospital registration/license number is required.'),
  adminName: z.string().trim().min(2, 'Administrator name is required.'),
  password: z.string().min(10, 'Password must be at least 10 characters long.'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Password and confirm password do not match.',
  path: ['confirmPassword'],
});

const doctorRegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  email: z.string().trim().email('Valid email is required.'),
  mobileNumber: z.string().trim().min(6, 'Mobile number is required.'),
  password: z.string().min(10, 'Password must be at least 10 characters long.'),
  confirmPassword: z.string(),
  qualification: z.string().trim().min(2, 'Veterinary qualification is required.'),
  registrationNumber: z.string().trim().min(2, 'Professional registration number is required.'),
  specialization: z.string().trim().min(2, 'Specialization is required.'),
  yearsOfExperience: z.coerce.number().int().min(0).max(80).default(0),
  photoKey: z.string().trim().nullable().optional(),
  practiceMode: z.enum(['INDEPENDENT', 'HOSPITAL_AFFILIATED']),
  practiceName: z.string().trim().nullable().optional(),
  hospitalPracticeId: z.coerce.number().int().positive().nullable().optional(),
  joinMessage: z.string().trim().nullable().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Password and confirm password do not match.',
  path: ['confirmPassword'],
});

const petOwnerRegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  email: z.string().trim().email('Valid email is required.'),
  mobileNumber: z.string().trim().min(6, 'Mobile number is required.'),
  password: z.string().min(10, 'Password must be at least 10 characters long.'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Password and confirm password do not match.',
  path: ['confirmPassword'],
});

class AuthController {
  setAuthCookies(res, { accessToken, refreshToken, activePracticeId }) {
    const isProd = config.nodeEnv === 'production';

    res.cookie('petcare_at', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    if (refreshToken) {
      res.cookie('petcare_rt', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: config.auth.refreshTokenDays * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });
    }

    if (activePracticeId !== undefined && activePracticeId !== null) {
      res.cookie('petcare_practice_id', String(activePracticeId), {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: config.auth.refreshTokenDays * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }
  }

  clearAuthCookies(res) {
    res.clearCookie('petcare_at', { path: '/' });
    res.clearCookie('petcare_rt', { path: '/api/v1/auth' });
    res.clearCookie('petcare_practice_id', { path: '/' });
    res.clearCookie('petcare_owner_token', { path: '/' });
  }

  _parseSchema(schema, body, res) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || 'Invalid registration payload.';
      res.status(400).json({ success: false, error: firstErr, issues: parsed.error.issues });
      return null;
    }
    return parsed.data;
  }

  async registerClinic(req, res, next) {
    try {
      const { clinicName, clinicSlug, adminName, email, password, phone } = req.body;
      if (!clinicName || !clinicSlug || !adminName || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'clinicName, clinicSlug, adminName, email, and password are required fields.',
        });
      }
      if (password.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 10 characters long.',
        });
      }

      const result = await authService.registerClinic({
        clinicName, clinicSlug, adminName, email, password, phone,
      });

      this.setAuthCookies(res, {
        ...result.tokens,
        activePracticeId: result.user.practiceId,
      });

      res.status(201).json({
        success: true,
        message: 'Clinic and administrator registered successfully.',
        data: { user: result.user },
      });
    } catch (err) {
      next(err);
    }
  }

  async registerHospital(req, res, next) {
    try {
      const data = this._parseSchema(hospitalRegisterSchema, req.body, res);
      if (!data) return;

      const result = await authService.registerHospital({
        ...data,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Hospital registered. Please verify your email or mobile number; Super Admin approval is required before activation.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async registerDoctor(req, res, next) {
    try {
      const data = this._parseSchema(doctorRegisterSchema, req.body, res);
      if (!data) return;

      const result = await authService.registerDoctor({
        ...data,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Doctor account registered. Please complete email or mobile verification.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async registerPetOwner(req, res, next) {
    try {
      const data = this._parseSchema(petOwnerRegisterSchema, req.body, res);
      if (!data) return;

      const result = await authService.registerPetOwner({
        ...data,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Pet owner account registered. Please verify your email or mobile number.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { email, identifier, code } = req.body;
      const target = identifier || email;
      const result = await authService.verifyContact({
        channel: 'email',
        identifier: target,
        code,
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      this.setAuthCookies(res, {
        ...result.tokens,
        activePracticeId: result.user.practiceId,
      });

      res.json({
        success: true,
        message: result.accountStatus === 'PENDING_APPROVAL'
          ? 'Email verified. Hospital application submitted for Super Admin review.'
          : 'Email verified successfully.',
        data: {
          verified: result.verified,
          accountStatus: result.accountStatus,
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyMobile(req, res, next) {
    try {
      const { mobileNumber, phone, identifier, code } = req.body;
      const target = identifier || mobileNumber || phone;
      const result = await authService.verifyContact({
        channel: 'mobile',
        identifier: target,
        code,
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      this.setAuthCookies(res, {
        ...result.tokens,
        activePracticeId: result.user.practiceId,
      });

      res.json({
        success: true,
        message: result.accountStatus === 'PENDING_APPROVAL'
          ? 'Mobile verified. Hospital application submitted for Super Admin review.'
          : 'Mobile verified successfully.',
        data: {
          verified: result.verified,
          accountStatus: result.accountStatus,
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async resendVerification(req, res, next) {
    try {
      const { channel = 'email', identifier, email, mobileNumber } = req.body;
      const target = identifier || email || mobileNumber;
      if (!target) {
        return res.status(400).json({ success: false, error: 'Email or mobile number is required.' });
      }
      const data = await authService.resendVerification({ channel, identifier: target });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }

      const result = await authService.login({
        email,
        password,
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      if (result.mfaRequired) {
        return res.status(202).json({
          success: true,
          mfaRequired: true,
          tempToken: result.tempToken,
          user: result.user,
          message: 'MFA required. Enter staging code: 123456',
        });
      }

      this.setAuthCookies(res, {
        ...result.tokens,
        activePracticeId: result.user.practiceId,
      });

      res.json({
        success: true,
        mfaRequired: false,
        data: { user: result.user },
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyMfa(req, res, next) {
    try {
      const { tempToken, totpCode } = req.body;
      if (!tempToken || !totpCode) {
        return res.status(400).json({ success: false, error: 'tempToken and totpCode are required.' });
      }

      const result = await authService.verifyMfa({
        tempToken,
        totpCode,
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.connection?.remoteAddress,
      });

      this.setAuthCookies(res, {
        ...result.tokens,
        activePracticeId: result.user.practiceId,
      });

      res.json({ success: true, data: { user: result.user } });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      const rawRefreshToken = req.cookies?.petcare_rt || req.body?.refreshToken;
      if (!rawRefreshToken) {
        return res.status(401).json({ success: false, error: 'No refresh token provided.' });
      }

      const result = await authService.rotateRefreshToken(rawRefreshToken, {
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.connection?.remoteAddress,
      });

      this.setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        activePracticeId: result.user.practiceId,
      });

      res.json({ success: true, data: { user: result.user } });
    } catch (err) {
      this.clearAuthCookies(res);
      next(err);
    }
  }

  async switchPractice(req, res, next) {
    try {
      const practiceId = parseInt(req.body?.practiceId, 10);
      if (!practiceId) {
        return res.status(400).json({ success: false, error: 'practiceId is required.' });
      }

      const result = await authService.switchPractice(req.user.id, practiceId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      this.setAuthCookies(res, {
        accessToken: result.accessToken,
        activePracticeId: result.user.practiceId,
      });

      res.json({ success: true, data: { user: result.user } });
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required.' });
      }
      const data = await authService.forgotPassword({
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({
        success: true,
        message: 'If an account matches this email, password reset instructions have been dispatched.',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword, confirmPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: 'Reset token and newPassword are required.' });
      }
      if (newPassword.length < 10) {
        return res.status(400).json({ success: false, error: 'Password must be at least 10 characters long.' });
      }
      if (confirmPassword !== undefined && newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'Passwords do not match.' });
      }

      await authService.resetPassword({
        token,
        newPassword,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({ success: true, message: 'Password updated successfully. Please log in.' });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      const rawRefreshToken = req.cookies?.petcare_rt || req.body?.refreshToken;
      await authService.logout(rawRefreshToken);
      this.clearAuthCookies(res);
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async logoutAll(req, res, next) {
    try {
      if (req.user?.id) {
        await authService.logoutAll(req.user.id);
      }
      this.clearAuthCookies(res);
      res.json({ success: true, message: 'All active sessions revoked.' });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      res.json({
        success: true,
        data: { user: req.user },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
