const express = require('express');
const router = express.Router();
const controller = require('./directory.controller');

// Doctors routes
router.get('/doctors', (req, res, next) => controller.getDoctors(req, res, next));
router.post('/doctors', (req, res, next) => controller.createDoctor(req, res, next));
router.delete('/doctors/:id', (req, res, next) => controller.deleteDoctor(req, res, next));

// Pets routes
router.get('/pets', (req, res, next) => controller.getPets(req, res, next));
router.post('/pets', (req, res, next) => controller.createPet(req, res, next));
router.delete('/pets/:id', (req, res, next) => controller.deletePet(req, res, next));

// Consultations deletion route
router.delete('/consultations/:id', (req, res, next) => controller.deleteConsultation(req, res, next));

module.exports = router;

