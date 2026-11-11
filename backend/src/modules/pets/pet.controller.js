const petService = require('./pet.service');
const { parsePagination, buildPaginatedResponse } = require('../../utils/pagination');

class PetController {
  async getPets(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query);
      const { ownerId, species } = req.query;
      const { pets, totalCount } = await petService.getPets(req.user.clinicId, {
        page,
        limit,
        offset,
        search,
        species: species || '',
        ownerId: ownerId ? parseInt(ownerId, 10) : null,
      });
      res.json(buildPaginatedResponse(pets, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const pet = await petService.getPetById(req.user.clinicId, id);
      res.json({ success: true, data: pet });
    } catch (err) {
      next(err);
    }
  }

  async getClinicalChart(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const chart = await petService.getClinicalChart(req.user.clinicId, id);
      res.json({ success: true, data: chart });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const {
        name,
        species,
        breed,
        sex,
        dob,
        age_years,
        weight_kg,
        microchip_no,
        allergies,
        chronic_conditions,
        owner_id,
        owner_name,
        owner_contact,
        owner_phone,
        owner_email
      } = req.body;

      if (!name || !species) {
        return res.status(400).json({ success: false, error: 'Patient name and species are required.' });
      }

      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const pet = await petService.createPet(
        req.user.clinicId,
        {
          name,
          species,
          breed,
          sex,
          dob,
          age_years,
          weight_kg,
          microchip_no,
          allergies: Array.isArray(allergies) ? allergies : (allergies ? [allergies] : []),
          chronic_conditions: Array.isArray(chronic_conditions) ? chronic_conditions : (chronic_conditions ? [chronic_conditions] : []),
          owner_id: owner_id ? parseInt(owner_id, 10) : null,
          owner_name: owner_name || null,
          owner_contact: owner_contact || owner_phone || owner_email || null,
          owner_phone: owner_phone || owner_contact || null,
          owner_email: owner_email || null,
        },
        req.user.id,
        reqInfo
      );
      res.status(201).json({ success: true, data: pet });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await petService.updatePet(req.user.clinicId, id, req.body, req.user.id, reqInfo);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PetController();

