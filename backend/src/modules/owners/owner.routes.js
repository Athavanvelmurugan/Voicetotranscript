const express = require('express');
const router = express.Router();
const ownerController = require('./owner.controller');
const { authorize } = require('../../middleware/authorize');

router.get('/', (req, res, next) => ownerController.getOwners(req, res, next));
router.get('/:id', (req, res, next) => ownerController.getById(req, res, next));
router.post('/', (req, res, next) => ownerController.create(req, res, next));
router.patch('/:id', (req, res, next) => ownerController.update(req, res, next));
router.post('/merge', authorize(['clinic_admin', 'super_admin']), (req, res, next) => ownerController.merge(req, res, next));

module.exports = router;

