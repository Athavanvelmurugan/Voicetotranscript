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
    } else if (req.cookies && req.cookies.petcare_at) {
      token = req.cookies.petcare_at;
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

    const tokenRole = String(decoded.role || '').toLowerCase();
    const tokenRoles = Array.isArray(decoded.roles) ? decoded.roles : [];

    // Unified user JWT for PET_OWNER -> resolve synced legacy `owners` row via user_id / pet_owner_profiles
    if (tokenRole === 'pet_owner' || tokenRoles.includes('PET_OWNER')) {
      const { rows } = await db.query(
        `SELECT o.*, c.name AS clinic_name, u.id AS unified_user_id, u.name AS u_name, u.email AS u_email, u.phone AS u_phone, u.status AS u_status
         FROM users u
         LEFT JOIN pet_owner_profiles pop ON pop.user_id = u.id
         LEFT JOIN owners o ON o.id = COALESCE(pop.legacy_owner_id, (SELECT id FROM owners WHERE user_id = u.id LIMIT 1))
         LEFT JOIN clinics c ON c.id = o.clinic_id
         WHERE u.id = $1;`,
        [decoded.sub]
      );
      if (rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Pet owner account not found.', code: 'OWNER_NOT_FOUND' });
      }
      const row = rows[0];
      if (String(row.u_status || '').toUpperCase() === 'PENDING_VERIFICATION') {
        return res.status(403).json({ success: false, error: 'Please verify your email or mobile number first.', code: 'ACCOUNT_PENDING_VERIFICATION' });
      }
      let ownerId = row.id;
      if (!ownerId) {
        const ins = await db.query(
          `INSERT INTO owners (clinic_id, name, phone, email, user_id)
           VALUES (NULL, $1, $2, $3, $4) RETURNING *;`,
          [row.u_name, row.u_phone || 'Unspecified', row.u_email, row.unified_user_id]
        );
        ownerId = ins.rows[0].id;
        await db.query(
          `UPDATE pet_owner_profiles SET legacy_owner_id = $1 WHERE user_id = $2;`,
          [ownerId, row.unified_user_id]
        );
      }
      req.owner = {
        id: ownerId,
        userId: row.unified_user_id,
        name: row.name || row.u_name,
        phone: row.phone || row.u_phone,
        email: row.email || row.u_email,
        clinicId: row.clinic_id || null,
        clinicName: row.clinic_name || null,
        role: 'owner',
      };
      req.user = { id: row.unified_user_id, role: 'pet_owner', roles: ['PET_OWNER'] };
      return next();
    }

    if (tokenRole !== 'owner') {
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
