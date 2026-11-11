const express = require('express');
const router = express.Router();
const controller = require('./owner.auth.controller');

router.post('/signup', (req, res, next) => controller.signup(req, res, next));
router.post('/send-otp', (req, res, next) => controller.sendOtp(req, res, next));
router.post('/verify-otp', (req, res, next) => controller.verifyOtp(req, res, next));
router.post('/logout', (req, res) => controller.logout(req, res));

module.exports = router;
