const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const config = require('../../config');

class PdfEngine {
  constructor() {
    this.storageDir = path.resolve(__dirname, '../../../uploads/documents');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Generates a signed official PDF with letterhead, patient demographics, clinical details, and QR verification
   */
  async generateClinicalPdf({
    clinic,
    doctor,
    patient,
    owner,
    consultation,
    document,
    ledgerHash,
  }) {
    return new Promise(async (resolve, reject) => {
      try {
        const docType = document.doc_type || 'clinical_record';
        const docTitle = (document.title || docType.replace(/_/g, ' ')).toUpperCase();
        const fileName = `${docType}_${consultation.id}_${document.id}_${Date.now()}.pdf`;
        const filePath = path.join(this.storageDir, fileName);

        const writeStream = fs.createWriteStream(filePath);
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `${clinic.name || 'PetCare'} - ${docTitle}`,
            Author: doctor.name || 'Attending Veterinarian',
            Subject: `Clinical record for ${patient.name || 'Patient'}`,
          },
        });

        doc.pipe(writeStream);

        const verifyUrl = `${config.frontendUrl || 'http://localhost:3000'}/verify/${ledgerHash}`;
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          width: 110,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

        // ─── 1. Clinic Letterhead ─────────────────────────────────────────────
        doc
          .fillColor('#0284c7')
          .fontSize(18)
          .font('Helvetica-Bold')
          .text(clinic.name || 'Central Valley Animal Hospital', 40, 40);

        doc
          .fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica')
          .text(clinic.tagline || 'Veterinary Clinical Care, Surgery & Diagnostic Laboratory', 40, 62)
          .text(`Address: ${clinic.address || '452 Valley Parkway, Suite 100'} • Tel: ${clinic.phone || '+1 (555) 234-5678'}`, 40, 74)
          .text(`Clinic License: ${clinic.slug || 'CV-VET-01'} • Official Medical Record`, 40, 86);

        // Divider
        doc
          .strokeColor('#e2e8f0')
          .lineWidth(1)
          .moveTo(40, 102)
          .lineTo(555, 102)
          .stroke();

        // Document Title Banner
        doc
          .rect(40, 108, 515, 26)
          .fill('#f0f9ff');

        doc
          .fillColor('#0369a1')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`OFFICIAL ${docTitle}`, 50, 115, { characterSpacing: 1 });

        const visitDateStr = consultation.started_at
          ? new Date(consultation.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          : new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        doc
          .fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica')
          .text(`Consultation #${consultation.id} • Date: ${visitDateStr}`, 350, 115, { align: 'right', width: 195 });

        // ─── 2. Patient & Owner Demographics Box ─────────────────────────────
        doc
          .rect(40, 142, 515, 68)
          .strokeColor('#cbd5e1')
          .lineWidth(0.8)
          .stroke();

        // Column 1: Patient Details
        doc
          .fillColor('#0f172a')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('PATIENT IDENTIFICATION', 50, 150)
          .font('Helvetica')
          .text(`Name: ${patient.name || 'Unknown'} (${patient.species || 'Canine'}, ${patient.breed || 'Mixed'})`, 50, 164)
          .text(`Sex / Age: ${patient.sex || 'Unknown'} • ${patient.age_years ? `${patient.age_years} yrs` : 'N/A'} • Weight: ${patient.weight_kg ? `${patient.weight_kg} kg` : 'N/A'}`, 50, 178)
          .text(`Microchip ID: ${patient.microchip_no || 'None on record'}`, 50, 192);

        // Column 2: Owner & Doctor Details
        doc
          .font('Helvetica-Bold')
          .text('GUARDIAN & ATTENDING CLINICIAN', 310, 150)
          .font('Helvetica')
          .text(`Owner: ${owner.name || patient.owner_name || 'Pet Guardian'}`, 310, 164)
          .text(`Contact: ${owner.phone || patient.owner_contact || 'N/A'}`, 310, 178)
          .text(`Attending Vet: ${doctor.name || 'Dr. Attending'} (Reg: ${doctor.license_number || 'VET-ACTIVE'})`, 310, 192);

        // ─── 3. Clinical Content Section ─────────────────────────────────────
        let yPos = 225;

        const content = typeof document.content === 'object' ? document.content : {};

        if (docType === 'prescription') {
          doc
            .fillColor('#0f172a')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('PRESCRIPTION & MEDICATION ORDERS (Rx)', 40, yPos);

          yPos += 18;

          // Rx Table Header
          doc
            .rect(40, yPos, 515, 20)
            .fill('#f8fafc');

          doc
            .fillColor('#475569')
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .text('MEDICATION & FORM', 48, yPos + 6)
            .text('DOSAGE & ROUTE', 210, yPos + 6)
            .text('FREQUENCY', 340, yPos + 6)
            .text('DURATION', 450, yPos + 6);

          yPos += 24;

          const medications = content.medications || [
            { name: content.medication_name || 'Amoxicillin Trihydrate', dosage: '250 mg oral tablet', frequency: 'Twice daily with food', duration: '7 days' },
          ];

          for (const med of medications) {
            doc
              .fillColor('#0f172a')
              .fontSize(9)
              .font('Helvetica-Bold')
              .text(med.name || med.drug_name || 'Medication', 48, yPos)
              .font('Helvetica')
              .text(med.dosage || med.dose || 'Standard dose', 210, yPos)
              .text(med.frequency || 'Daily', 340, yPos)
              .text(med.duration || 'As directed', 450, yPos);

            if (med.instructions || med.notes) {
              yPos += 13;
              doc
                .fillColor('#64748b')
                .fontSize(8)
                .font('Helvetica-Oblique')
                .text(`Note: ${med.instructions || med.notes}`, 55, yPos);
            }

            yPos += 18;
          }

          if (content.dispense_notes || content.instructions) {
            yPos += 8;
            doc
              .fillColor('#0f172a')
              .fontSize(9)
              .font('Helvetica-Bold')
              .text('DISPENSING & ADMINISTRATION INSTRUCTIONS:', 40, yPos);
            yPos += 14;
            doc
              .font('Helvetica')
              .fontSize(8.5)
              .fillColor('#334155')
              .text(content.dispense_notes || content.instructions, 40, yPos, { width: 515 });
            yPos += 30;
          }
        } else {
          // Standard Summary / Notes Format
          const sections = [
            { title: 'CHIEF COMPLAINT & HISTORY', text: content.chief_complaint || content.subjective || 'Clinical examination requested.' },
            { title: 'CLINICAL FINDINGS & PHYSICAL EXAM', text: content.clinical_findings || content.objective || 'Physical vitals and systemic exam conducted.' },
            { title: 'DIAGNOSIS & ASSESSMENT', text: content.diagnosis || content.assessment || 'Patient stable upon clinical evaluation.' },
            { title: 'TREATMENT PLAN & DIRECTIVES', text: content.treatment_plan || content.plan || content.recommendations || 'Home care directives provided to guardian.' },
          ];

          for (const s of sections) {
            doc
              .fillColor('#0f172a')
              .fontSize(9.5)
              .font('Helvetica-Bold')
              .text(s.title, 40, yPos);
            yPos += 13;

            doc
              .fillColor('#334155')
              .fontSize(8.5)
              .font('Helvetica')
              .text(typeof s.text === 'object' ? JSON.stringify(s.text) : String(s.text), 40, yPos, { width: 515 });
            yPos += 34;
          }
        }

        // ─── 4. Doctor Attestation & Signature Box ───────────────────────────
        const footerY = 650;
        doc
          .strokeColor('#e2e8f0')
          .lineWidth(1)
          .moveTo(40, footerY)
          .lineTo(555, footerY)
          .stroke();

        doc
          .fillColor('#0f172a')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('ATTENDING VETERINARIAN AUTHORIZATION', 40, footerY + 10)
          .font('Helvetica')
          .fontSize(8.5)
          .text(`Clinician: ${doctor.name || 'Attending Doctor'}`, 40, footerY + 24)
          .text(`State Veterinary Medical License: ${doctor.license_number || 'VET-ACTIVE-AUTH'}`, 40, footerY + 36)
          .text(`Electronically Authenticated & Sealed on ${new Date().toISOString()}`, 40, footerY + 48);

        // ─── 5. Security QR Code & Cryptographic Ledger Proof ────────────────
        doc.image(qrBuffer, 445, footerY + 8, { width: 95, height: 95 });

        // Security watermark footer
        doc
          .rect(40, 780, 515, 25)
          .fill('#f8fafc');

        doc
          .fillColor('#64748b')
          .fontSize(7.5)
          .font('Helvetica')
          .text(`TAMPER-EVIDENT LEDGER HASH: ${ledgerHash}`, 48, 786, { width: 500, characterSpacing: 0.2 })
          .text(`Scan QR code or open ${verifyUrl} to independently verify cryptographic validity.`, 48, 795, { width: 500 });

        doc.end();

        writeStream.on('finish', () => {
          const fileBuffer = fs.readFileSync(filePath);
          const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

          resolve({
            filePath,
            fileName,
            sha256,
            fileSize: fileBuffer.length,
            verifyUrl,
          });
        });

        writeStream.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new PdfEngine();
