const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const config = require('../../config');

const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 515;
const PAGE_BODY_BOTTOM = 768;
const FOOTER_TOP_SAFE = 635;

/**
 * Normalize Unicode punctuation/whitespace to WinAnsi-safe ASCII equivalents
 * so PDFKit built-in Helvetica never renders corrupted or missing glyphs.
 */
function sanitizePdfText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF\u2022]/g, '');
}

function parseContent(rawContent) {
  if (!rawContent) return {};
  if (typeof rawContent === 'string') {
    try {
      const parsed = JSON.parse(rawContent);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return { overview: rawContent };
    }
  }
  return typeof rawContent === 'object' ? rawContent : {};
}

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  if (typeof val === 'string' && val.trim()) return [val.trim()];
  return [];
}

class PdfEngine {
  constructor() {
    this.storageDir = path.resolve(__dirname, '../../../uploads/documents');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Ensure enough vertical space remains on the current page; otherwise open a continuation page.
   */
  ensureSpace(ctx, neededHeight) {
    if (ctx.yPos + neededHeight <= PAGE_BODY_BOTTOM) return;
    ctx.doc.addPage();
    this.drawContinuationHeader(ctx);
  }

  drawContinuationHeader(ctx) {
    const { doc, clinicName, docTitle, consultationId } = ctx;
    doc
      .fillColor('#64748b')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(sanitizePdfText(`${clinicName} - OFFICIAL ${docTitle} (Consultation #${consultationId}, cont.)`), PAGE_MARGIN, 34, { width: CONTENT_WIDTH });
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.8)
      .moveTo(PAGE_MARGIN, 48)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, 48)
      .stroke();
    ctx.yPos = 58;
  }

  drawSectionHeader(ctx, title) {
    this.ensureSpace(ctx, 28);
    ctx.doc
      .fillColor('#0369a1')
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(sanitizePdfText(title), PAGE_MARGIN, ctx.yPos, { width: CONTENT_WIDTH });
    ctx.yPos += 14;
  }

  drawParagraph(ctx, text, { indent = 0, fontSize = 8.8, color = '#334155', font = 'Helvetica', gapAfter = 6 } = {}) {
    const clean = sanitizePdfText(text).trim();
    if (!clean) return;
    const width = CONTENT_WIDTH - indent;
    ctx.doc.font(font).fontSize(fontSize);
    const textHeight = ctx.doc.heightOfString(clean, { width });
    this.ensureSpace(ctx, textHeight + gapAfter);
    ctx.doc
      .fillColor(color)
      .font(font)
      .fontSize(fontSize)
      .text(clean, PAGE_MARGIN + indent, ctx.yPos, { width });
    ctx.yPos += textHeight + gapAfter;
  }

  drawBulletList(ctx, items, emptyFallback = '') {
    const cleanItems = toArray(items)
      .map((item) => sanitizePdfText(item).trim())
      .filter(Boolean);

    if (cleanItems.length === 0) {
      if (emptyFallback) {
        this.drawParagraph(ctx, emptyFallback, { color: '#64748b', font: 'Helvetica-Oblique', gapAfter: 6 });
      }
      return;
    }

    for (const item of cleanItems) {
      this.drawParagraph(ctx, `\u2022 ${item}`, { indent: 8, gapAfter: 3 });
    }
    ctx.yPos += 4;
  }

  drawSectionWithBullets(ctx, title, items, emptyFallback = '') {
    const list = toArray(items).filter((i) => sanitizePdfText(i).trim());
    if (list.length === 0 && !emptyFallback) return;
    this.drawSectionHeader(ctx, title);
    this.drawBulletList(ctx, list, emptyFallback);
  }

  renderSummaryContent(ctx, content) {
    const narrative = content.clinical_narrative || content.overview || content.summary;
    if (narrative) {
      this.drawSectionHeader(ctx, 'CLINICAL OVERVIEW NARRATIVE');
      this.drawParagraph(ctx, narrative, { gapAfter: 8 });
    }

    const complaints = toArray(content.chief_complaints || content.chief_complaint || content.subjective);
    const symptomLines = toArray(content.symptoms_overview);
    if (symptomLines.length === 0 && Array.isArray(content.symptoms)) {
      for (const s of content.symptoms) {
        if (typeof s === 'string') {
          symptomLines.push(s);
        } else if (s && typeof s === 'object') {
          const name = s.symptom || s.name || s.description;
          const details = [s.duration, s.severity && s.severity !== 'unspecified' ? s.severity : null].filter(Boolean).join(', ');
          if (name) symptomLines.push(details ? `${name} (${details})` : name);
        }
      }
    }

    const combinedComplaintItems = [
      ...complaints.map((c) => `Primary complaint: ${c}`),
      ...symptomLines,
    ];
    this.drawSectionWithBullets(
      ctx,
      'CHIEF COMPLAINT & REPORTED SYMPTOMS',
      combinedComplaintItems,
      'No specific symptoms recorded.'
    );

    const examLines = toArray(content.clinical_examination_summary);
    if (examLines.length === 0 && Array.isArray(content.observations)) {
      for (const o of content.observations) {
        if (typeof o === 'string') {
          examLines.push(o);
        } else if (o && typeof o === 'object' && (o.finding || o.description)) {
          const tag = o.is_abnormal ? ' [Abnormal]' : '';
          examLines.push(`${o.finding || o.description}${tag}`);
        }
      }
    }
    if (examLines.length === 0 && (content.clinical_findings || content.objective)) {
      examLines.push(...toArray(content.clinical_findings || content.objective));
    }
    this.drawSectionWithBullets(
      ctx,
      'CLINICAL FINDINGS & PHYSICAL EXAM',
      examLines,
      'Physical examination parameters reviewed within baseline.'
    );

    const diagnosisLines = toArray(content.assessment_conclusions);
    if (Array.isArray(content.diagnoses) && content.diagnoses.length > 0) {
      for (const d of content.diagnoses) {
        if (typeof d === 'string') {
          if (!diagnosisLines.includes(d)) diagnosisLines.push(d);
        } else if (d && typeof d === 'object' && d.condition) {
          const prefix = d.type === 'confirmed' ? 'Confirmed' : 'Suspected';
          const reasoning = d.clinical_reasoning ? ` - ${d.clinical_reasoning}` : '';
          const entry = `${prefix}: ${d.condition}${reasoning}`;
          // Replace the shorter header-only summary entry when detailed reasoning exists
          const shortIdx = diagnosisLines.indexOf(`${prefix}: ${d.condition}`);
          if (shortIdx >= 0 && reasoning) {
            diagnosisLines[shortIdx] = entry;
          } else if (!diagnosisLines.includes(entry)) {
            diagnosisLines.push(entry);
          }
        }
      }
    }
    if (diagnosisLines.length === 0 && (content.diagnosis || content.assessment)) {
      diagnosisLines.push(...toArray(content.diagnosis || content.assessment));
    }
    this.drawSectionWithBullets(
      ctx,
      'DIAGNOSIS & ASSESSMENT',
      diagnosisLines,
      'Clinical assessment documented.'
    );

    const planItems = [
      ...toArray(content.prescribed_treatment_plan).map((m) => `Medication: ${m}`),
      ...toArray(content.recommended_investigations).map((l) => `Investigation: ${l}`),
    ];
    if (planItems.length === 0 && (content.treatment_plan || content.plan || content.recommendations)) {
      planItems.push(...toArray(content.treatment_plan || content.plan || content.recommendations));
    }
    this.drawSectionWithBullets(
      ctx,
      'TREATMENT PLAN & RECOMMENDED INVESTIGATIONS',
      planItems,
      'Supportive monitoring and home care advised.'
    );

    const followUpObj = content.client_instructions_and_follow_up && typeof content.client_instructions_and_follow_up === 'object'
      ? content.client_instructions_and_follow_up
      : {};
    const homeCareItems = [];
    if (content.owner_guidance) homeCareItems.push(content.owner_guidance);
    if (followUpObj.revisit) homeCareItems.push(`Recommended revisit: ${followUpObj.revisit}`);
    for (const instr of toArray(followUpObj.key_instructions)) {
      if (!content.owner_guidance || !String(content.owner_guidance).includes(String(instr))) {
        homeCareItems.push(instr);
      }
    }
    for (const warn of toArray(followUpObj.warning_signs)) {
      homeCareItems.push(`Warning sign: ${warn}`);
    }
    this.drawSectionWithBullets(ctx, 'HOME CARE, FOLLOW-UP & WARNING SIGNS', homeCareItems);

    if (Array.isArray(content.missing_information_alert) && content.missing_information_alert.length > 0) {
      this.drawSectionWithBullets(ctx, 'CLINICAL CLARIFICATIONS TO FOLLOW UP', content.missing_information_alert);
    }
  }

  renderPrescriptionContent(ctx, content) {
    this.drawSectionHeader(ctx, 'PRESCRIPTION & MEDICATION ORDERS (Rx)');

    const allergies = toArray(content.allergies_noted).filter(Boolean);
    if (allergies.length > 0) {
      this.drawParagraph(ctx, `Allergies Noted: ${allergies.join(', ')}`, { font: 'Helvetica-Bold', color: '#991b1b', gapAfter: 6 });
    }

    const medications = Array.isArray(content.items)
      ? content.items
      : toArray(content.medications);

    if (medications.length === 0) {
      this.drawParagraph(ctx, 'No medications prescribed during this consultation.', {
        color: '#64748b',
        font: 'Helvetica-Oblique',
        gapAfter: 10,
      });
    } else {
      // Rx Table Header
      this.ensureSpace(ctx, 28);
      ctx.doc.rect(PAGE_MARGIN, ctx.yPos, CONTENT_WIDTH, 20).fill('#f8fafc');
      ctx.doc
        .fillColor('#475569')
        .fontSize(8.2)
        .font('Helvetica-Bold')
        .text('MEDICATION & FORM', 48, ctx.yPos + 6, { width: 155 })
        .text('DOSAGE & ROUTE', 210, ctx.yPos + 6, { width: 120 })
        .text('FREQUENCY', 338, ctx.yPos + 6, { width: 100 })
        .text('DURATION', 446, ctx.yPos + 6, { width: 100 });
      ctx.yPos += 25;

      for (const med of medications) {
        if (typeof med === 'string') {
          this.drawParagraph(ctx, `\u2022 ${med}`, { indent: 6, gapAfter: 4 });
          continue;
        }
        const medName = sanitizePdfText([med.medicine_name || med.name || med.drug_name || 'Medication', med.strength].filter(Boolean).join(' '));
        const doseRoute = sanitizePdfText([med.dosage || med.dose || 'Standard dose', med.route].filter(Boolean).join(' / '));
        const freq = sanitizePdfText(med.frequency || 'As directed');
        const dur = sanitizePdfText(med.duration || 'As directed');
        const notes = sanitizePdfText(med.special_instructions || med.instructions || med.notes || med.doctor_notes || '').trim();

        ctx.doc.font('Helvetica-Bold').fontSize(8.8);
        const h1 = ctx.doc.heightOfString(medName, { width: 155 });
        ctx.doc.font('Helvetica').fontSize(8.8);
        const h2 = ctx.doc.heightOfString(doseRoute, { width: 120 });
        const h3 = ctx.doc.heightOfString(freq, { width: 100 });
        const h4 = ctx.doc.heightOfString(dur, { width: 100 });
        const rowH = Math.max(h1, h2, h3, h4, 12);

        this.ensureSpace(ctx, rowH + (notes ? 18 : 8));
        ctx.doc
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .fontSize(8.8)
          .text(medName, 48, ctx.yPos, { width: 155 })
          .font('Helvetica')
          .text(doseRoute, 210, ctx.yPos, { width: 120 })
          .text(freq, 338, ctx.yPos, { width: 100 })
          .text(dur, 446, ctx.yPos, { width: 100 });

        ctx.yPos += rowH + 4;
        if (notes && notes.toLowerCase() !== 'none noted') {
          this.drawParagraph(ctx, `Note: ${notes}`, { indent: 12, fontSize: 8, color: '#64748b', font: 'Helvetica-Oblique', gapAfter: 6 });
        } else {
          ctx.yPos += 4;
        }
      }
    }

    const dispenseText = content.dispense_instructions || content.dispense_notes || content.instructions;
    if (dispenseText) {
      this.drawSectionHeader(ctx, 'DISPENSING & ADMINISTRATION INSTRUCTIONS');
      this.drawParagraph(ctx, dispenseText, { gapAfter: 8 });
    }
  }

  renderLabTestsContent(ctx, content) {
    this.drawSectionHeader(ctx, 'LABORATORY INVESTIGATIONS & BIOMARKERS');

    if (content.counts && typeof content.counts === 'object') {
      const countsSummary = [
        `Total: ${content.counts.total ?? 0}`,
        `Ordered: ${content.counts.ordered ?? 0}`,
        `Recommended: ${content.counts.recommended ?? 0}`,
        `Discussed: ${content.counts.discussed ?? 0}`,
        `Completed: ${content.counts.completed ?? 0}`,
      ].join('  |  ');
      this.drawParagraph(ctx, countsSummary, { font: 'Helvetica-Bold', fontSize: 8.3, color: '#475569', gapAfter: 8 });
    }

    const tests = toArray(content.tests);
    if (tests.length === 0) {
      this.drawParagraph(ctx, 'No laboratory tests ordered or discussed during this consultation.', {
        color: '#64748b',
        font: 'Helvetica-Oblique',
        gapAfter: 8,
      });
      return;
    }

    tests.forEach((t, idx) => {
      if (typeof t === 'string') {
        this.drawParagraph(ctx, `${idx + 1}. ${t}`, { gapAfter: 4 });
        return;
      }
      const status = String(t.status || 'discussed').toUpperCase();
      const priority = String(t.priority || 'routine').toUpperCase();
      const titleLine = `${t.item_number || idx + 1}. ${t.test_name || 'Diagnostic Test'} [${status} - ${priority}]`;
      this.drawParagraph(ctx, titleLine, { font: 'Helvetica-Bold', color: '#0f172a', gapAfter: 2 });
      const details = [
        t.biomarker && t.biomarker !== 'N/A' ? `Biomarker: ${t.biomarker}` : null,
        t.clinical_reason ? `Clinical reason: ${t.clinical_reason}` : null,
        t.instructions ? `Instructions: ${t.instructions}` : null,
      ].filter(Boolean);
      for (const line of details) {
        this.drawParagraph(ctx, line, { indent: 12, fontSize: 8.3, color: '#475569', gapAfter: 2 });
      }
      ctx.yPos += 4;
    });
  }

  renderSoapNotesContent(ctx, content) {
    const subj = content.S || content.subjective || {};
    const obj = content.O || content.objective || {};
    const assess = content.A || content.assessment || {};
    const plan = content.P || content.plan || {};

    const subjItems = [];
    if (typeof subj === 'string') {
      subjItems.push(subj);
    } else {
      if (subj.chief_complaint) subjItems.push(`Chief complaint: ${subj.chief_complaint}`);
      for (const s of toArray(subj.reported_symptoms)) {
        if (typeof s === 'string') subjItems.push(s);
        else if (s?.symptom) subjItems.push(`${s.symptom}${s.duration ? ` (${s.duration})` : ''}`);
      }
      if (toArray(subj.allergies).length) subjItems.push(`Allergies: ${toArray(subj.allergies).join(', ')}`);
    }
    this.drawSectionWithBullets(ctx, 'S - SUBJECTIVE', subjItems, 'No subjective findings recorded.');

    const objItems = [];
    if (typeof obj === 'string') {
      objItems.push(obj);
    } else {
      if (obj.vitals && typeof obj.vitals === 'object') {
        const vitalsList = Object.entries(obj.vitals)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
        if (vitalsList.length) objItems.push(`Vitals: ${vitalsList.join(', ')}`);
      }
      for (const o of toArray(obj.physical_examination)) {
        if (typeof o === 'string') objItems.push(o);
        else if (o?.finding) objItems.push(`${o.system ? `${o.system}: ` : ''}${o.finding}${o.is_abnormal ? ' [Abnormal]' : ''}`);
      }
    }
    this.drawSectionWithBullets(ctx, 'O - OBJECTIVE', objItems, 'Physical examination within baseline.');

    const assessItems = [];
    if (typeof assess === 'string') {
      assessItems.push(assess);
    } else {
      for (const d of toArray(assess.primary_diagnoses)) {
        assessItems.push(`Confirmed: ${typeof d === 'string' ? d : d.condition}`);
      }
      for (const d of toArray(assess.differential_diagnoses)) {
        assessItems.push(typeof d === 'string' ? `Suspected: ${d}` : `Suspected: ${d.condition}${d.reasoning ? ` - ${d.reasoning}` : ''}`);
      }
      if (assess.clinical_notes) assessItems.push(`Notes: ${assess.clinical_notes}`);
    }
    this.drawSectionWithBullets(ctx, 'A - ASSESSMENT', assessItems, 'Clinical assessment documented.');

    const planItems = [];
    if (typeof plan === 'string') {
      planItems.push(plan);
    } else {
      toArray(plan.medications).forEach((m) => planItems.push(`Medication: ${m}`));
      toArray(plan.diagnostic_workup).forEach((t) => planItems.push(`Diagnostic: ${t}`));
      if (plan.follow_up) planItems.push(`Follow-up: ${plan.follow_up}`);
      toArray(plan.client_education).forEach((e) => planItems.push(`Client education: ${e}`));
      toArray(plan.emergency_red_flags).forEach((w) => planItems.push(`Red flag: ${w}`));
    }
    this.drawSectionWithBullets(ctx, 'P - PLAN', planItems, 'Supportive care plan provided.');
  }

  renderFollowUpContent(ctx, content) {
    this.drawSectionHeader(ctx, 'FOLLOW-UP & MONITORING PLAN');
    if (content.follow_up_timeframe) {
      this.drawParagraph(ctx, `Recommended Timeframe: ${content.follow_up_timeframe}`, { font: 'Helvetica-Bold', gapAfter: 4 });
    }
    if (content.recommended_date) {
      this.drawParagraph(ctx, `Target Date: ${content.recommended_date}`, { gapAfter: 4 });
    }
    if (content.reason_for_revisit) {
      this.drawParagraph(ctx, `Reason for Revisit: ${content.reason_for_revisit}`, { gapAfter: 8 });
    }

    this.drawSectionWithBullets(ctx, 'HOME CARE & MONITORING INSTRUCTIONS', content.home_care_and_monitoring);
    this.drawSectionWithBullets(ctx, 'EMERGENCY WARNING SIGNS (RED FLAGS)', content.warning_signs_red_flags);

    if (content.next_appointment_action) {
      this.drawSectionHeader(ctx, 'NEXT APPOINTMENT ACTION');
      this.drawParagraph(ctx, content.next_appointment_action, { gapAfter: 8 });
    }
  }

  renderGenericContent(ctx, content) {
    for (const [key, val] of Object.entries(content)) {
      if (val === null || val === undefined || key === 'doc_type' || key === 'patient') continue;
      if (Array.isArray(val) && val.length === 0) continue;
      this.drawSectionHeader(ctx, key.replace(/_/g, ' ').toUpperCase());
      if (Array.isArray(val)) {
        this.drawBulletList(ctx, val.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))));
      } else if (typeof val === 'object') {
        this.drawParagraph(ctx, JSON.stringify(val, null, 2), { gapAfter: 6 });
      } else {
        this.drawParagraph(ctx, String(val), { gapAfter: 6 });
      }
    }
  }

  renderAttestationAndFooter(ctx, { doctor, ledgerHash, qrBuffer, verifyUrl }) {
    const { doc } = ctx;
    // Keep the entire 150pt attestation + QR + security footer cleanly above A4 bottom margin (801pt)
    if (ctx.yPos > FOOTER_TOP_SAFE - 10) {
      doc.addPage();
      this.drawContinuationHeader(ctx);
    }

    const footerY = FOOTER_TOP_SAFE;
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(PAGE_MARGIN, footerY)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, footerY)
      .stroke();

    doc
      .fillColor('#0f172a')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('ATTENDING VETERINARIAN AUTHORIZATION', PAGE_MARGIN, footerY + 10)
      .font('Helvetica')
      .fontSize(8.5)
      .text(sanitizePdfText(`Clinician: ${doctor.name || 'Attending Doctor'}`), PAGE_MARGIN, footerY + 24)
      .text(sanitizePdfText(`State Veterinary Medical License: ${doctor.license_number || 'VET-ACTIVE-AUTH'}`), PAGE_MARGIN, footerY + 36)
      .text(`Electronically Authenticated & Sealed on ${new Date().toISOString()}`, PAGE_MARGIN, footerY + 48);

    doc.image(qrBuffer, 445, footerY + 8, { width: 95, height: 95 });

    // Security watermark bar kept strictly inside 748..786 (well above 801.89pt A4 bottom margin)
    const barY = footerY + 112; // 747
    doc
      .rect(PAGE_MARGIN, barY, CONTENT_WIDTH, 34)
      .fill('#f8fafc');

    doc
      .fillColor('#64748b')
      .fontSize(7.2)
      .font('Helvetica')
      .text(sanitizePdfText(`TAMPER-EVIDENT LEDGER HASH: ${ledgerHash}`), 48, barY + 6, { width: 499, lineBreak: false })
      .fontSize(7)
      .text(sanitizePdfText(`Scan QR code or open ${verifyUrl}`), 48, barY + 18, { width: 499, lineBreak: false });
  }

  /**
   * Generates a signed official PDF with letterhead, patient demographics, clinical details, and QR verification
   */
  async generateClinicalPdf({
    clinic = {},
    doctor = {},
    patient = {},
    owner = {},
    consultation = {},
    document = {},
    ledgerHash,
  }) {
    return new Promise(async (resolve, reject) => {
      try {
        const content = parseContent(document.content);
        const docType = document.doc_type || content.doc_type || 'clinical_record';
        const bannerTitle = sanitizePdfText(docType.replace(/_/g, ' ')).toUpperCase();
        const docTitle = sanitizePdfText(document.title || content.title || bannerTitle).toUpperCase();
        const fileName = `${docType}_${consultation.id}_${document.id}_v2_${Date.now()}.pdf`;
        const filePath = path.join(this.storageDir, fileName);

        const writeStream = fs.createWriteStream(filePath);
        const doc = new PDFDocument({
          size: 'A4',
          margin: PAGE_MARGIN,
          info: {
            Title: sanitizePdfText(`${clinic.name || 'PetCare'} - ${docTitle}`),
            Author: sanitizePdfText(doctor.name || 'Attending Veterinarian'),
            Subject: sanitizePdfText(`Clinical record for ${patient.name || 'Patient'}`),
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
        const clinicName = clinic.name || 'Central Valley Animal Hospital';
        doc
          .fillColor('#0284c7')
          .fontSize(18)
          .font('Helvetica-Bold')
          .text(sanitizePdfText(clinicName), PAGE_MARGIN, 40);

        doc
          .fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica')
          .text(sanitizePdfText(clinic.tagline || 'Veterinary Clinical Care, Surgery & Diagnostic Laboratory'), PAGE_MARGIN, 62)
          .text(sanitizePdfText(`Address: ${clinic.address || '452 Valley Parkway, Suite 100'} \u2022 Tel: ${clinic.phone || '+1 (555) 234-5678'}`), PAGE_MARGIN, 74)
          .text(sanitizePdfText(`Clinic License: ${clinic.slug || 'CV-VET-01'} \u2022 Official Medical Record`), PAGE_MARGIN, 86);

        doc
          .strokeColor('#e2e8f0')
          .lineWidth(1)
          .moveTo(PAGE_MARGIN, 102)
          .lineTo(PAGE_MARGIN + CONTENT_WIDTH, 102)
          .stroke();

        // Document Title Banner
        doc.rect(PAGE_MARGIN, 108, CONTENT_WIDTH, 26).fill('#f0f9ff');

        doc
          .fillColor('#0369a1')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(sanitizePdfText(`OFFICIAL ${bannerTitle}`), 50, 115, { width: 325, lineBreak: false });

        const visitDateStr = consultation.started_at
          ? new Date(consultation.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          : new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        doc
          .fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica')
          .text(sanitizePdfText(`Consultation #${consultation.id} \u2022 Date: ${visitDateStr}`), 375, 115, { align: 'right', width: 170 });

        // ─── 2. Patient & Owner Demographics Box ─────────────────────────────
        doc
          .rect(PAGE_MARGIN, 142, CONTENT_WIDTH, 68)
          .strokeColor('#cbd5e1')
          .lineWidth(0.8)
          .stroke();

        doc
          .fillColor('#0f172a')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('PATIENT IDENTIFICATION', 50, 150)
          .font('Helvetica')
          .text(sanitizePdfText(`Name: ${patient.name || content.patient?.name || 'Unknown'} (${patient.species || content.patient?.species || 'Canine'}, ${patient.breed || content.patient?.breed || 'Mixed'})`), 50, 164, { width: 245 })
          .text(sanitizePdfText(`Sex / Age: ${patient.sex || 'Unknown'} \u2022 ${patient.age_years ? `${patient.age_years} yrs` : (content.patient?.age || 'N/A')} \u2022 Weight: ${patient.weight_kg ? `${patient.weight_kg} kg` : (content.patient?.weight || 'N/A')}`), 50, 178, { width: 245 })
          .text(sanitizePdfText(`Microchip ID: ${patient.microchip_no || 'None on record'}`), 50, 192, { width: 245 });

        doc
          .font('Helvetica-Bold')
          .text('GUARDIAN & ATTENDING CLINICIAN', 310, 150)
          .font('Helvetica')
          .text(sanitizePdfText(`Owner: ${owner.name || patient.owner_name || content.patient?.owner || 'Pet Guardian'}`), 310, 164, { width: 235 })
          .text(sanitizePdfText(`Contact: ${owner.phone || patient.owner_contact || 'N/A'}`), 310, 178, { width: 235 })
          .text(sanitizePdfText(`Attending Vet: ${doctor.name || 'Dr. Attending'} (Reg: ${doctor.license_number || 'VET-ACTIVE'})`), 310, 192, { width: 235 });

        // ─── 3. Clinical Content Section ─────────────────────────────────────
        const ctx = {
          doc,
          clinicName,
          docTitle: bannerTitle,
          consultationId: consultation.id,
          yPos: 224,
        };

        switch (docType) {
          case 'prescription':
            this.renderPrescriptionContent(ctx, content);
            break;
          case 'lab_tests':
            this.renderLabTestsContent(ctx, content);
            break;
          case 'soap_notes':
            this.renderSoapNotesContent(ctx, content);
            break;
          case 'follow_up':
            this.renderFollowUpContent(ctx, content);
            break;
          case 'summary':
            this.renderSummaryContent(ctx, content);
            break;
          default:
            this.renderGenericContent(ctx, content);
            break;
        }

        const doctorNotes = document.doctor_notes || content.doctor_notes;
        if (doctorNotes && sanitizePdfText(doctorNotes).trim()) {
          this.drawSectionHeader(ctx, 'ATTENDING VETERINARIAN NOTES');
          this.drawParagraph(ctx, doctorNotes, { gapAfter: 8 });
        }

        // ─── 4. Doctor Attestation & Security QR Code Footer ─────────────────
        this.renderAttestationAndFooter(ctx, { doctor, ledgerHash, qrBuffer, verifyUrl });

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
