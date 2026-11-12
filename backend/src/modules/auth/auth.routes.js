const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/authenticate');
const {
  authLoginLimiter,
  authRegisterLimiter,
  authVerificationLimiter,
  authResetLimiter,
  authRefreshLimiter,
} = require('../../middleware/rateLimiters');

// Legacy Clinic Signup (backward compat)
router.post('/register-clinic', authRegisterLimiter, (req, res, next) => authController.registerClinic(req, res, next));

// Independent Self-Registration Endpoints
router.post('/register/hospital', authRegisterLimiter, (req, res, next) => authController.registerHospital(req, res, next));
router.post('/register/doctor', authRegisterLimiter, (req, res, next) => authController.registerDoctor(req, res, next));
router.post('/register/pet-owner', authRegisterLimiter, (req, res, next) => authController.registerPetOwner(req, res, next));

// Verification & Password Recovery
router.post('/verify-email', authVerificationLimiter, (req, res, next) => authController.verifyEmail(req, res, next));
router.post('/verify-mobile', authVerificationLimiter, (req, res, next) => authController.verifyMobile(req, res, next));
router.post('/resend-verification', authVerificationLimiter, (req, res, next) => authController.resendVerification(req, res, next));
router.post('/forgot-password', authResetLimiter, (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/reset-password', authResetLimiter, (req, res, next) => authController.resetPassword(req, res, next));

// Session Auth
router.post('/login', authLoginLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/mfa/verify', authLoginLimiter, (req, res, next) => authController.verifyMfa(req, res, next));
router.post('/refresh', authRefreshLimiter, (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

// Authenticated Session & Workspace Controls
router.post('/logout-all', authenticate, (req, res, next) => authController.logoutAll(req, res, next));
router.post('/switch-practice', authenticate, (req, res, next) => authController.switchPractice(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

module.exports = router;
