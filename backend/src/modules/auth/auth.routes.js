const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/authenticate');

// Public Auth Endpoints
router.post('/register-clinic', (req, res, next) => authController.registerClinic(req, res, next));
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/mfa/verify', (req, res, next) => authController.verifyMfa(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

// Authenticated Endpoints
router.post('/logout-all', authenticate, (req, res, next) => authController.logoutAll(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

module.exports = router;

