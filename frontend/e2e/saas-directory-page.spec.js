import { test, expect } from '@playwright/test';

test.describe('SaaS Portal Navigation, Directory Listing & Live Consultation Sync E2E', () => {
  test('Seamless sidebar & URL navigation between Patient List, Register Patient, and Live Consultation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const signInBtn = page.locator('button:has-text("Sign In")');
    if (await signInBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await page.fill('input[type="email"]', 'alex.morgan@petcare.vet');
      await page.fill('input[type="password"]', 'Password123!');
      await signInBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const sidebar = page.locator('aside.admin-vertical-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const patientsNavBtn = sidebar.locator('button:has-text("Patient List")');
    const liveConsultationNavBtn = sidebar.locator('button:has-text("Live Consultation")');

    // 1. Navigate to Patient List directory
    await patientsNavBtn.click();
    await expect(patientsNavBtn).toHaveClass(/active/);
    await expect(page).toHaveURL(/.*[?&]tab=patients/);
    await expect(page.locator('h2:has-text("Patient Directory & Clinical Charts")')).toBeVisible();

    // 2. Navigate to Live Consultation Workspace
    await liveConsultationNavBtn.click();
    await expect(liveConsultationNavBtn).toHaveClass(/active/);
    await expect(page.locator('.consultation-workspace')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/.*[?&]tab=consultation/);

    // 3. Direct URL load of ?portal=doctor&tab=patients
    await page.goto('/?portal=doctor&tab=patients');
    await expect(page.locator('h2:has-text("Patient Directory & Clinical Charts")')).toBeVisible({ timeout: 10000 });
  });
});
