const db = require('../../db/connection');

class SettingsRepository {
  async getSettings(clinicId) {
    const query = `
      SELECT 
        cs.*,
        c.name AS clinic_name,
        c.slug AS clinic_slug
      FROM clinic_settings cs
      JOIN clinics c ON c.id = cs.clinic_id
      WHERE cs.clinic_id = $1;
    `;
    const { rows } = await db.query(query, [clinicId]);
    if (rows[0]) return rows[0];

    // If no row exists yet, insert default
    const insertQuery = `
      INSERT INTO clinic_settings (clinic_id)
      VALUES ($1)
      ON CONFLICT (clinic_id) DO NOTHING
      RETURNING *;
    `;
    await db.query(insertQuery, [clinicId]);
    const res = await db.query(query, [clinicId]);
    return res.rows[0];
  }

  async updateSettings(clinicId, fields) {
    const allowed = ['working_hours', 'slot_duration_min', 'buffer_min', 'branding', 'audio_retention_days'];
    const sets = [];
    const values = [clinicId];
    let idx = 2;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        if (key === 'working_hours' || key === 'branding') {
          values.push(JSON.stringify(fields[key]));
        } else {
          values.push(fields[key]);
        }
      }
    }

    if (sets.length === 0) return this.getSettings(clinicId);

    sets.push(`updated_at = NOW()`);

    const query = `
      UPDATE clinic_settings
      SET ${sets.join(', ')}
      WHERE clinic_id = $1
      RETURNING *;
    `;
    await db.query(query, values);
    return this.getSettings(clinicId);
  }
}

module.exports = new SettingsRepository();

