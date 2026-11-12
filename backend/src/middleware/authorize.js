const CANONICAL_TO_LEGACY = {
  SUPER_ADMIN: 'super_admin',
  HOSPITAL_ADMIN: 'clinic_admin',
  DOCTOR: 'doctor',
  PET_OWNER: 'pet_owner',
  STAFF: 'staff',
};

const LEGACY_TO_CANONICAL = {
  super_admin: 'SUPER_ADMIN',
  clinic_admin: 'HOSPITAL_ADMIN',
  doctor: 'DOCTOR',
  veterinarian: 'DOCTOR',
  pet_owner: 'PET_OWNER',
  owner: 'PET_OWNER',
  staff: 'STAFF',
};

/**
 * Authorize middleware to check allowed user roles & active practice ownership.
 * Usage: authorize(['doctor', 'clinic_admin']) or authorize(['DOCTOR', 'HOSPITAL_ADMIN'])
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

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const normalizedPrimary = (req.user.role || '').toLowerCase() === 'veterinarian'
      ? 'doctor'
      : (req.user.role || '').toLowerCase();

    // Super Admin has universal access
    if (normalizedPrimary === 'super_admin' || userRoles.includes('SUPER_ADMIN')) {
      return next();
    }

    const allowedNormalized = new Set();
    for (const r of allowedRoles) {
      const lower = String(r).toLowerCase();
      allowedNormalized.add(lower);
      if (CANONICAL_TO_LEGACY[String(r).toUpperCase()]) {
        allowedNormalized.add(CANONICAL_TO_LEGACY[String(r).toUpperCase()]);
      }
      if (LEGACY_TO_CANONICAL[lower]) {
        allowedNormalized.add(LEGACY_TO_CANONICAL[lower].toLowerCase());
      }
    }

    const userCandidateRoles = new Set([normalizedPrimary, (req.user.role || '').toLowerCase()]);
    for (const r of userRoles) {
      userCandidateRoles.add(String(r).toLowerCase());
      if (CANONICAL_TO_LEGACY[String(r).toUpperCase()]) {
        userCandidateRoles.add(CANONICAL_TO_LEGACY[String(r).toUpperCase()]);
      }
    }

    // Practice OWNER / ADMIN of the active practice can administer their own practice settings & roster
    if (req.user.practiceRole === 'OWNER' || req.user.practiceRole === 'ADMIN') {
      userCandidateRoles.add('clinic_admin');
      userCandidateRoles.add('hospital_admin');
    }

    const hasMatch = [...userCandidateRoles].some((r) => allowedNormalized.has(r));

    if (!hasMatch) {
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

