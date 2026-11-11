const express = require('express');
const router = express.Router();
const staffController = require('./staff.controller');
const { authorize } = require('../../middleware/authorize');

// Only clinic_admin and super_admin can manage staff
router.use(authorize(['clinic_admin', 'super_admin']));

router.get('/', (req, res, next) => staffController.getStaff(req, res, next));
router.get('/:id/patients', (req, res, next) => staffController.getDoctorPatients(req, res, next));
router.post('/onboard', (req, res, next) => staffController.onboardDoctor(req, res, next));
router.patch('/:id/role', (req, res, next) => staffController.updateRole(req, res, next));
router.post('/:id/deactivate', (req, res, next) => staffController.deactivate(req, res, next));
router.post('/:id/reactivate', (req, res, next) => staffController.reactivate(req, res, next));
router.patch('/:id/approve-license', (req, res, next) => staffController.approveLicense(req, res, next));
router.post('/:id/approve-license', (req, res, next) => staffController.approveLicense(req, res, next));

module.exports = router;
