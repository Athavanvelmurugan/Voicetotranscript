const db = require('../../db/connection');

class DirectoryRepository {
  // ─── DOCTORS (USERS) ────────────────────────────────────────────────────────
  async getDoctors() {
    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.created_at,
        COUNT(c.id)::int AS consultation_count
      FROM users u
      LEFT JOIN consultations c ON c.doctor_id = u.id
      GROUP BY u.id
      ORDER BY u.id ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  async findDoctorById(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1;', [id]);
    return rows[0] || null;
  }

  async createDoctor({ name, email, role = 'veterinarian' }) {
    const query = `
      INSERT INTO users (name, email, role)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [name.trim(), email.trim().toLowerCase(), role.trim()]);
    return rows[0];
  }

  async deleteDoctor(id) {
    const checkQuery = `SELECT COUNT(*)::int AS count FROM consultations WHERE doctor_id = $1;`;
    const checkRes = await db.query(checkQuery, [id]);
    const consultCount = checkRes.rows[0].count;

    if (consultCount > 0) {
      const err = new Error(`Cannot delete doctor #${id} because they have ${consultCount} assigned consultation(s). Please reassign or delete those consultations first.`);
      err.statusCode = 400;
      throw err;
    }

    const { rows } = await db.query('DELETE FROM users WHERE id = $1 RETURNING *;', [id]);
    if (rows.length === 0) {
      const err = new Error(`Doctor #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }

  // ─── PETS (PATIENTS) ────────────────────────────────────────────────────────
  async getPets() {
    const query = `
      SELECT 
        p.*,
        COUNT(c.id)::int AS consultation_count
      FROM pets p
      LEFT JOIN consultations c ON c.pet_id = p.id
      GROUP BY p.id
      ORDER BY p.id ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  async findPetById(id) {
    const { rows } = await db.query('SELECT * FROM pets WHERE id = $1;', [id]);
    return rows[0] || null;
  }

  async createPet({ name, species, breed = '', age_years = null, weight_kg = null, owner_name, owner_contact = '' }) {
    const query = `
      INSERT INTO pets (name, species, breed, age_years, weight_kg, owner_name, owner_contact)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      name.trim(),
      species.trim(),
      breed ? breed.trim() : null,
      age_years !== null && age_years !== '' ? parseFloat(age_years) : null,
      weight_kg !== null && weight_kg !== '' ? parseFloat(weight_kg) : null,
      owner_name ? owner_name.trim() : 'Pet Owner',
      owner_contact ? owner_contact.trim() : null,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async deletePet(id) {
    // Due to ON DELETE CASCADE on consultations.pet_id, associated consultations will also be cleanly removed
    const { rows } = await db.query('DELETE FROM pets WHERE id = $1 RETURNING *;', [id]);
    if (rows.length === 0) {
      const err = new Error(`Pet #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }

  // ─── CONSULTATION DELETION (FOR CLEARING TEST SESSIONS) ──────────────────────
  async deleteConsultation(id) {
    const { rows } = await db.query('DELETE FROM consultations WHERE id = $1 RETURNING *;', [id]);
    if (rows.length === 0) {
      const err = new Error(`Consultation #${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }
}

module.exports = new DirectoryRepository();

