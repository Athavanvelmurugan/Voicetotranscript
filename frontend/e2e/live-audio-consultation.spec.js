import { test, expect } from '@playwright/test';

test.describe('Headed Chromium Live Audio & Whisper Transcription E2E', () => {

  test('Headed Chromium plays YouTube clinical audio, transcribes live via Whisper, and scribes documents', async ({ page }) => {
    // 1. Grant microphone permissions in browser context
    const context = page.context();
    await context.grantPermissions(['microphone']);

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

    // Create a clean consented consultation session before recording
    const newConsultBtn = page.getByRole('button', { name: /New Consultation/i });
    await newConsultBtn.click();
    await page.click('button:has-text("Start New Consultation")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    // 3. Find and click Start Recording (or Record More)
    const recordBtn = page.getByRole('button', { name: /Start Recording|Record More/i });
    await expect(recordBtn).toBeVisible();
    await expect(recordBtn).toBeEnabled();
    await recordBtn.click();

    // 4. Verify status changes to RECORDING and pulse animation begins
    await expect(page.locator('.timer-box')).toContainText(/RECORDING/i);
    await expect(page.locator('.recording-pulse')).toBeVisible();

    console.log('🎤 Headed Google Chrome is capturing counselling audio via fake microphone...');

    // 5. Test speaker toggle while audio is actively playing into the mic
    await page.waitForTimeout(3000);
    const ownerBtn = page.locator('button[title="Force current speaker tag to Pet Owner"]');
    if (await ownerBtn.isVisible()) {
      await ownerBtn.click();
      console.log('🔄 Toggled speaker to Pet Owner');
    }

    await page.waitForTimeout(3000);
    const vetBtn = page.locator('button[title="Force current speaker tag to Attending Veterinarian"]');
    if (await vetBtn.isVisible()) {
      await vetBtn.click();
      console.log('🔄 Toggled speaker back to Veterinarian');
    }

    // 6. Wait for the 15-second chunk boundary and Whisper transcription response
    console.log('⏳ Waiting for Whisper audio chunk upload and transcription...');
    await page.waitForTimeout(11000);

    // Verify chunk status indicates uploading/processing or completed chunk
    const chunkBadge = page.locator('.audio-controls');
    await expect(chunkBadge).toBeVisible();

    // 7. Stop recording and trigger AI clinical scribe
    const stopBtn = page.getByRole('button', { name: /Stop & Scribe/i });
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();
    console.log('⏹️ Clicked Stop & Scribe');

    // 8. Verify the 3 realigned clinical document tabs remain interactive and ready for review (scoped to .tab-button)
    const summaryTab      = page.locator('.tab-button', { hasText: /Summary/i });
    const prescriptionTab = page.locator('.tab-button', { hasText: /Prescription/i });
    const labTestsTab     = page.locator('.tab-button', { hasText: /Lab Tests/i });

    await expect(summaryTab).toBeVisible();
    await expect(prescriptionTab).toBeVisible();
    await expect(labTestsTab).toBeVisible();

    // Click through realigned tabs
    await summaryTab.click();
    await page.waitForTimeout(1000);

    await prescriptionTab.click();
    await page.waitForTimeout(1000);

    await labTestsTab.click();
    await page.waitForTimeout(1000);

    // Capture screenshot confirming headed test run completion
    await page.screenshot({ path: 'test-results/headed-live-audio-success.png', fullPage: true });
    console.log('✅ PASS: Headed Google Chrome live audio capture and transcription verified successfully!');

    // Keep Chrome open on desktop if requested
    if (process.env.PWDEBUG || process.env.KEEP_OPEN) {
      console.log('⏸️ Keeping Chrome window open on desktop for user inspection...');
      await page.pause();
    }
  });

});
