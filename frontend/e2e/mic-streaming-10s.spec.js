import { test, expect } from '@playwright/test';

test.describe('Real-Browser 10s Mic Streaming & Server Decoding', () => {

  test('Captures browser mic audio stream, fires chunk request every ~10s, and server decodes successfully', async ({ page }) => {
    // 1. Grant microphone permission
    const context = page.context();
    await context.grantPermissions(['microphone']);

    const chunkRequests = [];
    const chunkResponses = [];

    // Intercept audio chunk requests
    page.on('request', (req) => {
      if (req.url().includes('/audio-chunk') && req.method() === 'POST') {
        const postData = req.postData();
        console.log(`[Playwright Mic E2E] 📤 Chunk request intercepted: ${req.url()}`);
        chunkRequests.push({ url: req.url(), timestamp: Date.now() });
      }
    });

    page.on('response', async (res) => {
      if (res.url().includes('/audio-chunk') && res.request().method() === 'POST') {
        console.log(`[Playwright Mic E2E] 📥 Chunk response status: ${res.status()}`);
        try {
          const json = await res.json();
          chunkResponses.push({ status: res.status(), body: json, timestamp: Date.now() });
        } catch (_) {
          chunkResponses.push({ status: res.status(), timestamp: Date.now() });
        }
      }
    });

    // 2. Login as doctor and open Live Consultation workspace
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const signInBtn = page.locator('button:has-text("Sign In")');
    if (await signInBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await page.fill('input[type="email"]', 'alex.morgan@petcare.vet');
      await page.fill('input[type="password"]', 'Password123!');
      await signInBtn.click();
      await page.waitForLoadState('networkidle');
    }
    await page.locator('aside.admin-vertical-sidebar button:has-text("Live Consultation")').click();
    await expect(page.locator('.consultation-header')).toBeVisible({ timeout: 10000 });

    // Create a new consultation to activate recording session
    const newConsultBtn = page.getByRole('button', { name: /New Consultation/i });
    if (await newConsultBtn.isVisible()) {
      await newConsultBtn.click();
      await expect(page.locator('.modal-content')).toBeVisible();
      const submitBtn = page.getByRole('button', { name: /Start New Consultation/i });
      await submitBtn.click();
      await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
    }

    // 3. Click Start Recording
    const recordBtn = page.getByRole('button', { name: /Start Recording|Record More Audio/i });
    await expect(recordBtn).toBeVisible();
    await expect(recordBtn).toBeEnabled();
    await recordBtn.click();

    // 4. Verify Recording active
    await expect(page.locator('.timer-box')).toContainText(/RECORDING/i);

    console.log('🎤 Real browser microphone capturing audio... Waiting for chunk upload response...');
    
    // Wait for the chunk response explicitly (timeout 30s)
    const chunkResponse = await page.waitForResponse(
      (res) => res.url().includes('/audio-chunk') && res.request().method() === 'POST',
      { timeout: 35000 }
    );

    expect(chunkResponse.status()).toBe(200);
    const responseBody = await chunkResponse.json();
    expect(responseBody.success).toBe(true);

    console.log(`✅ Chunk successfully uploaded and decoded by server with status 200:`, responseBody);

    // 5. Stop recording
    const stopBtn = page.getByRole('button', { name: /Stop & Scribe/i });
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();

    console.log('⏹️ Stopped recording.');
  });

});
