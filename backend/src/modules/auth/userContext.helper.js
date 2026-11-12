const db = require('../../db/connection');

const LEGACY_ROLE_MAP = {
  super_admin: 'SUPER_ADMIN',
  clinic_admin: 'HOSPITAL_ADMIN',
  doctor: 'DOCTOR',
  veterinarian: 'DOCTOR',
  pet_owner: 'PET_OWNER',
  owner: 'PET_OWNER',
  staff: 'STAFF',
};

function mapMembershipToLegacyRole(userRole, activeMembership) {
  const lower = String(userRole || '').toLowerCase();
  if (lower === 'super_admin') return 'super_admin';
  if (lower === 'pet_owner' || lower === 'owner') return 'pet_owner';
  if (!activeMembership) {
    return lower === 'veterinarian' ? 'doctor' : (lower || 'doctor');
  }
  if (activeMembership.practice_type === 'INDEPENDENT') {
    return 'doctor';
  }
  if (activeMembership.role === 'OWNER' || activeMembership.role === 'ADMIN') {
    return 'clinic_admin';
  }
  if (activeMembership.role === 'DOCTOR') {
    return 'doctor';
  }
  return 'staff';
}

/**
 * Loads full authenticated user identity, multi-role RBAC array, and practice memberships.
 * Validates any explicitly requested practiceId strictly against ACTIVE database memberships.
 */
async function loadUserContext(userId, { requestedPracticeId = null, strictPracticeCheck = false } = {}) {
  const userRes = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.clinic_id, u.phone, u.status,
            u.email_verified_at, u.phone_verified_at, u.license_number, u.license_verified_at,
            u.specialty, u.profile_photo_key,
            c.name AS legacy_clinic_name, c.slug AS legacy_clinic_slug, c.status AS legacy_clinic_status
     FROM users u
     LEFT JOIN clinics c ON c.id = u.clinic_id
     WHERE u.id = $1;`,
    [userId]
  );

  if (userRes.rows.length === 0) return null;
  const u = userRes.rows[0];

  const [rolesRes, membersRes, docRes, ownerProfRes] = await Promise.all([
    db.query(`SELECT role FROM user_roles WHERE user_id = $1 ORDER BY id ASC;`, [userId]),
    db.query(
      `SELECT pm.id AS membership_id, pm.practice_id, pm.role, pm.status, pm.is_primary, pm.joined_at,
              p.clinic_id, p.practice_type, p.name AS practice_name, p.slug AS practice_slug, p.status AS practice_status
       FROM practice_members pm
       JOIN practices p ON p.id = pm.practice_id
       WHERE pm.user_id = $1
       ORDER BY pm.is_primary DESC, pm.id ASC;`,
      [userId]
    ),
    db.query(
      `SELECT qualification, registration_number, specialization, years_of_experience, photo_key, independent_practice_id
       FROM doctor_profiles WHERE user_id = $1;`,
      [userId]
    ),
    db.query(
      `SELECT full_name, email, phone, address, preferred_language, legacy_owner_id
       FROM pet_owner_profiles WHERE user_id = $1;`,
      [userId]
    ),
  ]);

  let roles = rolesRes.rows.map((r) => r.role);
  if (roles.length === 0 && u.role) {
    const mapped = LEGACY_ROLE_MAP[String(u.role).toLowerCase()];
    if (mapped) roles = [mapped];
  }

  const isSuperAdmin = roles.includes('SUPER_ADMIN') || String(u.role).toLowerCase() === 'super_admin';
  const memberships = [...membersRes.rows];

  // Backward-compatibility bridge: if user has legacy clinic_id without practice_members row yet
  if (!isSuperAdmin && memberships.length === 0 && u.clinic_id) {
    const fallbackPractice = await db.query(
      `SELECT id AS practice_id, clinic_id, practice_type, name AS practice_name, slug AS practice_slug, status AS practice_status
       FROM practices WHERE clinic_id = $1 LIMIT 1;`,
      [u.clinic_id]
    );
    if (fallbackPractice.rows.length > 0) {
      const fp = fallbackPractice.rows[0];
      memberships.push({
        membership_id: null,
        practice_id: fp.practice_id,
        clinic_id: fp.clinic_id,
        practice_type: fp.practice_type,
        practice_name: fp.practice_name,
        practice_slug: fp.practice_slug,
        practice_status: fp.practice_status,
        role: u.role === 'clinic_admin' ? 'ADMIN' : u.role === 'doctor' ? 'DOCTOR' : 'STAFF',
        status: String(u.status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : String(u.status || 'ACTIVE').toUpperCase(),
        is_primary: true,
        joined_at: null,
      });
    }
  }

  const activeMemberships = memberships.filter(
    (m) => String(m.status).toUpperCase() === 'ACTIVE' && String(m.practice_status).toUpperCase() === 'ACTIVE'
  );

  let activeMembership = null;
  if (requestedPracticeId !== null && requestedPracticeId !== undefined && requestedPracticeId !== '') {
    const parsedId = parseInt(requestedPracticeId, 10);
    activeMembership = activeMemberships.find((m) => m.practice_id === parsedId) || null;
    if (strictPracticeCheck && !isSuperAdmin && !activeMembership) {
      return { unauthorizedPracticeAccess: true, requestedPracticeId: parsedId };
    }
  }

  if (!activeMembership && activeMemberships.length > 0) {
    activeMembership =
      activeMemberships.find((m) => m.is_primary) ||
      activeMemberships.find((m) => m.practice_type === 'INDEPENDENT') ||
      activeMemberships[0];
  }

  const primaryClinicId = activeMembership
    ? activeMembership.clinic_id
    : (memberships.length > 0 ? null : u.clinic_id || null);

  const effectiveRole = mapMembershipToLegacyRole(u.role, activeMembership);

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: effectiveRole,
    roles,
    status: u.status,
    emailVerified: Boolean(u.email_verified_at),
    phoneVerified: Boolean(u.phone_verified_at),
    clinicId: activeMembership ? activeMembership.clinic_id : (isSuperAdmin ? null : primaryClinicId),
    clinicName: activeMembership ? activeMembership.practice_name : u.legacy_clinic_name || null,
    clinicSlug: activeMembership ? activeMembership.practice_slug : u.legacy_clinic_slug || null,
    clinicStatus: activeMembership ? activeMembership.practice_status : u.legacy_clinic_status || null,
    practiceId: activeMembership ? activeMembership.practice_id : null,
    practiceName: activeMembership ? activeMembership.practice_name : null,
    practiceType: activeMembership ? activeMembership.practice_type : null,
    practiceRole: activeMembership ? activeMembership.role : null,
    licenseNumber: u.license_number,
    specialty: u.specialty,
    doctorProfile: docRes.rows[0] || null,
    petOwnerProfile: ownerProfRes.rows[0] || null,
    memberships,
    activeMembershipsCount: activeMemberships.length,
  };
}

module.exports = { loadUserContext, LEGACY_ROLE_MAP };

