const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');

const pdfEngine = require('../../src/modules/pdf-generator/pdf.engine');
const SummaryBuilder = require('../../src/modules/templates/summary.builder');
const PrescriptionBuilder = require('../../src/modules/templates/prescription.builder');
const LabTestsBuilder = require('../../src/modules/templates/lab-tests.builder');
const SoapNotesBuilder = require('../../src/modules/templates/soap-notes.builder');
const FollowUpBuilder = require('../../src/modules/templates/follow-up.builder');

const createdFiles = [];

function extractPdfTextAndPages(filePath) {
  const buf = fs.readFileSync(filePath);
  const raw = buf.toString('latin1');
  const pageMatches = raw.match(/\/Type\s*\/Page\b(?!s)/g) || [];
  const chunks = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(raw)) !== null) {
    const streamBuf = Buffer.from(match[1], 'latin1');
    let decoded;
    try {
      decoded = zlib.inflateSync(streamBuf).toString('latin1');
    } catch {
      decoded = streamBuf.toString('latin1');
    }
    const tjBlocks = decoded.match(/\[[\s\S]*?\]\s*TJ|<[0-9a-fA-F]+>\s*Tj|\((?:\\.|[^\\)])*\)\s*Tj/g) || [];
    for (const block of tjBlocks) {
      const tokens = block.match(/<([0-9a-fA-F]+)>|\((?:\\.|[^\\)])*\)/g) || [];
      const lineText = tokens
        .map((token) => {
          if (token.startsWith('<') && token.endsWith('>')) {
            return Buffer.from(token.slice(1, -1), 'hex').toString('latin1');
          }
          return token.slice(1, -1).replace(/\\([()\\])/g, '$1');
        })
        .join('');
      chunks.push(lineText);
    }
  }

  return {
    pageCount: pageMatches.length,
    text: chunks.join(' ').replace(/\s+/g, ' ').trim(),
    header: buf.subarray(0, 8).toString('ascii'),
  };
}

const baseContext = {
  clinic: {
    id: 1,
    name: 'Central Valley Animal Hospital',
    slug: 'central-valley',
    address: '1044 Blossom Hill Rd, San Jose, CA',
    phone: '+1 (408) 555-0199',
  },
  doctor: { id: 1, name: 'Dr. Mouni, BVSc', license_number: 'VET-CA-88910' },
  patient: {
    id: 3,
    name: 'Ashwin',
    species: 'Canine (Dog)',
    breed: 'Golden',
    sex: 'Unknown',
    age_years: '3.0',
    weight_kg: '12.00',
    owner_name: 'Alice',
    owner_contact: '89057464262',
  },
  owner: { id: 2, name: 'Alice', phone: '89057464262' },
  consultation: {
    id: 104,
    pet_id: 3,
    pet_name: 'Ashwin',
    pet_species: 'Canine (Dog)',
    pet_breed: 'Golden',
    pet_age: '3.0',
    pet_weight: '12.00',
    doctor_id: 1,
    doctor_name: 'Dr. Mouni, BVSc',
    owner_name: 'Alice',
    owner_contact: '89057464262',
    started_at: '2026-11-12T05:30:00.000Z',
  },
  ledgerHash: 'ca8fccda4caaea11b06d7a1a8453d4ad6d2556cd17d68a743addaca24ada83ed',
};

const sampleExtraction = {
  clinical_summary:
    'Ashwin, a 3-year-old canine, presented with a three\u2011day history of frequent vomiting, anorexia, watery diarrhea, and lethargy. Acute gastroenteritis is suspected.',
  chief_complaints: ['Vomiting, loss of appetite, diarrhea, lethargy and possible dehydration'],
  symptoms: [
    { symptom: 'Frequent vomiting of yellowish liquid', duration: '3 days', severity: 'severe' },
    { symptom: 'Anorexia', duration: '3 days', severity: 'severe' },
  ],
  observations: [
    { organ_system: 'General', finding: 'Slightly elevated temperature', is_abnormal: true },
    { organ_system: 'General', finding: 'Possible dehydration', is_abnormal: true },
  ],
  diagnoses: [
    {
      type: 'suspected',
      condition: 'Acute Gastroenteritis',
      clinical_reasoning: 'Consistent vomiting, diarrhea, and mild fever.',
    },
  ],
  vitals: { temperature: '102.8 F', heart_rate: '115 bpm' },
  medications: [
    {
      medicine_name: 'Maropitant (Cerenia)',
      strength: '24 mg',
      dosage: '1 tablet',
      route: 'oral',
      frequency: 'Once daily',
      duration: '4 days',
      special_instructions: 'Give 1 hour before meal',
    },
  ],
  lab_tests: [
    {
      test_name: 'Complete Blood Count (CBC)',
      biomarker: 'WBC, RBC, Platelets',
      clinical_reason: 'Evaluate infection or inflammation',
      status: 'discussed',
      priority: 'routine',
      instructions: 'Standard blood draw',
    },
    {
      test_name: 'C\u2011reactive Protein (CRP)',
      biomarker: 'CRP',
      clinical_reason: 'Measure systemic inflammation',
      status: 'ordered',
      priority: 'urgent',
      instructions: 'Serum sample',
    },
  ],
  follow_up: {
    timeframe: '3 days',
    reason: 'Re-check hydration and vomiting resolution',
    monitoring_instructions: ['Monitor water intake and stool consistency'],
    warning_signs: ['Blood in vomitus or collapse'],
  },
  missing_info: ['Exact body temperature reading'],
};

describe('PdfEngine Clinical Content & Pagination', () => {
  after(() => {
    for (const f of createdFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('renders actual SummaryBuilder fields instead of empty fallback boilerplate', async () => {
    const summaryContent = SummaryBuilder.build(sampleExtraction, baseContext.consultation);
    const result = await pdfEngine.generateClinicalPdf({
      ...baseContext,
      document: { id: 487, doc_type: 'summary', content: summaryContent },
    });
    createdFiles.push(result.filePath);

    assert.match(result.fileName, /_v2_/);
    assert.ok(result.verifyUrl.startsWith('http://localhost:3000/verify/'));

    const { header, pageCount, text } = extractPdfTextAndPages(result.filePath);
    assert.ok(header.startsWith('%PDF-'));
    assert.equal(pageCount, 1, 'Compact clinical summary should stay on 1 page without blank Page 2 overflow');

    assert.ok(text.includes('Acute Gastroenteritis'), 'Diagnosis should be rendered');
    assert.ok(text.includes('Frequent vomiting of yellowish liquid'), 'Symptom should be rendered');
    assert.ok(text.includes('Slightly elevated temperature'), 'Abnormal finding should be rendered');
    assert.ok(text.includes('Complete Blood Count (CBC)'), 'Lab investigations should be rendered');
    assert.ok(text.includes('three-day'), 'WinAnsi sanitizer should convert U+2011 hyphen to ASCII -');
    assert.ok(text.includes('http://localhost:3000/verify/'), 'Verify URL should use port 3000');

    assert.ok(!text.includes('Clinical examination requested.'), 'Must not fall back to generic complaint placeholder');
    assert.ok(!text.includes('Physical vitals and systemic exam conducted.'), 'Must not fall back to generic exam placeholder');
    assert.ok(!text.includes('Patient stable upon clinical evaluation.'), 'Must not fall back to generic diagnosis placeholder');
  });

  it('renders PrescriptionBuilder items and never fabricates Amoxicillin when empty', async () => {
    const populatedRx = PrescriptionBuilder.build(sampleExtraction, baseContext.consultation);
    const res1 = await pdfEngine.generateClinicalPdf({
      ...baseContext,
      document: { id: 4831, doc_type: 'prescription', content: populatedRx },
    });
    createdFiles.push(res1.filePath);

    const parsed1 = extractPdfTextAndPages(res1.filePath);
    assert.equal(parsed1.pageCount, 1);
    assert.ok(parsed1.text.includes('Maropitant (Cerenia)'));
    assert.ok(parsed1.text.includes('Give 1 hour before meal'));
    assert.ok(parsed1.text.includes('Dispense exact quantity as formulated'));

    const emptyRx = PrescriptionBuilder.build({ ...sampleExtraction, medications: [] }, baseContext.consultation);
    const res2 = await pdfEngine.generateClinicalPdf({
      ...baseContext,
      document: { id: 483, doc_type: 'prescription', content: emptyRx },
    });
    createdFiles.push(res2.filePath);

    const parsed2 = extractPdfTextAndPages(res2.filePath);
    assert.ok(parsed2.text.includes('No medications prescribed during this consultation.'));
    assert.ok(!parsed2.text.includes('Amoxicillin Trihydrate'), 'Empty prescription must never invent fake medication');
  });

  it('renders LabTestsBuilder, SoapNotesBuilder, and FollowUpBuilder content completely', async () => {
    const labDoc = LabTestsBuilder.build(sampleExtraction, baseContext.consultation);
    const labPdf = await pdfEngine.generateClinicalPdf({
      ...baseContext,
      document: { id: 484, doc_type: 'lab_tests', content: labDoc },
    });
    createdFiles.push(labPdf.filePath);
    const labParsed = extractPdfTextAndPages(labPdf.filePath);
    assert.ok(labParsed.text.includes('Complete Blood Count (CBC)'));
    assert.ok(labParsed.text.includes('C-reactive Protein (CRP)'));
    assert.ok(labParsed.text.includes('Ordered: 1'));

    const soapDoc = SoapNotesBuilder.build(sampleExtraction, baseContext.consultation);
    const soapPdf = await pdfEngine.generateClinicalPdf({
      ...baseContext,
      document: { id: 485, doc_type: 'soap_notes', content: soapDoc },
    });
    createdFiles.push(soapPdf.filePath);
    const soapParsed = extractPdfTextAndPages(soapPdf.filePath);
    assert.ok(soapParsed.text.includes('102.8 F'));
    assert.ok(soapParsed.text.includes('Acute Gastroenteritis'));

    const fuDoc = FollowUpBuilder.build(sampleExtraction, baseContext.consultation);
    const fuPdf = await pdfEngine.generateClinicalPdf({
      ...baseContext,
      document: { id: 486, doc_type: 'follow_up', content: fuDoc },
    });
    createdFiles.push(fuPdf.filePath);
    const fuParsed = extractPdfTextAndPages(fuPdf.filePath);
    assert.ok(fuParsed.text.includes('3 days'));
    assert.ok(fuParsed.text.includes('Blood in vomitus or collapse'));
  });
});
