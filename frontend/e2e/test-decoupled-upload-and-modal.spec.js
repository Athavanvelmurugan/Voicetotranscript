import { test, expect } from '@playwright/test';
import path from 'path';

test('Verify Decoupled Upload, Awaiting State, and Modal Approval/Rejection Controls', async ({ page }) => {
  // 1. Navigate to consultation app
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  // 2. Click + New Consultation to create clean session
  await page.click('button:has-text("+ New Consultation")');
  await page.waitForSelector('.modal-content', { state: 'visible' });
  await page.click('button:has-text("Start New Consultation")');
  await page.waitForSelector('.modal-content', { state: 'hidden' });

  // 3. Upload audio file
  const testAudio = path.resolve('..', 'tests', 'asr-audit', 'audio', 'negation.wav');
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
  await expect(page.locator('.modal-header:has-text("Clinical Insights")')).toBeVisible({ timeout: 25000 });

  // 9. CRITICAL ASSERTION: Modal must display Summary, Medicine, Tests tabs
  await expect(page.locator('button:has-text("Summary")')).toBeVisible();
  await expect(page.locator('button:has-text("Medicine")')).toBeVisible();
  await expect(page.locator('button:has-text("Tests")')).toBeVisible();

  // 10. CRITICAL ASSERTION: Modal footer must have BOTH "Reject AI Draft" and "Approve & Sign All"
  const rejectBtn = page.locator('button:has-text("Reject AI Draft")');
  const approveBtn = page.locator('button:has-text("Approve & Sign All")');
  await expect(rejectBtn).toBeVisible();
  await expect(approveBtn).toBeVisible();

  // 11. Test Reject prompt within modal
  await rejectBtn.click();
  await expect(page.locator('textarea[placeholder="Clinical reason for rejection..."]')).toBeVisible();
  await expect(page.locator('button:has-text("Confirm Rejection")')).toBeVisible();

  // Cancel reject prompt and test Approve & Sign All
  await page.click('button:has-text("Cancel")');
  await expect(page.locator('textarea[placeholder="Clinical reason for rejection..."]')).toHaveCount(0);

  // 12. Approve & Sign All
  await approveBtn.click();
  await expect(page.locator('.modal-header:has-text("Clinical Insights")')).toHaveCount(0);

  // Take screenshot of finalized approved consultation
  await page.screenshot({ path: 'test-results/decoupled-modal-approved.png', fullPage: true });
});

