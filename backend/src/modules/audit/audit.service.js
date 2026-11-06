const db = require('../../db/connection');

class AuditService {
  /**
   * Log an immutable audit event
   */
  async log({
    consultationId,
    actorId = null,
    actorType = 'doctor',
    action,
    entityType = null,
    entityId = null,
    beforeState = null,
    afterState = null,
    metadata = {},
    ipAddress = null,
  }) {
    const query = `
      INSERT INTO consultation_audit_logs 
        (consultation_id, actor_id, actor_type, action, entity_type, entity_id, before_state, after_state, metadata, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      consultationId,
      actorId,
      actorType,
      action,
      entityType,
      entityId,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      JSON.stringify(metadata),
      ipAddress,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Fetch all audit logs for a consultation in chronological order
   */
  async getAuditTrail(consultationId) {
    const query = `
      SELECT 
        l.*,
        u.name AS actor_name,
        u.email AS actor_email
      FROM consultation_audit_logs l
      LEFT JOIN users u ON l.actor_id = u.id
      WHERE l.consultation_id = $1
      ORDER BY l.created_at ASC;
    `;
    const result = await db.query(query, [consultationId]);
    return result.rows;
  }
}

module.exports = new AuditService();

