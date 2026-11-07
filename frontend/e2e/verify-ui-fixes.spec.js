import { test, expect } from '@playwright/test';

test('Verify Reset button visibility and Clinical Insights generation', async ({ page }) => {
  // Navigate to consultation 27
  await page.goto('http://localhost:3000/?consultationId=27');
  await page.waitForLoadState('networkidle');

  // Verify Reset button is visible and has correct text
  const resetBtn = page.locator('button.btn-reset-action');
  await expect(resetBtn).toBeVisible({ timeout: 5000 });
  await expect(resetBtn).toContainText('Reset');

  // Verify Record More & Upload Audio are visible in the controls row
  await expect(page.locator('button:has-text("Record More")')).toBeVisible();
  await expect(page.locator('label:has-text("Upload Audio")')).toBeVisible();

  // Take screenshot of audio controls area
  await page.locator('.audio-controls').screenshot({ path: 'test-results/audio-controls-aligned.png' });

  // Verify right pane has real summary content (not fallback placeholder)
  const narrativeBox = page.locator('label:has-text("Clinical Overview Narrative") + textarea');
  await expect(narrativeBox).toBeVisible({ timeout: 5000 });
  const narrativeValue = await narrativeBox.inputValue();
  expect(narrativeValue).not.toContain('Automated clinical extraction unavailable');
  expect(narrativeValue).toContain('Max');

  // Verify "Generate & View Clinical Insights" button is visible at bottom of left panel
  const generateBtn = page.locator('button.btn-generate-insights');
  await expect(generateBtn).toBeVisible();

  // Take full workspace screenshot
  await page.screenshot({ path: 'test-results/consultation-27-fixed.png', fullPage: true });
});

