const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { authorize } = require('../../middleware/authorize');

router.get('/', (req, res, next) => settingsController.getSettings(req, res, next));
router.patch('/', authorize(['clinic_admin', 'super_admin']), (req, res, next) => settingsController.updateSettings(req, res, next));

module.exports = router;

