import { test, expect } from '@playwright/test';

test.describe('Doctor Consultation Switching & Portal Navigation Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    const signInBtn = page.locator('button:has-text("Sign In")');
    if (await signInBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await page.fill('input[type="email"]', 'mouni@gmail.com');
      await page.fill('input[type="password"]', 'Password123!');
      await signInBtn.click();
      await expect(page.locator('aside.admin-vertical-sidebar')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Flow 1: Consultation switcher loads #71 and keeps attending doctor badge locked to doctor', async ({ page }) => {
    await page.goto('http://localhost:3000/?portal=doctor&tab=consultation&consultationId=71');
    await page.waitForLoadState('networkidle');

    const switcherSelect = page.locator('select.header-switcher-select');
    await expect(switcherSelect).toBeVisible({ timeout: 10000 });
    await expect(switcherSelect).toHaveValue('71');

    const doctorBadge = page.locator('.badge-purple[title="Attending Veterinarian"]');
    await expect(doctorBadge).toBeVisible();
  });

  test('Flow 2: Sidebar Live Consultation navigation works cleanly without strict-mode collision', async ({ page }) => {
    const consultationNavBtn = page.locator('aside.admin-vertical-sidebar button:has-text("Live Consultation")');
    await expect(consultationNavBtn).toBeVisible({ timeout: 10000 });
    await consultationNavBtn.click();

    await expect(page.locator('.consultation-workspace')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('tab=consultation');
  });
});
