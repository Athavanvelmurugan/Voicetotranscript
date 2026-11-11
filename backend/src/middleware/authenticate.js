const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/connection');

/**
 * Extracts and verifies JWT access token from httpOnly cookie or Authorization header.
 * Populates req.user and establishes tenant context.
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check httpOnly cookie first (primary security standard)
    if (req.cookies && req.cookies.petcare_at) {
      token = req.cookies.petcare_at;
    } 
    // 2. Fallback to Authorization: Bearer header (for API/test clients)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No session token provided.',
        code: 'UNAUTHORIZED',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.auth.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please refresh token or log in again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid session token.',
        code: 'INVALID_TOKEN',
      });
    }

    if (decoded.isMfaPending) {
      return res.status(401).json({
        success: false,
        error: 'MFA verification incomplete.',
        code: 'MFA_REQUIRED',
      });
    }

    // Fetch user from DB to verify status and current clinic
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.status, u.license_number,
              c.name AS clinic_name, c.slug AS clinic_slug, c.status AS clinic_status
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE u.id = $1;`,
      [decoded.sub]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User account not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = userRes.rows[0];

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        error: `Account is ${user.status}. Please contact administrator.`,
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    if (user.clinic_status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Clinic subscription or access is currently suspended.',
        code: 'CLINIC_SUSPENDED',
      });
    }

    // Attach user identity to request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clinicId: user.clinic_id,
      clinicName: user.clinic_name,
      clinicSlug: user.clinic_slug,
      licenseNumber: user.license_number,
    };

    req.clinicId = user.clinic_id;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication: attaches user if token is valid, but does not reject if absent
 */
async function optionalAuthenticate(req, res, next) {
  try {
    let token = req.cookies?.petcare_at;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }
    if (!token) return next();

    const decoded = jwt.verify(token, config.auth.jwtSecret);
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.status FROM users u WHERE u.id = $1;`,
      [decoded.sub]
    );
    if (userRes.rows.length > 0 && userRes.rows[0].status === 'active') {
      req.user = {
        id: userRes.rows[0].id,
        name: userRes.rows[0].name,
        email: userRes.rows[0].email,
        role: userRes.rows[0].role,
        clinicId: userRes.rows[0].clinic_id,
      };
      req.clinicId = req.user.clinicId;
    }
    next();
  } catch (_) {
    next();
  }
}

module.exports = { authenticate, optionalAuthenticate };

