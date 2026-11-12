const db = require('../../db/connection');
const auditService = require('../audit/audit.service');

class AuditViewerService {
  async getEvents(clinicId, { practiceId = null, doctorScopeUserId = null, limit = 50, offset = 0, action = null, actorId = null, targetType = null, search = '' } = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [clinicId, practiceId || null, doctorScopeUserId || null];
    let idx = 4;

    if (action) {
      whereClause += ` AND uq.action = $${idx++}`;
      params.push(action);
    }

    if (actorId) {
      whereClause += ` AND uq.actor_user_id = $${idx++}`;
      params.push(actorId);
    }

    if (targetType) {
      whereClause += ` AND uq.target_type = $${idx++}`;
      params.push(targetType);
    }

    if (search) {
      whereClause += ` AND (uq.action ILIKE $${idx} OR uq.actor_name ILIKE $${idx} OR uq.actor_email ILIKE $${idx} OR uq.target_type ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const unifiedCte = `
      WITH unified_events AS (
        SELECT 
          ae.id::text AS id,
          ae.clinic_id,
          ae.practice_id,
          ae.actor_user_id,
          ae.action,
          ae.target_type,
          ae.target_id,
          ae.metadata,
          ae.ip,
          ae.user_agent,
          ae.created_at,
          u.name AS actor_name,
          u.email AS actor_email,
          u.role AS actor_role
        FROM audit_events ae
        LEFT JOIN users u ON u.id = ae.actor_user_id
        WHERE (ae.clinic_id = $1 OR ($2::int IS NOT NULL AND ae.practice_id = $2::int))
          AND (
            $3::int IS NULL
            OR ae.actor_user_id = $3::int
            OR (
              ae.target_type = 'consultation'
              AND EXISTS (
                SELECT 1 FROM consultations cs
                WHERE cs.id::text = ae.target_id AND cs.doctor_id = $3::int
              )
            )
          )

        UNION ALL

        SELECT 
          ('cal_' || cal.id::text) AS id,
          cal.clinic_id,
          NULL::int AS practice_id,
          cal.actor_id AS actor_user_id,
          cal.action,
          COALESCE(cal.entity_type, 'consultation') AS target_type,
          COALESCE(cal.entity_id::text, cal.consultation_id::text) AS target_id,
          COALESCE(cal.metadata, '{}'::jsonb) AS metadata,
          cal.ip_address AS ip,
          NULL::text AS user_agent,
          cal.created_at,
          COALESCE(u.name, CASE WHEN cal.actor_type = 'ai' THEN 'AI Clinical Engine' ELSE cal.actor_type END) AS actor_name,
          u.email AS actor_email,
          COALESCE(u.role, cal.actor_type) AS actor_role
        FROM consultation_audit_logs cal
        LEFT JOIN users u ON u.id = cal.actor_id
        LEFT JOIN consultations c_scope ON c_scope.id = cal.consultation_id
        WHERE cal.clinic_id = $1
          AND ($3::int IS NULL OR cal.actor_id = $3::int OR c_scope.doctor_id = $3::int)
      )
    `;

    const countQuery = `${unifiedCte} SELECT COUNT(*)::int AS total FROM unified_events uq ${whereClause};`;
    const countRes = await db.query(countQuery, params);
    const total = countRes.rows[0].total;

    const dataQuery = `
      ${unifiedCte}
      SELECT 
        uq.id,
        uq.clinic_id,
        uq.practice_id,
        uq.actor_user_id,
        uq.action,
        uq.target_type,
        uq.target_id,
        uq.metadata,
        uq.ip,
        uq.user_agent,
        uq.created_at,
        uq.actor_name,
        uq.actor_email,
        uq.actor_role
      FROM unified_events uq
      ${whereClause}
      ORDER BY uq.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);
    const { rows } = await db.query(dataQuery, params);

    return {
      total,
      limit,
      offset,
      data: rows,
    };
  }

  async _assertConsultationAccess(clinicId, consultationId, doctorScopeUserId = null) {
    const cRes = await db.query('SELECT clinic_id, doctor_id FROM consultations WHERE id = $1;', [consultationId]);
    if (cRes.rows.length === 0 || cRes.rows[0].clinic_id !== clinicId) {
      const err = new Error(`Consultation #${consultationId} not found.`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (doctorScopeUserId && cRes.rows[0].doctor_id !== doctorScopeUserId) {
      const err = new Error('Access forbidden: You may only inspect audit ledgers for your assigned consultations.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  async verifyConsultationChain(clinicId, consultationId, { doctorScopeUserId = null } = {}) {
    await this._assertConsultationAccess(clinicId, consultationId, doctorScopeUserId);
    return auditService.verifyChain(consultationId);
  }

  async getConsultationLedger(clinicId, consultationId, { doctorScopeUserId = null } = {}) {
    await this._assertConsultationAccess(clinicId, consultationId, doctorScopeUserId);

    const { rows } = await db.query(
      `SELECT * FROM consultation_audit_ledger WHERE consultation_id = $1 ORDER BY sequence_number ASC;`,
      [consultationId]
    );
    return rows;
  }

  async generateExportCsv(clinicId, practiceId = null) {
    const { rows } = await db.query(
      `WITH unified_events AS (
        SELECT 
          ae.id::text AS id,
          ae.clinic_id,
          ae.action,
          ae.target_type,
          ae.target_id,
          ae.created_at,
          u.name AS actor_name,
          u.email AS actor_email,
          ae.ip,
          ae.metadata::text AS metadata
        FROM audit_events ae
        LEFT JOIN users u ON u.id = ae.actor_user_id
        WHERE (ae.clinic_id = $1 OR ($2::int IS NOT NULL AND ae.practice_id = $2::int))

        UNION ALL

        SELECT 
          ('cal_' || cal.id::text) AS id,
          cal.clinic_id,
          cal.action,
          COALESCE(cal.entity_type, 'consultation') AS target_type,
          COALESCE(cal.entity_id::text, cal.consultation_id::text) AS target_id,
          cal.created_at,
          COALESCE(u.name, CASE WHEN cal.actor_type = 'ai' THEN 'AI Clinical Engine' ELSE cal.actor_type END) AS actor_name,
          u.email AS actor_email,
          cal.ip_address AS ip,
          COALESCE(cal.metadata::text, '{}') AS metadata
        FROM consultation_audit_logs cal
        LEFT JOIN users u ON u.id = cal.actor_id
        WHERE cal.clinic_id = $1
      )
      SELECT 
        id,
        created_at,
        action,
        target_type,
        target_id,
        actor_name,
        actor_email,
        ip,
        metadata
      FROM unified_events
      ORDER BY created_at DESC
      LIMIT 1000;`,
      [clinicId, practiceId || null]
    );

    const headers = ['Timestamp', 'Action', 'Target Type', 'Target ID', 'Actor Name', 'Actor Email', 'IP Address', 'Metadata'];
    const lines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        `"${new Date(r.created_at).toISOString()}"`,
        `"${r.action}"`,
        `"${r.target_type || ''}"`,
        `"${r.target_id || ''}"`,
        `"${(r.actor_name || '').replace(/"/g, '""')}"`,
        `"${r.actor_email || ''}"`,
        `"${r.ip || ''}"`,
        `"${(r.metadata || '').replace(/"/g, '""')}"`,
      ];
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}

module.exports = new AuditViewerService();

