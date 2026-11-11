const express = require('express');
const router = express.Router();
const controller = require('./document.controller');

router.get('/:id', (req, res, next) => controller.getById(req, res, next));
router.patch('/:id', (req, res, next) => controller.update(req, res, next));
router.post('/:id/approve', (req, res, next) => controller.approve(req, res, next));
router.post('/:id/reject', (req, res, next) => controller.reject(req, res, next));
router.get('/:id/versions', (req, res, next) => controller.getVersions(req, res, next));
router.post('/:id/pdf', (req, res, next) => controller.generatePdf(req, res, next));
router.get('/:id/download-pdf', (req, res, next) => controller.downloadPdf(req, res, next));
router.post('/:id/send-to-owner', (req, res, next) => controller.sendToOwner(req, res, next));

module.exports = router;

