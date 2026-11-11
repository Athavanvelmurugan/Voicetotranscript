import { test, expect } from '@playwright/test';

test.describe('Admin Portal — Doctor Onboarding & Removed Legacy Tabs', () => {
  test('Clinic admin portal has Doctor Onboarding, removes Patient Registry & Calendar, and onboards doctor directly', async ({ page }) => {
    // 1. Login as clinic_admin
    await page.goto('http://localhost:3000/?portal=admin');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@centralvalleyvet.com');
      await page.locator('input[type="password"]').fill('Password123!');
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
    }

    // 2. Verify sidebar items:
    // Patient Registry and Calendar & Slots must NOT exist
    await expect(page.locator('button:has-text("Patient Registry")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Calendar & Slots")')).toHaveCount(0);

    // Doctor Onboarding MUST exist
    const onboardingNavBtn = page.locator('button:has-text("Doctor Onboarding")');
    await expect(onboardingNavBtn).toBeVisible();

    // 3. Click Doctor Onboarding
    await onboardingNavBtn.click();
    await page.waitForTimeout(500);

    // Verify form fields exist
    const nameInput = page.locator('#doc-name');
    const emailInputDoc = page.locator('#doc-email');
    const passwordInput = page.locator('#doc-password');
    const licenseInput = page.locator('#doc-license');
    const specialtySelect = page.locator('#doc-specialty');
    const submitBtn = page.locator('button[type="submit"]:has-text("Onboard Doctor")');

    await expect(nameInput).toBeVisible();
    await expect(emailInputDoc).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(licenseInput).toBeVisible();
    await expect(specialtySelect).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // 4. Fill in new doctor information
    const uniqueEmail = `dr.playwright.${Date.now()}@centralvalleyvet.com`;
    const docName = 'Dr. Playwright Specialist, DVM';
    const licenseNo = 'VET-CA-77112';

    await nameInput.fill(docName);
    await emailInputDoc.fill(uniqueEmail);
    await passwordInput.fill('DoctorPass123!');
    await licenseInput.fill(licenseNo);
    await specialtySelect.selectOption('Feline Internal Medicine');

    // 5. Submit form
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // 6. Verify success card appears
    const successCard = page.locator('.admin-onboarding-success-card');
    await expect(successCard).toBeVisible();
    await expect(successCard).toContainText('Doctor Onboarded Successfully!');
    await expect(successCard).toContainText(docName);
    await expect(successCard).toContainText(uniqueEmail);

    // 7. Verify no invite method in Staff Roster
    const staffNavBtn = page.locator('button:has-text("Staff Roster")');
    await staffNavBtn.click();
    await page.waitForTimeout(500);

    // Invite button must NOT exist
    await expect(page.locator('button:has-text("Invite Provider")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Generate Invitation")')).toHaveCount(0);

    // The newly onboarded doctor must appear in Staff Roster
    const searchInput = page.locator('input[placeholder*="Search by name"]');
    await searchInput.fill(uniqueEmail);
    await page.waitForTimeout(500);

    await expect(page.locator(`text=${uniqueEmail}`)).toBeVisible();
    await expect(page.locator(`text=${docName}`)).toBeVisible();
  });
});

