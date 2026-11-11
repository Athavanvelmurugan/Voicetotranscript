const express = require('express');
const router = express.Router();
const verifyController = require('./verify.controller');

// Public endpoint — NO authentication required so QR code scanners can verify
router.get('/:ledgerHash', (req, res, next) => verifyController.verifyHash(req, res, next));

module.exports = router;
