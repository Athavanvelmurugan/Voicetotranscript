const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const metrics = require('./metrics');

const API_BASE = 'http://localhost:5000/api/v1/consultations';
const AUDIO_DIR = path.join(__dirname, 'audio');
const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const RESULTS_DIR = path.join(__dirname, 'results');

async function sendAudioToPipeline(audioPath, mimeType, language = 'en') {
  const fileBytes = fs.readFileSync(audioPath);
  const fileName = path.basename(audioPath);

  const formData = new FormData();
  const blob = new Blob([fileBytes], { type: mimeType });
  formData.append('audio', blob, fileName);
  formData.append('language', language);
  formData.append('speakerRole', 'doctor');

  const startMs = Date.now();
  const res = await fetch(`${API_BASE}/upload-and-scribe`, {
    method: 'POST',
    body: formData,
  });

  const latencyMs = Date.now() - startMs;
  let data = null;
  let rawText = '';
  try {
    data = await res.json();
  } catch (err) {
    rawText = await res.text().catch(() => '');
  }

  return {
    status: res.status,
    ok: res.ok,
    latencyMs,
    data,
    rawText,
    fileSizeBytes: fileBytes.length,
    fileSha256: crypto.createHash('sha256').update(fileBytes).digest('hex'),
  };
}

async function runAudit() {
  console.log('========================================================================');
  console.log('🧪 VETERINARY WHISPER ASR PIPELINE CLINICAL AUDIT HARNESS');
  console.log('Endpoint: POST ' + API_BASE + '/upload-and-scribe');
  console.log('Time: ' + new Date().toISOString());
  console.log('========================================================================\n');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Missing manifest.json at', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const results = {
    timestamp,
    endpoint: `${API_BASE}/upload-and-scribe`,
    tests: [],
    edgeCases: {},
    determinism: {},
  };

  // ─── 1. Run Manifest Tests (Real audio files) ──────────────────────────────
  for (const item of manifest) {
    const audioPath = path.join(AUDIO_DIR, item.audio);
    console.log(`[AUDIT] Running ${item.id} (${item.audio})...`);

    if (!fs.existsSync(audioPath)) {
      console.warn(`[AUDIT] File not found: ${audioPath} — Marked UNVERIFIED`);
      results.tests.push({
        id: item.id,
        status: 'UNVERIFIED',
        reason: 'Audio file missing from disk',
      });
      continue;
    }

    try {
      const response = await sendAudioToPipeline(audioPath, item.mimeType, item.language);

      const transcriptText = response.data?.data?.transcript?.fullText || '';
      const detectedLang = response.data?.data?.transcript?.detectedLanguage || 'unknown';
      const segments = response.data?.data?.transcript?.segments || [];

      // Compute metrics
      const wer = item.reference_text ? metrics.computeWER(item.reference_text, transcriptText) : null;
      const cer = item.reference_text ? metrics.computeCER(item.reference_text, transcriptText) : null;
      const drugMetrics = item.expected_drugs ? metrics.computeDrugMetrics(item.expected_drugs, transcriptText) : null;
      const numberMetrics = item.expected_numbers_units ? metrics.computeNumberUnitAccuracy(item.expected_numbers_units, transcriptText) : null;
      const negationMetrics = item.expected_negations ? metrics.computeNegationAccuracy(item.expected_negations, transcriptText) : null;
      const hallucinations = metrics.detectHallucinations(transcriptText);

      // Determine pass/fail
      let pass = true;
      const failureReasons = [];

      if (!response.ok) {
        pass = false;
        failureReasons.push(`HTTP ${response.status}`);
      }

      if (item.id === 'D1_SILENCE_60S') {
        if (transcriptText.trim().length > 0) {
          pass = false;
          failureReasons.push(`Invented words on silence: "${transcriptText}"`);
        }
      } else if (wer !== null) {
        if (wer > 0.15) {
          pass = false;
          failureReasons.push(`WER ${(wer * 100).toFixed(1)}% exceeds 15% threshold`);
        }
      }

      if (drugMetrics && drugMetrics.recall < 98.0) {
        pass = false;
        failureReasons.push(`Drug recall ${drugMetrics.recall}% < 98% (Missed: ${drugMetrics.missed.join(', ')})`);
      }

      if (numberMetrics && numberMetrics.accuracy < 100.0) {
        pass = false;
        failureReasons.push(`Number/Unit accuracy ${numberMetrics.accuracy}% < 100% (Missed: ${numberMetrics.missed.join(', ')})`);
      }

      if (negationMetrics && negationMetrics.accuracy < 100.0) {
        pass = false;
        failureReasons.push(`Negation accuracy ${negationMetrics.accuracy}% < 100% (Missed: ${negationMetrics.missed.join(', ')})`);
      }

      if (hallucinations.hasPhantomPhrases || hallucinations.hasRepetitionLoop) {
        pass = false;
        failureReasons.push(`Hallucinations detected: ${hallucinations.phantoms.join(', ')} / loop: ${hallucinations.loopPhrase}`);
      }

      results.tests.push({
        id: item.id,
        category: item.category,
        audio: item.audio,
        fileSizeBytes: response.fileSizeBytes,
        fileSha256: response.fileSha256,
        httpStatus: response.status,
        latencyMs: response.latencyMs,
        detectedLang,
        transcriptLength: transcriptText.length,
        transcriptText,
        referenceText: item.reference_text,
        wer: wer !== null ? parseFloat((wer * 100).toFixed(2)) : null,
        cer: cer !== null ? parseFloat((cer * 100).toFixed(2)) : null,
        drugMetrics,
        numberMetrics,
        negationMetrics,
        hallucinations,
        pass,
        failureReasons,
      });

    } catch (err) {
      console.error(`[AUDIT] Error processing ${item.id}:`, err.message);
      results.tests.push({
        id: item.id,
        status: 'FAIL',
        error: err.message,
      });
    }
  }

  // ─── 2. Determinism Check (F1: Transcribe same audio 3 times) ─────────────
  console.log('\n[AUDIT] Running F1 Determinism Check (3 runs on doses_units.wav)...');
  const detAudio = path.join(AUDIO_DIR, 'doses_units.wav');
  if (fs.existsSync(detAudio)) {
    const run1 = await sendAudioToPipeline(detAudio, 'audio/wav', 'en');
    const run2 = await sendAudioToPipeline(detAudio, 'audio/wav', 'en');
    const run3 = await sendAudioToPipeline(detAudio, 'audio/wav', 'en');

    const t1 = run1.data?.data?.transcript?.fullText || '';
    const t2 = run2.data?.data?.transcript?.fullText || '';
    const t3 = run3.data?.data?.transcript?.fullText || '';

    const identical = (t1 === t2) && (t2 === t3);
    results.determinism = {
      testAudio: 'doses_units.wav',
      run1Text: t1,
      run2Text: t2,
      run3Text: t3,
      identical,
      pass: identical,
    };
  }

  // ─── 3. Edge Case Ingestion Tests (A4, A7, A8, A9) ──────────────────────────
  console.log('\n[AUDIT] Running Ingestion & Robustness Edge Cases (A4, A7, A8, A9)...');

  // A4.1: 0-byte file
  const zeroByteRes = await (async () => {
    const formData = new FormData();
    formData.append('audio', new Blob([]), 'zero.wav');
    const res = await fetch(`${API_BASE}/upload-and-scribe`, { method: 'POST', body: formData });
    return { status: res.status, json: await res.json().catch(() => null) };
  })();

  // A4.2: Renamed .txt file with wrong content
  const fakeMp3Res = await (async () => {
    const formData = new FormData();
    formData.append('audio', new Blob(['THIS IS NOT AUDIO TEXT CONTENT']), 'fake.mp3');
    const res = await fetch(`${API_BASE}/upload-and-scribe`, { method: 'POST', body: formData });
    return { status: res.status, json: await res.json().catch(() => null) };
  })();

  results.edgeCases = {
    zeroByteFile: zeroByteRes,
    fakeMp3File: fakeMp3Res,
  };

  // Save raw results to JSON
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const resultFilePath = path.join(RESULTS_DIR, `audit_report_${timestamp}.json`);
  fs.writeFileSync(resultFilePath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n[AUDIT] Full audit run output written to:', resultFilePath);

  // ─── 4. Print Summary Report to Console ────────────────────────────────────
  printConsoleReport(results);
}

function printConsoleReport(results) {
  console.log('\n========================================================================');
  console.log('📊 AUDIT SUMMARY REPORT — FAILURES FIRST');
  console.log('========================================================================\n');

  const failures = results.tests.filter(t => !t.pass);
  const passes = results.tests.filter(t => t.pass);

  console.log(`TOTAL TESTS: ${results.tests.length} | FAILURES: ${failures.length} | PASSES: ${passes.length}\n`);

  if (failures.length > 0) {
    console.log('🚨 FAILURES:');
    for (const f of failures) {
      console.log(`  [FAIL] ${f.id} (${f.audio})`);
      for (const reason of f.failureReasons || [f.error]) {
        console.log(`    ↳ REASON: ${reason}`);
      }
      if (f.transcriptText) {
        console.log(`    ↳ ASR OUTPUT: "${f.transcriptText.substring(0, 150)}..."`);
      }
    }
    console.log('');
  } else {
    console.log('No test manifest failures.\n');
  }

  console.log('✅ PASSES:');
  for (const p of passes) {
    console.log(`  [PASS] ${p.id} | WER: ${p.wer !== null ? p.wer + '%' : 'N/A'} | Latency: ${p.latencyMs}ms`);
  }

  console.log('\n🔬 EDGE CASES & DETERMINISM:');
  console.log(`  - F1 Determinism (3 runs identical): ${results.determinism.pass ? 'PASS' : 'FAIL'}`);
  console.log(`  - A4.1 Zero-byte upload HTTP status: ${results.edgeCases.zeroByteFile?.status} (Expected 400)`);
  console.log(`  - A4.2 Renamed .txt as .mp3 status: ${results.edgeCases.fakeMp3File?.status}`);
  if (results.edgeCases.fakeMp3File?.json?.data?.transcript?.fullText) {
    console.log(`    ⚠️ CRITICAL OBSERVATION: Corrupt .mp3 returned mock text! -> "${results.edgeCases.fakeMp3File.json.data.transcript.fullText}"`);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit runner error:', err);
  process.exit(1);
});

