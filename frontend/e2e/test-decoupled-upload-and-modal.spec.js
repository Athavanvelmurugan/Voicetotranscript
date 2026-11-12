import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Verify Decoupled Upload, Awaiting State, and Modal Approval/Rejection Controls', async ({ page }) => {
  // 1. Navigate to consultation app, login as doctor, and open Live Consultation
  await page.goto('http://localhost:3000/');
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

  // 2. Click + New Consultation to create clean session
  await page.getByRole('button', { name: /New Consultation/i }).click();
  await page.waitForSelector('.modal-content', { state: 'visible' });
  await expect(page.locator('.modal-content select').first().locator('option').first()).toBeAttached({ timeout: 10000 });
  await page.click('button:has-text("Start New Consultation")');
  await page.waitForSelector('.modal-content', { state: 'hidden' });

  // 3. Upload audio file
  const testAudio = path.resolve(__dirname, '..', '..', 'tests', 'asr-audit', 'audio', 'negation.wav');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('label:has-text("Upload Audio")');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(testAudio);

  // 4. Verify upload animation & Whisper transcription
  await expect(page.locator('.transcript-message').first()).toBeVisible({ timeout: 20000 });

  // 5. CRITICAL ASSERTION: Modal must NOT pop open prematurely on upload
  const modal = page.locator('.insights-modal-overlay');
  await expect(modal).toHaveCount(0);

  // 6. CRITICAL ASSERTION: Right panel must show "Awaiting Synthesis" and NO Approve/Reject buttons
  await expect(page.locator('h3:has-text("Consultation Transcribed — Awaiting Synthesis")')).toBeVisible();
  await expect(page.locator('button:has-text("Approve & Sign")')).toHaveCount(0);
  await expect(page.locator('button:has-text("Reject")')).toHaveCount(0);

  // 7. Click "Generate & View Clinical Insights" at bottom of left column
  const generateBtn = page.locator('button.btn-generate-insights');
  await expect(generateBtn).toBeVisible();
  await generateBtn.click();

  // 8. CRITICAL ASSERTION: Modal must open upon clicking Generate
  await expect(page.locator('.modal-header--insights:has-text("Clinical Insights")')).toBeVisible({ timeout: 25000 });

  // 9. CRITICAL ASSERTION: Modal must display Summary, Medicine, Tests tabs
  const insightsModal = page.locator('.modal-insights-content');
  await expect(insightsModal.locator('button.insights-tab-btn:has-text("Summary")')).toBeVisible();
  await expect(insightsModal.locator('button.insights-tab-btn:has-text("Medicine")')).toBeVisible();
  await expect(insightsModal.locator('button.insights-tab-btn:has-text("Tests")')).toBeVisible();

  // 10. CRITICAL ASSERTION: Modal footer must have BOTH "Reject AI Draft" and "Approve & Sign All"
  const rejectBtn = insightsModal.locator('button:has-text("Reject AI Draft")');
  const approveBtn = insightsModal.locator('button:has-text("Approve & Sign All")');
  await expect(rejectBtn).toBeVisible();
  await expect(approveBtn).toBeVisible();

  // 11. Test Reject prompt within modal
  await rejectBtn.click();
  await expect(insightsModal.locator('textarea[placeholder="Clinical reason for rejection..."]')).toBeVisible();
  await expect(insightsModal.locator('button:has-text("Confirm Rejection")')).toBeVisible();

  // Cancel reject prompt and test Approve & Sign All
  await insightsModal.locator('button:has-text("Cancel")').click();
  await expect(insightsModal.locator('textarea[placeholder="Clinical reason for rejection..."]')).toHaveCount(0);

  // 12. Approve & Sign All
  await approveBtn.click();
  await expect(page.locator('.modal-header--insights:has-text("Clinical Insights")')).toHaveCount(0, { timeout: 25000 });

  // Take screenshot of finalized approved consultation
  await page.screenshot({ path: 'test-results/decoupled-modal-approved.png', fullPage: true });
});

