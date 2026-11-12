import { test, expect } from '@playwright/test';

test.describe('Dynamic Patient Registration, Reset, Directory Verification & Consultation Launch E2E', () => {
  test('Register Patient, Reset Form, Verify in Patient List & Launch Live Consultation', async ({ page }) => {
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

    // 1. Open Register Patient tab
    await sidebar.locator('button:has-text("Register Patient")').click();
    await expect(page.locator('#pet-name')).toBeVisible();

    // 2. Test Reset Form button clears inputs
    await page.fill('#pet-name', 'Temp Clear Pet');
    await page.fill('#owner-name', 'Temp Clear Owner');
    await page.getByRole('button', { name: /Reset Form/i }).click();
    await expect(page.locator('#pet-name')).toHaveValue('');
    await expect(page.locator('#owner-name')).toHaveValue('');

    // 3. Register a new Patient dynamically
    const uniquePetName = `Zeus_${Date.now().toString().slice(-4)}`;
    await page.fill('#pet-name', uniquePetName);
    await page.fill('#pet-breed', 'German Shepherd');
    await page.fill('#owner-name', 'Elena Rostova');
    await page.fill('#owner-email', `elena.${Date.now()}@petcare.vet`);

    await page.getByRole('button', { name: /Register Patient & Open Chart/i }).click();
    await expect(page.getByRole('button', { name: /Start Live Consultation Now/i })).toBeVisible({ timeout: 10000 });

    // 4. Verify Patient appears in Patient List directory
    await sidebar.locator('button:has-text("Patient List")').click();
    await expect(page.locator('h2:has-text("Patient Directory & Clinical Charts")')).toBeVisible();
    await page.getByPlaceholder(/Search by name/i).fill(uniquePetName);
    await expect(page.locator(`text=${uniquePetName}`).first()).toBeVisible({ timeout: 10000 });

    // 5. Launch Live Consultation and confirm workspace opens cleanly
    await sidebar.locator('button:has-text("Live Consultation")').click();
    await expect(page.locator('.consultation-header')).toBeVisible({ timeout: 10000 });
  });
});
