const express = require('express');
const router = express.Router();
const invitationController = require('./invitation.controller');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');

// Public verification & acceptance
router.get('/verify', (req, res, next) => invitationController.verify(req, res, next));
router.post('/accept', (req, res, next) => invitationController.accept(req, res, next));

// Authenticated Clinic Admin management
router.post('/', authenticate, authorize(['clinic_admin']), (req, res, next) => invitationController.create(req, res, next));
router.get('/', authenticate, authorize(['clinic_admin']), (req, res, next) => invitationController.list(req, res, next));

module.exports = router;

