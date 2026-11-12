const practiceService = require('./practice.service');

class PracticeController {
  async discover(req, res, next) {
    try {
      const { type = '', q = '', search = '', city = '', limit = 100, offset = 0 } = req.query;
      const data = await practiceService.discoverPractices({
        type,
        search: q || search,
        city,
        limit: Math.min(parseInt(limit, 10) || 100, 200),
        offset: parseInt(offset, 10) || 0,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createIndependent(req, res, next) {
    try {
      const data = await practiceService.createIndependentPractice(req.user, req.body || {}, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await practiceService.getPracticeById(id, req.user || null);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createInvitation(req, res, next) {
    try {
      const practiceId = parseInt(req.params.id, 10);
      const data = await practiceService.inviteToPractice(practiceId, req.user, req.body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async myInvitations(req, res, next) {
    try {
      const data = await practiceService.listMyInvitations(req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async respondInvitation(req, res, next) {
    try {
      const data = await practiceService.respondToInvitation(req.params.inviteId, req.user, req.body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async submitJoinRequest(req, res, next) {
    try {
      const practiceId = parseInt(req.params.id, 10);
      const data = await practiceService.submitJoinRequest(practiceId, req.user, req.body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async myJoinRequests(req, res, next) {
    try {
      const data = await practiceService.listMyJoinRequests(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async listJoinRequests(req, res, next) {
    try {
      const practiceId = parseInt(req.params.id, 10);
      const data = await practiceService.listPracticeJoinRequests(practiceId, req.user, {
        status: req.query.status || '',
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async approveJoinRequest(req, res, next) {
    try {
      const practiceId = parseInt(req.params.id, 10);
      const requestId = parseInt(req.params.requestId, 10);
      const data = await practiceService.approveJoinRequest(practiceId, requestId, req.user, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async rejectJoinRequest(req, res, next) {
    try {
      const practiceId = parseInt(req.params.id, 10);
      const requestId = parseInt(req.params.requestId, 10);
      const data = await practiceService.rejectJoinRequest(practiceId, requestId, req.user, req.body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PracticeController();
