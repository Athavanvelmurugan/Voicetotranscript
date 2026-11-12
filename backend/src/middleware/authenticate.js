const jwt = require('jsonwebtoken');
const config = require('../config');
const { loadUserContext } = require('../modules/auth/userContext.helper');

/**
 * Extracts and verifies JWT access token from httpOnly cookie or Authorization header.
 * Populates req.user with multi-role and verified active practice context.
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.petcare_at) {
      token = req.cookies.petcare_at;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No session token provided.',
        code: 'UNAUTHORIZED',
      });
    }

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

    const headerPracticeId = req.headers['x-practice-id'];
    const requestedPracticeId = headerPracticeId || req.cookies?.petcare_practice_id || decoded.activePracticeId || null;

    const userContext = await loadUserContext(decoded.sub, {
      requestedPracticeId,
      strictPracticeCheck: Boolean(headerPracticeId),
    });

    if (!userContext) {
      return res.status(401).json({
        success: false,
        error: 'User account not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (userContext.unauthorizedPracticeAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: you do not belong to or lack active membership in the requested practice.',
        code: 'UNAUTHORIZED_PRACTICE_ACCESS',
      });
    }

    const upperStatus = String(userContext.status || '').toUpperCase();
    if (['SUSPENDED', 'DEACTIVATED', 'INACTIVE'].includes(upperStatus)) {
      return res.status(403).json({
        success: false,
        error: `Account is ${userContext.status}. Please contact administrator.`,
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    // Reject if user only belongs to suspended practices
    const isSuperAdmin = userContext.role === 'super_admin' || userContext.roles.includes('SUPER_ADMIN');
    if (
      !isSuperAdmin &&
      !userContext.clinicId &&
      userContext.memberships.length > 0 &&
      userContext.memberships.every((m) => String(m.practice_status).toUpperCase() === 'SUSPENDED')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Clinic subscription or access is currently suspended.',
        code: 'CLINIC_SUSPENDED',
      });
    }

    req.user = userContext;
    req.clinicId = userContext.clinicId;
    req.practiceId = userContext.practiceId;

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
    const userContext = await loadUserContext(decoded.sub, {
      requestedPracticeId: req.headers['x-practice-id'] || decoded.activePracticeId || null,
    });
    if (userContext && !userContext.unauthorizedPracticeAccess && String(userContext.status).toUpperCase() === 'ACTIVE') {
      req.user = userContext;
      req.clinicId = userContext.clinicId;
      req.practiceId = userContext.practiceId;
    }
    next();
  } catch (_) {
    next();
  }
}

module.exports = { authenticate, optionalAuthenticate };

