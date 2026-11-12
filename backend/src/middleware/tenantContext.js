/**
 * Ensures tenant context is established from verified backend membership.
 * Blocks unverified, pending-approval, or rejected practices/memberships from workspace operations.
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

    const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isSuperAdmin = req.user.role === 'super_admin' || roles.includes('SUPER_ADMIN');
    const accountStatus = String(req.user.status || '').toUpperCase();

    if (!isSuperAdmin && accountStatus === 'PENDING_VERIFICATION') {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email or mobile number before accessing your workspace.',
        code: 'ACCOUNT_PENDING_VERIFICATION',
      });
    }

    if (!isSuperAdmin && accountStatus === 'PENDING_APPROVAL') {
      return res.status(403).json({
        success: false,
        error: 'Your account or hospital application is awaiting approval.',
        code: 'PRACTICE_PENDING_APPROVAL',
      });
    }

    if (!isSuperAdmin && accountStatus === 'REJECTED') {
      return res.status(403).json({
        success: false,
        error: 'Your application was rejected. Contact support or review your application details.',
        code: 'PRACTICE_REJECTED',
      });
    }

    const clinicId = req.user.clinicId;
    const practiceId = req.user.practiceId;

    if (!isSuperAdmin && !clinicId) {
      // Distinguish pending hospital approval vs pending join request vs unassigned
      const memberships = Array.isArray(req.user.memberships) ? req.user.memberships : [];
      const pendingPractice = memberships.find((m) => m.practice_status === 'PENDING_APPROVAL');
      if (pendingPractice) {
        return res.status(403).json({
          success: false,
          error: 'Hospital application is pending Super Admin approval.',
          code: 'PRACTICE_PENDING_APPROVAL',
        });
      }
      const pendingMember = memberships.find((m) => m.status === 'PENDING_APPROVAL');
      if (pendingMember) {
        return res.status(403).json({
          success: false,
          error: 'Your request to join this hospital is pending approval by the Hospital Admin.',
          code: 'MEMBERSHIP_PENDING_APPROVAL',
        });
      }

      return res.status(403).json({
        success: false,
        error: 'User does not have an active practice workspace.',
        code: 'TENANT_NOT_ASSIGNED',
      });
    }

    req.clinicId = clinicId;
    req.practiceId = practiceId;
    req.isSuperAdmin = isSuperAdmin;

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tenantContext };

