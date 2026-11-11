const db = require('../../db/connection');
const config = require('../../config');

class NotificationService {
  /**
   * Queue and dispatch an email notification
   */
  async sendEmail({ clinicId, ownerId, recipient, subject, template, payload = {} }) {
    if (!recipient) {
      console.warn('[NotificationService] Skipped email: missing recipient address');
      return null;
    }

    // Insert into notifications queue table (SERIAL PK, NO UUID)
    const insertQuery = `
      INSERT INTO notifications (
        clinic_id, owner_id, channel, template, recipient, subject, payload, status, sent_at
      )
      VALUES ($1, $2, 'email', $3, $4, $5, $6, 'sent', NOW())
      RETURNING *;
    `;
    const values = [
      clinicId,
      ownerId || null,
      template,
      recipient.trim().toLowerCase(),
      subject,
      JSON.stringify(payload),
    ];

    const { rows } = await db.query(insertQuery, values);
    const notification = rows[0];

    // Staging console logger for instant verification without third-party email billing
    console.log(`\n=======================================================`);
    console.log(`📧 [EMAIL DISPATCHED] ID #${notification.id}`);
    console.log(`📬 To: ${recipient}`);
    console.log(`📌 Subject: ${subject}`);
    console.log(`📄 Template: ${template}`);
    console.log(`🔗 Link: ${payload.link || 'N/A'}`);
    console.log(`=======================================================\n`);

    return notification;
  }

  async sendConsentRequest({ clinicId, ownerId, recipient, ownerName, petName, consultationId }) {
    const portalUrl = `${config.frontendUrl || 'http://localhost:3000'}?portal=owner`;
    const subject = `Digital Recording Consent Request for ${petName || 'your pet'}`;
    return this.sendEmail({
      clinicId,
      ownerId,
      recipient,
      subject,
      template: 'digital_consent_request',
      payload: {
        ownerName,
        petName,
        consultationId,
        link: portalUrl,
        message: `Dr. Attending has requested your digital consent to record audio for ${petName}'s clinical visit. Please review and sign digitally in the Pet Owner Portal.`,
      },
    });
  }

  async sendDocumentsReady({ clinicId, ownerId, recipient, ownerName, petName, docTitle, shareUrl }) {
    const subject = `Official Medical Records & Prescription Ready for ${petName || 'your pet'}`;
    return this.sendEmail({
      clinicId,
      ownerId,
      recipient,
      subject,
      template: 'documents_ready',
      payload: {
        ownerName,
        petName,
        docTitle,
        link: shareUrl,
        message: `Your verified clinical summary and signed prescription for ${petName} are ready. You can download and verify the official PDF report directly.`,
      },
    });
  }

  async getOwnerNotifications(ownerId) {
    const query = `
      SELECT id, channel, template, recipient, subject, payload, status, sent_at, created_at
      FROM notifications
      WHERE owner_id = $1
      ORDER BY created_at DESC
      LIMIT 50;
    `;
    const { rows } = await db.query(query, [ownerId]);
    return rows;
  }
}

module.exports = new NotificationService();
