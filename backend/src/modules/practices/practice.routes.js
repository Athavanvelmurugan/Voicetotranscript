const express = require('express');
const router = express.Router();
const controller = require('./practice.controller');
const { authenticate, optionalAuthenticate } = require('../../middleware/authenticate');

// Public practice discovery (active Hospitals & Independent Doctors)
router.get('/discover', (req, res, next) => controller.discover(req, res, next));

// Authenticated doctor convenience endpoints
router.get('/my-invitations', authenticate, (req, res, next) => controller.myInvitations(req, res, next));
router.post('/invitations/:inviteId/respond', authenticate, (req, res, next) => controller.respondInvitation(req, res, next));
router.get('/my-join-requests', authenticate, (req, res, next) => controller.myJoinRequests(req, res, next));

// Create Independent Practice workspace (authenticated Doctor)
router.post('/', authenticate, (req, res, next) => controller.createIndependent(req, res, next));

// Practice details & membership workflows
router.get('/:id', optionalAuthenticate, (req, res, next) => controller.getById(req, res, next));
router.post('/:id/invitations', authenticate, (req, res, next) => controller.createInvitation(req, res, next));
router.post('/:id/join-requests', authenticate, (req, res, next) => controller.submitJoinRequest(req, res, next));
router.get('/:id/join-requests', authenticate, (req, res, next) => controller.listJoinRequests(req, res, next));
router.patch('/:id/join-requests/:requestId/approve', authenticate, (req, res, next) => controller.approveJoinRequest(req, res, next));
router.patch('/:id/join-requests/:requestId/reject', authenticate, (req, res, next) => controller.rejectJoinRequest(req, res, next));

module.exports = router;

