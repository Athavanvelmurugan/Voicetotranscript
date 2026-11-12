const express = require('express');
const router = express.Router();
const controller = require('./super.admin.controller');

router.get('/pending', (req, res, next) => controller.getPendingHospitals(req, res, next));
router.patch('/:id/approve', (req, res, next) => controller.approveHospital(req, res, next));
router.patch('/:id/reject', (req, res, next) => controller.rejectHospital(req, res, next));

module.exports = router;

