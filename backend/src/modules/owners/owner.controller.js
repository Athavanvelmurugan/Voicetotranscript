const ownerService = require('./owner.service');

class OwnerController {
  async getOwners(req, res, next) {
    try {
      const search = req.query.query || '';
      const owners = await ownerService.getOwners(req.user.clinicId, search);
      res.json({ success: true, data: owners });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const owner = await ownerService.getOwnerById(req.user.clinicId, id);
      res.json({ success: true, data: owner });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { name, phone, email, address, preferredLanguage } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ success: false, error: 'Owner Name and Phone Number are required.' });
      }

      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const owner = await ownerService.createOwner(
        req.user.clinicId,
        { name, phone, email, address, preferredLanguage },
        req.user.id,
        reqInfo
      );
      res.status(201).json({ success: true, data: owner });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await ownerService.updateOwner(req.user.clinicId, id, req.body, req.user.id, reqInfo);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async merge(req, res, next) {
    try {
      const { primaryId, duplicateId } = req.body;
      if (!primaryId || !duplicateId) {
        return res.status(400).json({ success: false, error: 'primaryId and duplicateId are required.' });
      }

      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const result = await ownerService.mergeOwners(
        req.user.clinicId,
        parseInt(primaryId, 10),
        parseInt(duplicateId, 10),
        req.user.id,
        reqInfo
      );
      res.json({ success: true, message: 'Owner profiles successfully merged.', data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OwnerController();

