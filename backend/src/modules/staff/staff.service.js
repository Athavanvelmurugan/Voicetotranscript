const repo = require('./staff.repository');
const { logAuditEvent } = require('../audit-viewer/audit.event.logger');
const authService = require('../auth/auth.service');
const bcrypt = require('bcryptjs');
const db = require('../../db/connection');

class StaffService {
  async getStaff(clinicId, options = {}) {
    return repo.getStaff(clinicId, options);
  }

  async getDoctorPatients(clinicId, doctorId, options = {}) {
    return repo.getDoctorPatients(clinicId, doctorId, options);
  }

  async updateRole(clinicId, staffId, newRole, actorId, reqInfo = {}) {
    const updated = await repo.updateRole(clinicId, staffId, newRole);
    if (!updated) {
      const err = new Error('Staff member not found.');
      err.statusCode = 404;
      throw err;
    }

    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'staff_role_updated',
      targetType: 'user',
      targetId: staffId,
      metadata: { newRole },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async deactivateStaff(clinicId, staffId, actorId, reqInfo = {}) {
    if (staffId === actorId) {
      const err = new Error('You cannot deactivate your own administrator account.');
      err.statusCode = 400;
      throw err;
    }

    const updated = await repo.setStatus(clinicId, staffId, 'deactivated');
    if (!updated) {
      const err = new Error('Staff member not found.');
      err.statusCode = 404;
      throw err;
    }

    // Revoke all active sessions immediately
    await authService.logoutAll(staffId);

    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'staff_deactivated',
      targetType: 'user',
      targetId: staffId,
      metadata: { previousStatus: 'active', newStatus: 'deactivated' },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async reactivateStaff(clinicId, staffId, actorId, reqInfo = {}) {
    const updated = await repo.setStatus(clinicId, staffId, 'active');
    if (!updated) {
      const err = new Error('Staff member not found.');
      err.statusCode = 404;
      throw err;
    }

    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'staff_reactivated',
      targetType: 'user',
      targetId: staffId,
      metadata: { newStatus: 'active' },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async approveLicense(clinicId, staffId, actorId, reqInfo = {}) {
    const updated = await repo.approveLicense(clinicId, staffId);
    if (!updated) {
      const err = new Error('Staff member not found.');
      err.statusCode = 404;
      throw err;
    }

    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'license_approved',
      targetType: 'user',
      targetId: staffId,
      metadata: { licenseNumber: updated.license_number, status: 'active' },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async onboardDoctor(clinicId, doctorData, actorId, reqInfo = {}) {
    const { name, email, password, phone, licenseNumber, specialty, autoVerifyLicense = true } = doctorData;

    if (!name || !name.trim()) {
      const err = new Error('Doctor name is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!email || !email.trim() || !email.includes('@')) {
      const err = new Error('A valid professional email is required.');
      err.statusCode = 400;
      throw err;
    }
    const cleanEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE email = $1;', [cleanEmail]);
    if (existing.rows.length > 0) {
      const err = new Error(`A user with email ${cleanEmail} is already registered in the system.`);
      err.statusCode = 409;
      throw err;
    }

    const plainPassword = password && password.trim().length >= 8 ? password.trim() : 'PetCareDoctor123!';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = await repo.createDoctor({
      clinicId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      phone: phone ? phone.trim() : null,
      licenseNumber: licenseNumber ? licenseNumber.trim() : null,
      specialty: specialty ? specialty.trim() : null,
      autoVerifyLicense: autoVerifyLicense !== false,
    });

    await logAuditEvent({
      clinicId,
      actorUserId: actorId,
      action: 'doctor_onboarded',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        doctorId: user.id,
        doctorName: user.name,
        doctorEmail: user.email,
        licenseNumber: user.license_number,
        specialty: user.specialty,
        autoVerified: autoVerifyLicense !== false,
      },
      ip: reqInfo.ip,
      userAgent: reqInfo.userAgent,
    });

    return {
      ...user,
      initialPassword: plainPassword,
    };
  }
}

module.exports = new StaffService();
