const express = require('express');
const router = express.Router();
const auditViewerController = require('./audit.viewer.controller');
const { authorize } = require('../../middleware/authorize');

// Scoped access: hospital/clinic admins and super_admin have full practice access;
// doctors are permitted to inspect/verify events scoped to their own actions & consultations
router.get('/', authorize(['doctor', 'clinic_admin', 'super_admin']), (req, res, next) => auditViewerController.getEvents(req, res, next));
router.get('/export', authorize(['clinic_admin', 'super_admin']), (req, res, next) => auditViewerController.exportCsv(req, res, next));
router.get('/verify-chain/:consultationId', authorize(['doctor', 'clinic_admin', 'super_admin']), (req, res, next) => auditViewerController.verifyChain(req, res, next));
router.get('/ledger/:consultationId', authorize(['doctor', 'clinic_admin', 'super_admin']), (req, res, next) => auditViewerController.getLedger(req, res, next));

module.exports = router;

