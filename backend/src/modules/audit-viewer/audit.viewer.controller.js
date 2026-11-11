const auditViewerService = require('./audit.viewer.service');
const { parsePagination, buildPaginatedResponse } = require('../../utils/pagination');

class AuditViewerController {
  async getEvents(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query, { page: 1, limit: 15, maxLimit: 100 });
      const { action, actorId, targetType, actorRole } = req.query;
      const result = await auditViewerService.getEvents(req.user.clinicId, {
        limit,
        offset,
        action: action || null,
        actorId: actorId ? parseInt(actorId, 10) : null,
        targetType: targetType || null,
        search,
      });
      res.json(buildPaginatedResponse(result.data, result.total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async verifyChain(req, res, next) {
    try {
      const consultationId = parseInt(req.params.consultationId, 10);
      const result = await auditViewerService.verifyConsultationChain(req.user.clinicId, consultationId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getLedger(req, res, next) {
    try {
      const consultationId = parseInt(req.params.consultationId, 10);
      const ledger = await auditViewerService.getConsultationLedger(req.user.clinicId, consultationId);
      res.json({ success: true, data: ledger });
    } catch (err) {
      next(err);
    }
  }

  async exportCsv(req, res, next) {
    try {
      const csv = await auditViewerService.generateExportCsv(req.user.clinicId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuditViewerController();

