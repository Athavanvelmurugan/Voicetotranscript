const express = require('express');
const router = express.Router();
const schedulingController = require('./scheduling.controller');
const { authorize } = require('../../middleware/authorize');

router.get('/', (req, res, next) => schedulingController.getAppointments(req, res, next));
router.get('/today-queue', (req, res, next) => schedulingController.getTodayQueue(req, res, next));
router.get('/slots', (req, res, next) => schedulingController.getSlots(req, res, next));
router.get('/availability/:doctorId', (req, res, next) => schedulingController.getDoctorAvailability(req, res, next));
router.put('/availability/:doctorId', authorize(['clinic_admin', 'super_admin', 'doctor']), (req, res, next) => schedulingController.setDoctorAvailability(req, res, next));
router.get('/:id', (req, res, next) => schedulingController.getById(req, res, next));
router.post('/', (req, res, next) => schedulingController.create(req, res, next));
router.patch('/:id', (req, res, next) => schedulingController.update(req, res, next));

module.exports = router;

