import { test, expect } from '@playwright/test';

test.describe('Consultation Attending Doctor Synchronization & Isolation E2E', () => {
  test('Attending doctor badge locks to authenticated clinician on new & active consultations', async ({ page }) => {
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

    // 1. Open New Consultation Modal and verify Attending Clinician is locked to logged-in doctor
    const newConsultBtn = page.getByRole('button', { name: /New Consultation/i });
    await expect(newConsultBtn).toBeVisible();
    await newConsultBtn.click();

    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.getByText('Create New Consultation')).toBeVisible();
    await expect(page.locator('.doctor-locked-badge')).toContainText(/Alex Morgan/i);

    // 2. Submit consultation and verify header attending doctor badge matches authenticated doctor
    const submitBtn = page.getByRole('button', { name: /Start New Consultation/i });
    await submitBtn.click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    const headerDoctorBadge = page.locator('.badge-purple');
    await expect(headerDoctorBadge).toBeVisible();
    await expect(headerDoctorBadge).toContainText(/Alex Morgan/i);
  });
});
