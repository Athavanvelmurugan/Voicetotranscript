const directoryRepo = require('./directory.repository');

class DirectoryController {
  // ─── DOCTORS ────────────────────────────────────────────────────────────────
  async getDoctors(req, res, next) {
    try {
      const doctors = await directoryRepo.getDoctors();
      res.json({ success: true, data: doctors });
    } catch (err) {
      next(err);
    }
  }

  async createDoctor(req, res, next) {
    try {
      const { name, email, role } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, error: 'Name and Email are required to register a doctor.' });
      }

      const doctor = await directoryRepo.createDoctor({ name, email, role });
      res.status(201).json({ success: true, data: doctor });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, error: 'A user with this email address already exists.' });
      }
      next(err);
    }
  }

  async deleteDoctor(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid doctor ID.' });
      }

      const deleted = await directoryRepo.deleteDoctor(id);
      res.json({ success: true, message: `Doctor #${id} deleted successfully.`, data: deleted });
    } catch (err) {
      next(err);
    }
  }

  // ─── PETS ────────────────────────────────────────────────────────────────────
  async getPets(req, res, next) {
    try {
      const pets = await directoryRepo.getPets();
      res.json({ success: true, data: pets });
    } catch (err) {
      next(err);
    }
  }

  async createPet(req, res, next) {
    try {
      const { name, species, breed, age_years, weight_kg, owner_name, owner_contact } = req.body;
      if (!name || !species) {
        return res.status(400).json({ success: false, error: 'Pet Name and Species are required.' });
      }

      const pet = await directoryRepo.createPet({
        name,
        species,
        breed,
        age_years,
        weight_kg,
        owner_name,
        owner_contact,
      });
      res.status(201).json({ success: true, data: pet });
    } catch (err) {
      next(err);
    }
  }

  async deletePet(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid pet ID.' });
      }

      const deleted = await directoryRepo.deletePet(id);
      res.json({ success: true, message: `Pet #${id} deleted successfully.`, data: deleted });
    } catch (err) {
      next(err);
    }
  }

  // ─── CONSULTATION DELETION ──────────────────────────────────────────────────
  async deleteConsultation(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid consultation ID.' });
      }

      const deleted = await directoryRepo.deleteConsultation(id);
      res.json({ success: true, message: `Consultation #${id} deleted successfully.`, data: deleted });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DirectoryController();

