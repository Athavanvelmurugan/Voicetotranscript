/**
 * Authorize middleware to check allowed user roles.
 * Usage: authorize(['doctor', 'clinic_admin'])
 */
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (allowedRoles.length === 0) {
      return next();
    }

    // Super Admin has universal access
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Allow veterinarian as alias for doctor
    const effectiveRole = req.user.role === 'veterinarian' ? 'doctor' : req.user.role;

    if (!allowedRoles.includes(effectiveRole) && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden: Role '${req.user.role}' is not authorized to access this resource.`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

module.exports = { authorize };

