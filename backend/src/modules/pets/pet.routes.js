const express = require('express');
const router = express.Router();
const petController = require('./pet.controller');

router.get('/', (req, res, next) => petController.getPets(req, res, next));
router.get('/:id/clinical-chart', (req, res, next) => petController.getClinicalChart(req, res, next));
router.get('/:id', (req, res, next) => petController.getById(req, res, next));
router.post('/', (req, res, next) => petController.create(req, res, next));
router.patch('/:id', (req, res, next) => petController.update(req, res, next));

module.exports = router;

