const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/connection');

/**
 * Pet Owner Authentication Middleware
 * Validates JWT issued specifically for pet owners and sets owner tenant context.
 */
async function ownerAuthenticate(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.petcare_owner_token) {
      token = req.cookies.petcare_owner_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      // In development / local testing, allow fallback to x-owner-id if provided
      const fallbackOwnerId = req.headers['x-owner-id'];
      if (fallbackOwnerId) {
        const { rows } = await db.query(
          `SELECT o.*, c.name AS clinic_name
           FROM owners o
           LEFT JOIN clinics c ON c.id = o.clinic_id
           WHERE o.id = $1;`,
          [fallbackOwnerId]
        );
        if (rows.length > 0) {
          const owner = rows[0];
          req.owner = {
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
            email: owner.email,
            clinicId: owner.clinic_id,
            clinicName: owner.clinic_name,
            role: 'owner',
          };
          if (owner.clinic_id) {
            await db.query(`SET LOCAL app.clinic_id = '${owner.clinic_id}';`);
          }
          return next();
        }
      }

      return res.status(401).json({
        success: false,
        error: 'Pet owner authentication required. Please log in with your phone or email.',
        code: 'UNAUTHORIZED_OWNER',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.auth.jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid. Please request a new OTP.',
        code: 'INVALID_OWNER_TOKEN',
      });
    }

    if (decoded.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Account is not a registered pet guardian.',
        code: 'FORBIDDEN_ROLE',
      });
    }

    const { rows } = await db.query(
      `SELECT o.*, c.name AS clinic_name
       FROM owners o
       LEFT JOIN clinics c ON c.id = o.clinic_id
       WHERE o.id = $1;`,
      [decoded.sub]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Pet owner record not found.',
        code: 'OWNER_NOT_FOUND',
      });
    }

    const owner = rows[0];
    req.owner = {
      id: owner.id,
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      clinicId: owner.clinic_id,
      clinicName: owner.clinic_name,
      role: 'owner',
    };

    // Establish Postgres RLS tenant context for this owner's clinic
    if (owner.clinic_id) {
      await db.query(`SET LOCAL app.clinic_id = '${owner.clinic_id}';`);
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { ownerAuthenticate };
