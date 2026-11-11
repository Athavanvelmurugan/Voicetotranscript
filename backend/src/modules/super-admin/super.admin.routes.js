const express = require('express');
const router = express.Router();
const controller = require('./super.admin.controller');

router.get('/trends', (req, res, next) => controller.getTrends(req, res, next));
router.get('/clinics', (req, res, next) => controller.getClinics(req, res, next));
router.post('/clinics', (req, res, next) => controller.createClinic(req, res, next));
router.get('/clinics/:id/doctors', (req, res, next) => controller.getClinicDoctors(req, res, next));
router.get('/clinics/:id/patients', (req, res, next) => controller.getClinicPatients(req, res, next));
router.patch('/clinics/:id/status', (req, res, next) => controller.updateClinicStatus(req, res, next));
router.get('/audit-logs', (req, res, next) => controller.getAuditLogs(req, res, next));
router.get('/patients', (req, res, next) => controller.getGlobalPatients(req, res, next));

module.exports = router;

