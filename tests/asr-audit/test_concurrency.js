const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api/v1/consultations';
const AUDIO_DIR = path.join(__dirname, 'audio');

async function testConcurrency() {
  console.log('========================================================================');
  console.log('⚡ AUDITING CONCURRENT UPLOADS (G1: 10 Concurrent Requests)');
  console.log('========================================================================\n');

  const testFile = path.join(AUDIO_DIR, 'lab_terms.wav');
  const bytes = fs.readFileSync(testFile);

  const initialMem = process.memoryUsage();
  console.log('Initial Node RSS:', (initialMem.rss / 1024 / 1024).toFixed(1), 'MB');

  const promises = [];
  const startAll = Date.now();

  for (let i = 0; i < 10; i++) {
    const form = new FormData();
    form.append('audio', new Blob([bytes], { type: 'audio/wav' }), `conc_${i}.wav`);
    form.append('language', 'en');

    promises.push(
      fetch(`${API_BASE}/upload-and-scribe`, { method: 'POST', body: form })
        .then(async (res) => ({ index: i, status: res.status, ok: res.ok, json: await res.json().catch(() => null) }))
        .catch((err) => ({ index: i, error: err.message }))
    );
  }

  const results = await Promise.all(promises);
  const totalMs = Date.now() - startAll;
  const finalMem = process.memoryUsage();

  console.log(`\nCompleted 10 concurrent uploads in ${totalMs} ms`);
  console.log('Final Node RSS:', (finalMem.rss / 1024 / 1024).toFixed(1), 'MB');

  let successCount = 0;
  let failCount = 0;
  for (const r of results) {
    if (r.ok) {
      successCount++;
    } else {
      failCount++;
      console.log(`  Req #${r.index} failed: status=${r.status}`, r.json?.error || r.error);
    }
  }

  console.log(`\nResults: ${successCount}/10 succeeded, ${failCount}/10 failed.`);
  process.exit(0);
}

testConcurrency();

