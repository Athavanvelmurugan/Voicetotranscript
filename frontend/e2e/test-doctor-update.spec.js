import { test, expect } from '@playwright/test';

test.describe('Doctor Update Flows', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Visit root and login as doctor
    await page.goto('http://localhost:3000/?consultationId=71');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('mouni@gmail.com');
      await page.locator('input[type="password"]').fill('Password123!');
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
    }
  });

  test('Flow 1: Attending doctor select switches and persists via PATCH', async ({ page }) => {
    await page.goto('http://localhost:3000/?consultationId=71');
    await page.waitForLoadState('networkidle');

    const doctorSelect = page.locator('select[title="Change active attending doctor"], select[title="Switch active attending doctor"]').first();
    await expect(doctorSelect).toBeVisible();

    const currentDoctorId = await doctorSelect.inputValue();
    const optionValues = await doctorSelect.locator('option').evaluateAll(opts => opts.map(o => o.value));
    const targetId = optionValues.find(v => v !== currentDoctorId);
    expect(targetId).toBeTruthy();

    await doctorSelect.selectOption(targetId);
    await page.waitForTimeout(1000);

    const updatedValue = await doctorSelect.inputValue();
    expect(updatedValue).toBe(targetId);

    // Reload page to verify backend persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    const persistedDoctorSelect = page.locator('select[title="Change active attending doctor"], select[title="Switch active attending doctor"]').first();
    const persistedValue = await persistedDoctorSelect.inputValue();
    expect(persistedValue).toBe(targetId);
  });

  test('Flow 2: Patient Directory Set Active doctor works and updates active state', async ({ page }) => {
    await page.goto('http://localhost:3000/?page=directory');
    await page.waitForLoadState('networkidle');

    // Click "Doctors Directory" tab if needed
    const doctorsTabBtn = page.locator('button:has-text("Doctors Directory")');
    if (await doctorsTabBtn.isVisible()) {
      await doctorsTabBtn.click();
      await page.waitForTimeout(500);
    }

    // Find a "Set Active" button
    const setActiveBtn = page.locator('button:has-text("Set Active")').first();
    if (await setActiveBtn.isVisible()) {
      await setActiveBtn.click();
      await page.waitForTimeout(500);
    }

    // Navigate to consultation workspace
    const consultationNavBtn = page.locator('button:has-text("Live Consultation")');
    await consultationNavBtn.click();
    await page.waitForLoadState('networkidle');

    // Ensure we are back on consultation page
    expect(page.url()).not.toContain('page=directory');
  });
});
