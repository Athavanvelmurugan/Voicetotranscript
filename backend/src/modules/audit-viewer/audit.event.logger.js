const db = require('../../db/connection');

async function logAuditEvent({
  clinicId,
  actorUserId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
  ip = null,
  userAgent = null,
}) {
  try {
    const query = `
      INSERT INTO audit_events 
        (clinic_id, actor_user_id, action, target_type, target_id, metadata, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      clinicId,
      actorUserId,
      action,
      targetType,
      targetId ? String(targetId) : null,
      JSON.stringify(metadata),
      ip,
      userAgent,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  } catch (err) {
    console.error('[AuditEventLogger] Failed to write audit event:', err.message);
    return null;
  }
}

module.exports = { logAuditEvent };

