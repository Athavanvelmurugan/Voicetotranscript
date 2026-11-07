const crypto = require('crypto');
const db = require('../../db/connection');

const GENESIS_PREV_HASH = '0'.repeat(64);

function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

class AuditService {
  /**
   * Canonical SHA-256 hash computation for audit ledger blocks (RFC 8785 JSON Canonicalization)
   */
  computeHash({ previousHash, sequenceNumber, eventType, actorId, actorType, createdAt, payloadSnapshot }) {
    const canonicalPayload = canonicalStringify(payloadSnapshot || {});
    const timestampStr = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
    const raw = `${previousHash}|${sequenceNumber}|${eventType}|${actorId ?? 'null'}|${actorType}|${timestampStr}|${canonicalPayload}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Log a cryptographically chained, append-only ledger entry
   */
  async logChainedEvent({
    consultationId,
    eventType,
    actorId = null,
    actorType = 'doctor',
    payloadSnapshot = {},
    customTimestamp = null,
  }) {
    // 1. Fetch latest block for this consultation to establish hash chain linkage
    const lastRowRes = await db.query(
      `SELECT sequence_number, current_hash 
       FROM consultation_audit_ledger 
       WHERE consultation_id = $1 
       ORDER BY sequence_number DESC 
       LIMIT 1;`,
      [consultationId]
    );

    const lastBlock = lastRowRes.rows[0];
    const sequenceNumber = lastBlock ? lastBlock.sequence_number + 1 : 1;
    const previousHash = lastBlock ? lastBlock.current_hash : GENESIS_PREV_HASH;
    const createdAt = customTimestamp || new Date().toISOString();

    const currentHash = this.computeHash({
      previousHash,
      sequenceNumber,
      eventType,
      actorId,
      actorType,
      createdAt,
      payloadSnapshot,
    });

    const insertQuery = `
      INSERT INTO consultation_audit_ledger
        (consultation_id, sequence_number, event_type, actor_id, actor_type, payload_snapshot, previous_hash, current_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
      consultationId,
      sequenceNumber,
      eventType,
      actorId,
      actorType,
      JSON.stringify(payloadSnapshot),
      previousHash,
      currentHash,
      createdAt,
    ];

    const { rows } = await db.query(insertQuery, values);
    return rows[0];
  }

  /**
   * Verify the cryptographic integrity of the entire ledger chain for a consultation
   */
  async verifyChain(consultationId) {
    const { rows } = await db.query(
      `SELECT * FROM consultation_audit_ledger 
       WHERE consultation_id = $1 
       ORDER BY sequence_number ASC;`,
      [consultationId]
    );

    if (rows.length === 0) {
      return { valid: true, count: 0, message: 'Ledger is empty for this consultation' };
    }

    for (let i = 0; i < rows.length; i++) {
      const block = rows[i];
      const expectedSeq = i + 1;

      // 1. Check sequence monotonicity
      if (block.sequence_number !== expectedSeq) {
        return {
          valid: false,
          brokenAtSequence: block.sequence_number,
          reason: `Sequence gap or mismatch: expected ${expectedSeq}, got ${block.sequence_number}`,
        };
      }

      // 2. Check previous hash linkage
      const expectedPrevHash = i === 0 ? GENESIS_PREV_HASH : rows[i - 1].current_hash;
      if (block.previous_hash !== expectedPrevHash) {
        return {
          valid: false,
          brokenAtSequence: block.sequence_number,
          reason: `Previous hash mismatch: expected ${expectedPrevHash}, got ${block.previous_hash}`,
        };
      }

      // 3. Recompute and verify current block hash
      const recomputedHash = this.computeHash({
        previousHash: block.previous_hash,
        sequenceNumber: block.sequence_number,
        eventType: block.event_type,
        actorId: block.actor_id,
        actorType: block.actor_type,
        createdAt: block.created_at,
        payloadSnapshot: typeof block.payload_snapshot === 'string'
          ? JSON.parse(block.payload_snapshot)
          : block.payload_snapshot,
      });

      if (block.current_hash !== recomputedHash) {
        return {
          valid: false,
          brokenAtSequence: block.sequence_number,
          reason: `Hash mismatch at sequence ${block.sequence_number}: expected ${recomputedHash}, got ${block.current_hash} (tampered payload or metadata)`,
        };
      }
    }

    return {
      valid: true,
      count: rows.length,
      headHash: rows[rows.length - 1].current_hash,
    };
  }

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

