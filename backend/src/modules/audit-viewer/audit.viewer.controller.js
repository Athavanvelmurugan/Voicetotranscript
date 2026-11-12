const auditViewerService = require('./audit.viewer.service');
const { parsePagination, buildPaginatedResponse } = require('../../utils/pagination');

class AuditViewerController {
  _getDoctorScopeUserId(req) {
    // Non-admin hospital doctors see only their own events & assigned consultations;
    // independent practice OWNERs and hospital clinic_admin/super_admin see the whole practice
    if (req.user?.role === 'doctor' && !['OWNER', 'ADMIN'].includes(req.user?.practiceRole)) {
      return req.user.id;
    }
    return null;
  }

  async getEvents(req, res, next) {
    try {
      const { page, limit, offset, search } = parsePagination(req.query, { page: 1, limit: 15, maxLimit: 100 });
      const { action, actorId, targetType } = req.query;
      const practiceId = req.practiceId || req.user?.practiceId || null;
      const doctorScopeUserId = this._getDoctorScopeUserId(req);

      const result = await auditViewerService.getEvents(req.clinicId || req.user.clinicId, {
        practiceId,
        doctorScopeUserId,
        limit,
        offset,
        action: action || null,
        actorId: actorId ? parseInt(actorId, 10) : null,
        targetType: targetType || null,
        search,
      });
      res.json({
        ...buildPaginatedResponse(result.data, result.total, page, limit),
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyChain(req, res, next) {
    try {
      const consultationId = parseInt(req.params.consultationId, 10);
      const doctorScopeUserId = this._getDoctorScopeUserId(req);
      const result = await auditViewerService.verifyConsultationChain(req.clinicId || req.user.clinicId, consultationId, { doctorScopeUserId });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getLedger(req, res, next) {
    try {
      const consultationId = parseInt(req.params.consultationId, 10);
      const doctorScopeUserId = this._getDoctorScopeUserId(req);
      const ledger = await auditViewerService.getConsultationLedger(req.clinicId || req.user.clinicId, consultationId, { doctorScopeUserId });
      res.json({ success: true, data: ledger });
    } catch (err) {
      next(err);
    }
  }

  async exportCsv(req, res, next) {
    try {
      const practiceId = req.practiceId || req.user?.practiceId || null;
      const csv = await auditViewerService.generateExportCsv(req.clinicId || req.user.clinicId, practiceId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuditViewerController();

