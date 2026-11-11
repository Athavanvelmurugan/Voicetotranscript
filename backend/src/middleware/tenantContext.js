const db = require('../db/connection');

/**
 * Ensures tenant context is established from authenticated user.
 * Sets PostgreSQL session variable `app.clinic_id` on the connection.
 */
async function tenantContext(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Tenant context requires an authenticated user.',
        code: 'UNAUTHENTICATED',
      });
    }

    const isSuperAdmin = req.user.role === 'super_admin';
    const clinicId = req.user.clinicId;

    if (!isSuperAdmin && !clinicId) {
      return res.status(403).json({
        success: false,
        error: 'User is not assigned to any active clinic.',
        code: 'TENANT_NOT_ASSIGNED',
      });
    }

    req.clinicId = clinicId;
    req.isSuperAdmin = isSuperAdmin;

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tenantContext };

