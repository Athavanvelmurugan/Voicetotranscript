const express = require('express');
const router = express.Router();
const controller = require('./consultation.controller');

// Bind methods to controller instance
router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/meta/pets', (req, res, next) => controller.getPets(req, res, next));
router.post('/', (req, res, next) => controller.create(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next));
router.patch('/:id/doctor', (req, res, next) => controller.updateDoctor(req, res, next));
router.post('/:id/reset', (req, res, next) => controller.reset(req, res, next));
router.post('/:id/consent', (req, res, next) => controller.consent(req, res, next));
router.post('/:id/start', (req, res, next) => controller.start(req, res, next));
router.post('/:id/pause', (req, res, next) => controller.pause(req, res, next));
router.post('/:id/resume', (req, res, next) => controller.resume(req, res, next));
router.post('/:id/stop', (req, res, next) => controller.stop(req, res, next));
router.post('/:id/complete', (req, res, next) => controller.complete(req, res, next));
router.get('/:id/transcript', (req, res, next) => controller.getTranscript(req, res, next));
router.get('/:id/audit', (req, res, next) => controller.getAudit(req, res, next));

module.exports = router;

