const authService = require('./auth.service');
const config = require('../../config');

class AuthController {
  setAuthCookies(res, { accessToken, refreshToken }) {
    const isProd = config.nodeEnv === 'production';

    // Access Token Cookie (15 min)
    res.cookie('petcare_at', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    // Refresh Token Cookie (14 days)
    if (refreshToken) {
      res.cookie('petcare_rt', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: config.auth.refreshTokenDays * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });
    }
  }

  clearAuthCookies(res) {
    res.clearCookie('petcare_at', { path: '/' });
    res.clearCookie('petcare_rt', { path: '/api/v1/auth' });
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
        clinicName,
        clinicSlug,
        adminName,
        email,
        password,
        phone,
      });

      this.setAuthCookies(res, result.tokens);

      res.status(201).json({
        success: true,
        message: 'Clinic and administrator registered successfully.',
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required.',
        });
      }

      const deviceInfo = req.headers['user-agent'] || 'Unknown';
      const ip = req.ip || req.connection.remoteAddress;

      const result = await authService.login({
        email,
        password,
        deviceInfo,
        ip,
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

      this.setAuthCookies(res, result.tokens);

      res.json({
        success: true,
        mfaRequired: false,
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyMfa(req, res, next) {
    try {
      const { tempToken, totpCode } = req.body;

      if (!tempToken || !totpCode) {
        return res.status(400).json({
          success: false,
          error: 'tempToken and totpCode are required.',
        });
      }

      const deviceInfo = req.headers['user-agent'] || 'Unknown';
      const ip = req.ip || req.connection.remoteAddress;

      const result = await authService.verifyMfa({
        tempToken,
        totpCode,
        deviceInfo,
        ip,
      });

      this.setAuthCookies(res, result.tokens);

      res.json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      const rawRefreshToken = req.cookies?.petcare_rt || req.body?.refreshToken;

      if (!rawRefreshToken) {
        return res.status(401).json({
          success: false,
          error: 'No refresh token provided.',
        });
      }

      const deviceInfo = req.headers['user-agent'] || 'Unknown';
      const ip = req.ip || req.connection.remoteAddress;

      const result = await authService.rotateRefreshToken(rawRefreshToken, { deviceInfo, ip });

      this.setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      res.json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      this.clearAuthCookies(res);
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
        data: {
          user: req.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();

