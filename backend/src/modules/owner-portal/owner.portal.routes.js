const express = require('express');
const router = express.Router();
const controller = require('./owner.portal.controller');
const { ownerAuthenticate } = require('../../middleware/ownerAuthenticate');

// All portal routes require pet guardian authentication
router.use(ownerAuthenticate);

// Guardian Profile & Preferences
router.get('/me', (req, res, next) => controller.getProfile(req, res, next));
router.put('/me', (req, res, next) => controller.updateProfile(req, res, next));
router.put('/preferences', (req, res, next) => controller.updatePreferences(req, res, next));

// Pets
router.get('/pets', (req, res, next) => controller.getPets(req, res, next));
router.post('/pets', (req, res, next) => controller.registerPet(req, res, next));
router.put('/pets/:id', (req, res, next) => controller.updatePet(req, res, next));

// Consultations & Prescriptions
router.get('/consultations', (req, res, next) => controller.getConsultations(req, res, next));
router.get('/prescriptions', (req, res, next) => controller.getPrescriptions(req, res, next));

// Digital Consents
router.get('/consent/pending', (req, res, next) => controller.getPendingConsent(req, res, next));
router.post('/consent/sign', (req, res, next) => controller.signConsent(req, res, next));

// Hospital & Doctor Discovery & Affiliation
router.get('/hospitals', (req, res, next) => controller.getHospitals(req, res, next));
router.get('/hospitals/:clinicId/doctors', (req, res, next) => controller.getHospitalDoctors(req, res, next));
router.post('/affiliation', (req, res, next) => controller.affiliateHospital(req, res, next));
router.delete('/affiliation', (req, res, next) => controller.removeAffiliation(req, res, next));

// Scheduling & Appointments
router.get('/available-slots', (req, res, next) => controller.getAvailableSlots(req, res, next));
router.get('/appointments', (req, res, next) => controller.getAppointments(req, res, next));
router.post('/book-appointment', (req, res, next) => controller.bookAppointment(req, res, next));

module.exports = router;
