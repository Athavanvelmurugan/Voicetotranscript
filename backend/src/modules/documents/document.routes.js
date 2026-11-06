const express = require('express');
const router = express.Router();
const controller = require('./document.controller');

router.get('/:id', (req, res, next) => controller.getById(req, res, next));
router.patch('/:id', (req, res, next) => controller.update(req, res, next));
router.post('/:id/approve', (req, res, next) => controller.approve(req, res, next));
router.post('/:id/reject', (req, res, next) => controller.reject(req, res, next));
router.get('/:id/versions', (req, res, next) => controller.getVersions(req, res, next));

module.exports = router;

