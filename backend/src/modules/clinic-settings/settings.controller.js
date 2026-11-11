const settingsService = require('./settings.service');

class SettingsController {
  async getSettings(req, res, next) {
    try {
      const settings = await settingsService.getSettings(req.user.clinicId);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const reqInfo = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const updated = await settingsService.updateSettings(
        req.user.clinicId,
        req.body,
        req.user.id,
        reqInfo
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SettingsController();

