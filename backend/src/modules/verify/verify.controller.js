const verifyService = require('./verify.service');

class VerifyController {
  async verifyHash(req, res, next) {
    try {
      const { ledgerHash } = req.params;
      const result = await verifyService.verifyDocumentByHash(ledgerHash);
      if (!result.valid) {
        return res.status(404).json({
          success: false,
          verified: false,
          error: result.reason || 'Verification failed: record not found',
        });
      }
      res.json({
        success: true,
        verified: true,
        patientName: result.data.patientName,
        patientSpecies: result.data.patientSpecies,
        clinicName: result.data.clinicName,
        attendingDoctor: result.data.doctorName,
        doctorLicense: result.data.doctorLicense,
        fileSha256: result.data.sha256Digest,
        ledgerHash: result.data.ledgerHash,
        documentType: result.data.documentType,
        documentVersion: 1,
        issuedAt: result.data.signedAt,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new VerifyController();
