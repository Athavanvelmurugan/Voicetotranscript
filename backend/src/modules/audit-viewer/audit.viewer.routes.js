const express = require('express');
const router = express.Router();
const auditViewerController = require('./audit.viewer.controller');
const { authorize } = require('../../middleware/authorize');

// Only clinic_admin and super_admin can inspect clinic audit trails and export
router.use(authorize(['clinic_admin', 'super_admin']));

router.get('/', (req, res, next) => auditViewerController.getEvents(req, res, next));
router.get('/export', (req, res, next) => auditViewerController.exportCsv(req, res, next));
router.get('/verify-chain/:consultationId', (req, res, next) => auditViewerController.verifyChain(req, res, next));
router.get('/ledger/:consultationId', (req, res, next) => auditViewerController.getLedger(req, res, next));

module.exports = router;

