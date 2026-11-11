const superAdminService = require('./super.admin.service');
const { parsePagination, buildPaginatedResponse } = require('../../utils/pagination');

class SuperAdminController {
  async getTrends(req, res, next) {
    try {
      const data = await superAdminService.getTrends();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getClinics(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query);
      const status = req.query.status || '';
      const { clinics, totalCount } = await superAdminService.getClinics({ page, limit, offset, search, status });
      res.json(buildPaginatedResponse(clinics, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async getClinicDoctors(req, res, next) {
    try {
      const clinicId = parseInt(req.params.id, 10);
      const { page, limit, offset, search } = parsePagination(req.query);
      const { doctors, totalCount } = await superAdminService.getClinicDoctors(clinicId, { page, limit, offset, search });
      res.json(buildPaginatedResponse(doctors, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async getClinicPatients(req, res, next) {
    try {
      const clinicId = parseInt(req.params.id, 10);
      const { page, limit, offset, search } = parsePagination(req.query);
      const { patients, totalCount } = await superAdminService.getClinicPatients(clinicId, { page, limit, offset, search });
      res.json(buildPaginatedResponse(patients, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query, { page: 1, limit: 15, maxLimit: 100 });
      const { clinicId, actorType, dateFrom, dateTo } = req.query;
      const { logs, totalCount } = await superAdminService.getSystemAuditLogs({
        page, limit, offset, search, clinicId, actorType, dateFrom, dateTo
      });
      res.json(buildPaginatedResponse(logs, totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async createClinic(req, res, next) {
    try {
      const data = await superAdminService.createClinic(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateClinicStatus(req, res, next) {
    try {
      const data = await superAdminService.updateClinicStatus(
        parseInt(req.params.id, 10),
        req.body.status
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getGlobalPatients(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query);
      const species = req.query.species || '';
      const data = await superAdminService.getGlobalPatients({
        search,
        species,
        limit,
        offset,
      });
      res.json(buildPaginatedResponse(data.patients, data.totalCount, page, limit));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SuperAdminController();

