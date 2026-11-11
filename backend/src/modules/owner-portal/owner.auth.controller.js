const ownerAuthService = require('./owner.auth.service');

class OwnerAuthController {
  async signup(req, res, next) {
    try {
      const { name, email, phone, petName, species, breed, clinicId } = req.body;
      const result = await ownerAuthService.registerOwner({
        name,
        email,
        phone,
        petName,
        species,
        breed,
        clinicId: clinicId || 1,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async sendOtp(req, res, next) {
    try {
      const { identifier, clinicId } = req.body;
      const result = await ownerAuthService.sendOtp({ identifier, clinicId: clinicId || 1 });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { identifier, code, clinicId } = req.body;
      const result = await ownerAuthService.verifyOtp({ identifier, code, clinicId: clinicId || 1 });

      // Set HTTP-only cookie
      res.cookie('petcare_owner_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res) {
    res.clearCookie('petcare_owner_token');
    res.json({ success: true, message: 'Logged out successfully' });
  }
}

module.exports = new OwnerAuthController();
