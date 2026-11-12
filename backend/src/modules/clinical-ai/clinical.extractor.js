const db = require('../../db/connection');
const config = require('../../config');
const { ClinicalExtractionSchema } = require('./clinical.schemas');
const ClinicalPromptBuilder = require('./clinical.prompt.builder');
const auditService = require('../audit/audit.service');

class ClinicalExtractor {
  async extractAndValidate(consultation, transcriptText) {
    const startTime = Date.now();
    let rawJson = null;
    let modelUsed = 'clinical-fallback-parser';

    // 1. Check if Groq API Key is provided
    const hasLiveGroq = config.groq?.apiKey && !config.groq.apiKey.startsWith('mock');
    // 2. Check if OpenAI API Key is provided
    const hasLiveOpenAI = config.openai?.apiKey && !config.openai.apiKey.startsWith('mock');

    if (hasLiveGroq) {
      modelUsed = config.groq.llmModel || 'openai/gpt-oss-120b';
      try {
        rawJson = await this.callGroqLLM(consultation, transcriptText, modelUsed);
        console.log(`[ClinicalAI] ✅ Successfully extracted clinical JSON using Groq (${modelUsed})`);
      } catch (err) {
        console.warn(`[ClinicalAI] Groq primary model (${modelUsed}) failed: ${err.message}. Trying secondary Groq model...`);
        const secondaryModel = modelUsed === 'openai/gpt-oss-120b' ? 'qwen/qwen3.8-27b' : 'openai/gpt-oss-120b';
        try {
          rawJson = await this.callGroqLLM(consultation, transcriptText, secondaryModel);
          modelUsed = secondaryModel;
          console.log(`[ClinicalAI] ✅ Successfully extracted clinical JSON using Groq secondary (${modelUsed})`);
        } catch (secondaryErr) {
          console.warn('[ClinicalAI] Groq secondary model also failed:', secondaryErr.message);
          rawJson = this.generateFallbackExtraction(consultation, transcriptText);
          modelUsed = 'clinical-fallback-parser';
        }
      }
    } else if (hasLiveOpenAI) {
      try {
        modelUsed = config.openai.model;
        rawJson = await this.callOpenAI(consultation, transcriptText);
      } catch (err) {
        console.warn('[ClinicalAI] OpenAI API error, using safe fallback parser:', err.message);
        rawJson = this.generateFallbackExtraction(consultation, transcriptText);
        modelUsed = 'clinical-fallback-parser';
      }
    } else {
      rawJson = this.generateFallbackExtraction(consultation, transcriptText);
      modelUsed = 'clinical-fallback-parser';
    }

    // Normalize LLM output to match ClinicalExtractionSchema contract defensively
    const normalizedJson = this.normalizeExtractionJson(rawJson, consultation);

    // Formulary Safety Intercept Engine: Check critical contraindications & drug interactions
    const safetyResult = this.validateSafetyContraindications(normalizedJson, consultation);

    // Validate strictly against Zod Schema
    const validationResult = ClinicalExtractionSchema.safeParse(normalizedJson);
    const isExtractionUnavailable = rawJson?.status === 'extraction_unavailable';
    const isValid = validationResult.success && !safetyResult.hasFatalContraindication && !isExtractionUnavailable;
    const validatedData = validationResult.success ? validationResult.data : normalizedJson;
    const validationErrors = validationResult.success ? [] : validationResult.error.errors;
    if (safetyResult.hasFatalContraindication) {
      validationErrors.push({
        path: ['medications'],
        message: 'Lethal contraindication intercepted: Paracetamol in feline patient.',
      });
    }
    if (isExtractionUnavailable) {
      validationErrors.push({
        path: ['extraction'],
        message: 'Clinical extraction unavailable due to upstream LLM service interruption.',
      });
    }
    const processingMs = Date.now() - startTime;

    // Persist to clinical_extractions table
    const query = `
      INSERT INTO clinical_extractions (
        consultation_id, status, model_used,
        pet_info, chief_complaints, symptoms, medical_history, allergies,
        vitals, observations, diagnoses, medications, lab_tests, follow_up,
        missing_info, contradictions, raw_extraction, validation_errors, processing_ms, clinic_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        COALESCE($20::int, (SELECT clinic_id FROM consultations WHERE id = $1), 1)
      )
      ON CONFLICT (consultation_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        model_used = EXCLUDED.model_used,
        pet_info = EXCLUDED.pet_info,
        chief_complaints = EXCLUDED.chief_complaints,
        symptoms = EXCLUDED.symptoms,
        medical_history = EXCLUDED.medical_history,
        allergies = EXCLUDED.allergies,
        vitals = EXCLUDED.vitals,
        observations = EXCLUDED.observations,
        diagnoses = EXCLUDED.diagnoses,
        medications = EXCLUDED.medications,
        lab_tests = EXCLUDED.lab_tests,
        follow_up = EXCLUDED.follow_up,
        missing_info = EXCLUDED.missing_info,
        contradictions = EXCLUDED.contradictions,
        raw_extraction = EXCLUDED.raw_extraction,
        validation_errors = EXCLUDED.validation_errors,
        processing_ms = EXCLUDED.processing_ms,
        clinic_id = COALESCE(EXCLUDED.clinic_id, clinical_extractions.clinic_id),
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [
      consultation.id,
      isValid ? 'completed' : 'needs_review',
      modelUsed,
      JSON.stringify(validatedData.pet_info || {}),
      JSON.stringify(validatedData.chief_complaints || []),
      JSON.stringify(validatedData.symptoms || []),
      JSON.stringify(validatedData.medical_history || {}),
      JSON.stringify(validatedData.allergies || []),
      JSON.stringify(validatedData.vitals || {}),
      JSON.stringify(validatedData.observations || []),
      JSON.stringify(validatedData.diagnoses || []),
      JSON.stringify(validatedData.medications || []),
      JSON.stringify(validatedData.lab_tests || []),
      JSON.stringify(validatedData.follow_up || {}),
      JSON.stringify(validatedData.missing_info || []),
      JSON.stringify(validatedData.contradictions || []),
      JSON.stringify(rawJson),
      JSON.stringify(validationErrors),
      processingMs,
      consultation.clinic_id || null,
    ];

    const { rows } = await db.query(query, values);
    const extractionRecord = rows[0];

    await auditService.log({
      consultationId: consultation.id,
      actorType: 'ai',
      action: 'clinical_extraction_completed',
      entityType: 'clinical_extraction',
      entityId: extractionRecord.id,
      afterState: { status: extractionRecord.status, modelUsed },
    });

    // Also append to the tamper-evident cryptographic audit ledger
    if (consultation && consultation.id) {
      await auditService.logChainedEvent({
        consultationId: consultation.id,
        eventType: safetyResult.hasSafetyAlert ? 'CLINICAL_EXTRACTION_SAFETY_ALERT' : 'CLINICAL_EXTRACTION_COMPLETED',
        actorType: 'ai',
        payloadSnapshot: {
          extractionId: extractionRecord.id,
          status: extractionRecord.status,
          modelUsed,
          hasFatalContraindication: safetyResult.hasFatalContraindication,
          hasHighRiskInteraction: safetyResult.hasHighRiskInteraction,
          alerts: safetyResult.alerts,
        },
      }).catch((err) => console.warn('[AuditLedger] Failed to append chained event:', err.message));
    }

    return extractionRecord;
  }

  async callGroqLLM(consultation, transcriptText, modelOverride = null) {
    const systemPrompt = ClinicalPromptBuilder.buildSystemPrompt();
    const userPrompt = ClinicalPromptBuilder.buildUserPrompt(consultation, transcriptText);
    const chosenModel = modelOverride || config.groq.llmModel || 'openai/gpt-oss-120b';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.groq.apiKey}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq LLM API responded with ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  }

  async callOpenAI(consultation, transcriptText) {
    const systemPrompt = ClinicalPromptBuilder.buildSystemPrompt();
    const userPrompt = ClinicalPromptBuilder.buildUserPrompt(consultation, transcriptText);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API responded with ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  }

  generateFallbackExtraction(consultation, transcriptText) {
    // Clinical Safety Rule: When LLM fails, NEVER fabricate symptoms, observations, diagnoses, or medications!
    return {
      status: 'extraction_unavailable',
      clinical_summary: 'Automated clinical extraction unavailable due to upstream LLM service interruption. Please review raw transcript manually.',
      pet_info: {
        name: consultation?.pet_name || 'Unrecorded',
        species: consultation?.pet_species || 'Unrecorded',
        breed: consultation?.pet_breed || 'Unrecorded',
        age: consultation?.pet_age ? `${consultation.pet_age} years` : 'Unrecorded',
        weight: consultation?.pet_weight ? `${consultation.pet_weight} kg` : 'Unrecorded',
      },
      chief_complaints: [],
      symptoms: [],
      medical_history: {},
      allergies: [],
      vitals: {},
      observations: [],
      diagnoses: [],
      medications: [],
      lab_tests: [],
      follow_up: {
        reason: 'Manual clinician review required.',
        monitoring_instructions: [],
        warning_signs: [],
      },
      missing_info: ['Automated LLM extraction unavailable; manual review required'],
      contradictions: [],
    };
  }

  normalizeExtractionJson(raw, consultation = {}) {
    if (!raw || typeof raw !== 'object') return {};

    const toArr = (val) => Array.isArray(val) ? val : (val && typeof val === 'object') ? Object.values(val) : [];

    // 1. Normalize pet_info
    const petSource = raw.pet_info || raw.patient || {};
    const pet_info = {
      name: petSource.name || consultation.pet_name || 'Patient',
      species: petSource.species || consultation.pet_species || 'Canine',
      breed: petSource.breed || consultation.pet_breed || null,
      age: petSource.age ? String(petSource.age) : (petSource.age_years ? `${petSource.age_years} years` : null),
      weight: petSource.weight ? String(petSource.weight) : (petSource.weight_kg ? `${petSource.weight_kg} kg` : null),
    };

    // 2. Normalize symptoms
    const symptoms = toArr(raw.symptoms).map((s) => {
      const symDesc = s.symptom || s.name || s.description || (typeof s === 'string' ? s : 'Unspecified symptom');
      const evidence = s.transcript_evidence || (Array.isArray(s.evidence) ? s.evidence[0] : (typeof s.evidence === 'string' ? { quote: s.evidence, speaker: 'owner' } : null));
      return {
        symptom: symDesc,
        duration: s.duration || null,
        severity: ['mild', 'moderate', 'severe', 'unspecified'].includes(s.severity) ? s.severity : 'unspecified',
        reported_by: ['owner', 'doctor', 'unknown'].includes(s.reported_by) ? s.reported_by : 'owner',
        transcript_evidence: evidence && evidence.quote ? {
          quote: String(evidence.quote),
          speaker: ['doctor', 'owner', 'laboratory', 'existing_medical_record', 'unknown'].includes(evidence.speaker) ? evidence.speaker : 'owner',
        } : undefined,
      };
    });

    // 3. Normalize observations
    const observations = toArr(raw.observations || raw.findings).map((o) => {
      const findingDesc = o.finding || o.description || o.observation || (typeof o === 'string' ? o : 'Examination finding');
      const evidence = o.transcript_evidence || (Array.isArray(o.evidence) ? o.evidence[0] : (typeof o.evidence === 'string' ? { quote: o.evidence, speaker: 'doctor' } : null));
      return {
        organ_system: o.organ_system || o.system || 'General',
        finding: findingDesc,
        is_abnormal: typeof o.is_abnormal === 'boolean' ? o.is_abnormal : false,
        transcript_evidence: evidence && evidence.quote ? {
          quote: String(evidence.quote),
          speaker: ['doctor', 'owner', 'laboratory', 'existing_medical_record', 'unknown'].includes(evidence.speaker) ? evidence.speaker : 'doctor',
        } : undefined,
      };
    });

    // 4. Normalize diagnoses
    const diagnoses = toArr(raw.diagnoses).map((d) => {
      const condition = d.condition || d.diagnosis || d.name || (typeof d === 'string' ? d : 'Clinical condition');
      const evidence = d.transcript_evidence || (Array.isArray(d.evidence) ? d.evidence[0] : (typeof d.evidence === 'string' ? { quote: d.evidence, speaker: 'doctor' } : null));
      return {
        condition,
        type: ['suspected', 'confirmed'].includes(d.type) ? d.type : 'suspected',
        clinical_reasoning: d.clinical_reasoning || d.reasoning || undefined,
        transcript_evidence: evidence && evidence.quote ? {
          quote: String(evidence.quote),
          speaker: ['doctor', 'owner', 'laboratory', 'existing_medical_record', 'unknown'].includes(evidence.speaker) ? evidence.speaker : 'doctor',
        } : undefined,
      };
    }).filter(d => d.condition && d.condition.toLowerCase() !== 'unknown' && d.condition.toLowerCase() !== 'none');

    // Auto-triage suspected syndrome if symptoms exist without formal diagnosis
    if (diagnoses.length === 0 && symptoms.length > 0) {
      const symList = symptoms.map(s => s.symptom.toLowerCase()).join(' ');
      let inferredCondition = 'Clinical Symptom Evaluation & Triage';
      if (symList.includes('stomach') || symList.includes('vomit') || symList.includes('abdom')) {
        inferredCondition = 'Acute Gastrointestinal Distress / Abdominal Pain';
      } else if (symList.includes('cough') || symList.includes('breath') || symList.includes('trachea')) {
        inferredCondition = 'Respiratory Tract Irritation / Tracheobronchitis';
      }
      diagnoses.push({
        condition: inferredCondition,
        type: 'suspected',
        clinical_reasoning: `Suspected based on reported symptoms: ${symptoms.map(s => s.symptom).join(', ')}`,
      });
    }

    // 5. Normalize medications
    const medications = toArr(raw.medications || raw.prescriptions).map((item) => {
      let m = item;
      if (typeof m === 'string' && m.trim().startsWith('{')) {
        try { m = JSON.parse(m); } catch (e) {}
      }
      const medName = m.medicine_name || m.name || m.drug || (typeof m === 'string' ? m : 'Unspecified Medication');
      const evidence = m.transcript_evidence || (Array.isArray(m.evidence) ? m.evidence[0] : (typeof m.evidence === 'string' ? { quote: m.evidence, speaker: 'doctor' } : null));
      const validRoutes = ['oral', 'topical', 'subcutaneous', 'intramuscular', 'intravenous', 'ophthalmic', 'otic', 'inhalation', 'other'];
      return {
        medicine_name: medName,
        strength: m.strength || null,
        dosage: m.dosage || m.dose || 'As directed',
        route: validRoutes.includes(m.route) ? m.route : 'oral',
        frequency: m.frequency || 'Once daily',
        duration: m.duration || 'As directed',
        special_instructions: m.special_instructions || null,
        doctor_notes: m.doctor_notes || null,
        transcript_evidence: evidence && evidence.quote ? {
          quote: String(evidence.quote),
          speaker: ['doctor', 'owner', 'laboratory', 'existing_medical_record', 'unknown'].includes(evidence.speaker) ? evidence.speaker : 'doctor',
        } : undefined,
      };
    });

    // 6. Normalize lab tests
    const lab_tests = toArr(raw.lab_tests || raw.tests).map((item) => {
      let t = item;
      if (typeof t === 'string' && t.trim().startsWith('{')) {
        try { t = JSON.parse(t); } catch (e) {}
      }
      const testName = t.test_name || t.name || (typeof t === 'string' ? t : 'Clinical diagnostic test');
      const evidence = t.transcript_evidence || (Array.isArray(t.evidence) ? t.evidence[0] : (typeof t.evidence === 'string' ? { quote: t.evidence, speaker: 'doctor' } : null));
      const validStatuses = ['discussed', 'recommended', 'ordered', 'completed'];
      const validPriorities = ['routine', 'urgent', 'stat'];
      return {
        test_name: testName,
        biomarker: t.biomarker || null,
        clinical_reason: t.clinical_reason || null,
        status: validStatuses.includes(t.status) ? t.status : 'discussed',
        priority: validPriorities.includes(t.priority) ? t.priority : 'routine',
        instructions: t.instructions || null,
        transcript_evidence: evidence && evidence.quote ? {
          quote: String(evidence.quote),
          speaker: ['doctor', 'owner', 'laboratory', 'existing_medical_record', 'unknown'].includes(evidence.speaker) ? evidence.speaker : 'doctor',
        } : undefined,
      };
    });

    // Chief complaints normalization (derive from symptoms if empty)
    let chief_complaints = toArr(raw.chief_complaints).map(String).filter(Boolean);
    if (chief_complaints.length === 0 && symptoms.length > 0) {
      chief_complaints = symptoms.map(s => s.symptom);
    }

    let clinical_summary = typeof raw.clinical_summary === 'string' && raw.clinical_summary.trim()
      ? raw.clinical_summary.trim()
      : (typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : (typeof raw.overview === 'string' && raw.overview.trim() ? raw.overview.trim() : undefined));

    if (!clinical_summary && chief_complaints.length > 0) {
      clinical_summary = `${consultation.pet_name} presented for veterinary evaluation with chief concerns: ${chief_complaints.join(', ')}.${symptoms.length > 0 ? ' Reported symptoms: ' + symptoms.map(s => s.symptom).join(', ') + '.' : ''} Patient assessed by ${consultation.doctor_name || 'veterinarian'} for clinical monitoring.`;
    }

    return {
      clinical_summary,
      pet_info,
      chief_complaints,
      symptoms,
      medical_history: raw.medical_history && typeof raw.medical_history === 'object' ? raw.medical_history : {},
      allergies: toArr(raw.allergies).map(String),
      vitals: raw.vitals && typeof raw.vitals === 'object' ? raw.vitals : {},
      observations,
      diagnoses,
      medications,
      lab_tests,
      follow_up: raw.follow_up && typeof raw.follow_up === 'object' ? raw.follow_up : {},
      missing_info: toArr(raw.missing_info).map(String),
      contradictions: toArr(raw.contradictions).map(String),
    };
  }

  /**
   * Formulary Safety Intercept Engine:
   * 1. Hard-blocks lethal feline Paracetamol orders (glucuronyl transferase deficiency)
   * 2. Intercepts concurrent NSAID + Corticosteroid orders (severe GI perforation risk)
   */
  validateSafetyContraindications(data, consultation) {
    const contradictions = Array.isArray(data.contradictions) ? [...data.contradictions] : [];
    const meds = Array.isArray(data.medications) ? data.medications : [];
    const species = String(consultation?.pet_species || data.pet_info?.species || '').toLowerCase();
    const isFeline = species.includes('cat') || species.includes('fel');

    let hasFatalContraindication = false;
    let hasHighRiskInteraction = false;
    const interceptedAlerts = [];

    // 1. Feline Paracetamol / Acetaminophen Intercept
    const paracetamolKeywords = ['paracetamol', 'acetaminophen', 'crocin', 'dolo', 'calpol', 'tylenol', 'panadol', 'pyigesic'];
    if (isFeline) {
      meds.forEach((m) => {
        const medName = String(m.medicine_name || '').toLowerCase();
        const matches = paracetamolKeywords.some((k) => medName.includes(k));
        if (matches) {
          hasFatalContraindication = true;
          const alert = `[FATAL CONTRAINDICATION INTERCEPTED] Paracetamol (${m.medicine_name}) is lethal to felines due to deficient glucuronyl transferase leading to methemoglobinemia and fatal hepatic necrosis. Auto-approval blocked.`;
          interceptedAlerts.push(alert);
          m.doctor_notes = m.doctor_notes ? `${m.doctor_notes} | BLOCKED: ${alert}` : `BLOCKED: ${alert}`;
          m.special_instructions = `CONTRAINDICATED: Do not dispense to feline patient.`;
        }
      });
    }

    // 2. Concurrent NSAID + Corticosteroid Intercept
    const nsaidKeywords = [
      'meloxicam', 'metacam', 'carprofen', 'rimadyl', 'ketoprofen', 'ketofen',
      'firocoxib', 'previcox', 'aspirin', 'ibuprofen', 'tolfenamic', 'flunixin',
      'deracoxib', 'deramaxx', 'robenacoxib', 'onsior', 'grapiprant', 'galliprant'
    ];
    const steroidKeywords = [
      'prednisolone', 'prednisone', 'dexamethasone', 'hydrocortisone', 'betamethasone',
      'triamcinolone', 'cortisone', 'depo-medrol', 'methylprednisolone', 'budesonide'
    ];

    const detectedNsaids = [];
    const detectedSteroids = [];

    meds.forEach((m) => {
      const medName = String(m.medicine_name || '').toLowerCase();
      if (nsaidKeywords.some((k) => medName.includes(k))) {
        detectedNsaids.push(m);
      }
      if (steroidKeywords.some((k) => medName.includes(k))) {
        detectedSteroids.push(m);
      }
    });

    if (detectedNsaids.length > 0 && detectedSteroids.length > 0) {
      hasHighRiskInteraction = true;
      const nsaidNames = detectedNsaids.map((m) => m.medicine_name).join(', ');
      const steroidNames = detectedSteroids.map((m) => m.medicine_name).join(', ');
      const alert = `[HIGH-RISK DRUG INTERACTION] Concurrent NSAID (${nsaidNames}) and Corticosteroid (${steroidNames}) detected. Concomitant administration induces severe gastrointestinal ulceration, hemorrhage, and acute renal failure. Requires mandatory washout or explicit clinical override.`;
      interceptedAlerts.push(alert);

      [...detectedNsaids, ...detectedSteroids].forEach((m) => {
        m.doctor_notes = m.doctor_notes
          ? `${m.doctor_notes} | WARNING: ${alert}`
          : `WARNING: ${alert}`;
      });
    }

    // Append intercepted alerts to contradictions without duplicates
    interceptedAlerts.forEach((alert) => {
      if (!contradictions.includes(alert)) {
        contradictions.push(alert);
      }
    });

    data.contradictions = contradictions;

    return {
      hasFatalContraindication,
      hasHighRiskInteraction,
      hasSafetyAlert: hasFatalContraindication || hasHighRiskInteraction,
      alerts: interceptedAlerts,
    };
  }
}

module.exports = new ClinicalExtractor();

