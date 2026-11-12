import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 640 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

const THEMES = ['light', 'dark'];

test.describe('Independent Self-Registration & Multi-Practice Responsive E2E', () => {
  test('Responsive audit at 360px, 768px & 1280px (Light & Dark) on Role Selector & Doctor Form', async ({ page }) => {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
          localStorage.setItem('petcare-theme', t);
        }, theme);

        await page.getByTestId('open-register-selector').click();
        await expect(page.getByTestId('role-option-hospital')).toBeVisible();
        await expect(page.getByTestId('role-option-doctor')).toBeVisible();
        await expect(page.getByTestId('role-option-pet_owner')).toBeVisible();

        const selectorOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        expect(selectorOverflow, `Overflow on role selector ${vp.name} (${theme})`).toBeLessThanOrEqual(2);

        // Open Doctor form and check both practice mode cards fit cleanly without horizontal scroll
        await page.getByTestId('role-option-doctor').click();
        await expect(page.getByTestId('doctor-mode-independent')).toBeVisible();
        await expect(page.getByTestId('doctor-mode-hospital')).toBeVisible();

        const docFormOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        expect(docFormOverflow, `Overflow on doctor form ${vp.name} (${theme})`).toBeLessThanOrEqual(2);
      }
    }
  });

  test('End-to-End UI Flow: Hospital Approval, Independent + Dual-Mode Doctor Switcher, Pet Owner Multi-Practice', async ({ page }) => {
    const ts = Date.now();
    const hospName = `Cedar Oak Vet Hospital ${ts}`;
    const hospEmail = `cedar.${ts}@example.com`;
    const docEmail = `doc.indep.${ts}@example.com`;
    const docName = `Dr. Maya Lin ${ts}`;
    const ownerEmail = `owner.ui.${ts}@example.com`;
    const strongPass = 'PetCarePass!2026';

    // Handle alert/confirm dialogs gracefully
    page.on('dialog', (dialog) => dialog.accept());

    // 1. Hospital Self-Registration -> Email Verify -> Pending Approval Gate
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByTestId('open-register-selector').click();
    await page.getByTestId('role-option-hospital').click();

    await page.fill('#hosp-name', hospName);
    await page.fill('#hosp-license', `VET-LIC-${ts}`);
    await page.fill('#hosp-email', hospEmail);
    await page.fill('#hosp-contact', '9876543210');
    await page.fill('#hosp-address', '101 Cypress Way, Suite 12');
    await page.fill('#hosp-city', 'Austin');
    await page.fill('#hosp-state', 'TX');
    await page.fill('#hosp-pin', '78701');
    await page.fill('#hosp-admin', 'Sarah Jenkins');
    await page.fill('#hosp-pass', strongPass);
    await page.fill('#hosp-confirm', strongPass);
    await page.getByRole('button', { name: /Register Hospital/i }).click();

    await expect(page.locator('#verify-otp-code')).toBeVisible({ timeout: 10000 });
    await page.fill('#verify-otp-code', '123456');
    await page.getByRole('button', { name: /Verify & Continue/i }).click();

    await expect(page.getByText(/Hospital Application Under Review/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Sign Out/i }).click();

    // 2. Super Admin Approves Hospital
    await page.fill('#login-email', 'superadmin@petpulse.com');
    await page.fill('#login-password', 'Password123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.getByRole('button', { name: /Pending Approvals/i }).click({ timeout: 10000 });
    await expect(page.getByText(hospName)).toBeVisible({ timeout: 10000 });
    const hospitalCard = page.locator('.practice-discovery-card', { hasText: hospName });
    await hospitalCard.getByRole('button', { name: /Approve Hospital/i }).click();
    await expect(page.getByText(/Approved/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Sign Out/i }).click();

    // 3. Independent Doctor Self-Registration (No Hospital Selected) -> Active Doctor Portal
    await page.getByTestId('open-register-selector').click();
    await page.getByTestId('role-option-doctor').click();

    await page.fill('#doc-fullname', docName);
    await page.fill('#doc-email', docEmail);
    await page.fill('#doc-mobile', '9876543222');
    await page.fill('#doc-password', strongPass);
    await page.fill('#doc-confirm', strongPass);
    await page.fill('#doc-qual', 'BVSc & AH');
    await page.fill('#doc-regno', `VCI-${ts}`);
    await page.fill('#doc-exp', '5');
    await page.getByTestId('doctor-mode-independent').click();
    await page.fill('#doc-practice-name', `Maya Independent Vet ${ts}`);
    await page.getByRole('button', { name: /Create Doctor Account/i }).click();

    await expect(page.locator('#verify-otp-code')).toBeVisible({ timeout: 10000 });
    await page.fill('#verify-otp-code', '123456');
    await page.getByRole('button', { name: /Verify & Continue/i }).click();

    // Doctor lands directly in Doctor Portal with Independent Practice active
    await expect(page.getByText(/Independent Practice/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Live Consultation/i }).first()).toBeVisible();

    // 4. Dual-Mode Doctor requests to join Approved Hospital via My Practices tab
    await page.getByRole('button', { name: /My Practices/i }).click();
    await page.fill('#discover-hosp-q', hospName);
    const targetHospCard = page.locator('.practice-discovery-card', { hasText: hospName });
    await expect(targetHospCard).toBeVisible({ timeout: 10000 });
    await targetHospCard.getByRole('button', { name: /Request to Join/i }).click();
    await expect(page.getByText(/Join request sent/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Sign Out/i }).click();

    // 5. Hospital Admin logs in and approves Doctor Join Request
    await page.fill('#login-email', hospEmail);
    await page.fill('#login-password', strongPass);
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.getByRole('button', { name: /Join Requests/i }).click({ timeout: 10000 });
    const reqCard = page.locator('.practice-discovery-card', { hasText: docEmail });
    await expect(reqCard).toBeVisible({ timeout: 10000 });
    await reqCard.getByRole('button', { name: /Approve Doctor/i }).click();
    await expect(page.getByText(/as a member of your hospital/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Sign Out/i }).click();

    // 6. Dual-Mode Doctor logs back in and verifies Practice Switcher has BOTH workspaces
    await page.fill('#login-email', docEmail);
    await page.fill('#login-password', strongPass);
    await page.getByRole('button', { name: /Sign In/i }).click();

    const switcher = page.getByTestId('doctor-practice-switcher');
    await expect(switcher).toBeVisible({ timeout: 10000 });
    const optionsText = await switcher.locator('option').allTextContents();
    expect(optionsText.some((t) => t.includes('Independent'))).toBe(true);
    expect(optionsText.some((t) => t.includes(hospName))).toBe(true);
    await page.getByRole('button', { name: /Sign Out/i }).click();

    // 7. Pet Owner Self-Registers without Hospital, verifies OTP, adds Pet & discovers both Practices
    await page.getByTestId('open-register-selector').click();
    await page.getByTestId('role-option-pet_owner').click();

    await page.fill('#owner-reg-name', `Jordan Owner ${ts}`);
    await page.fill('#owner-reg-email', ownerEmail);
    await page.fill('#owner-reg-mobile', '9876543233');
    await page.fill('#owner-reg-pass', strongPass);
    await page.fill('#owner-reg-confirm', strongPass);
    await page.getByRole('button', { name: /Register as Pet Owner/i }).click();

    await expect(page.locator('#verify-otp-code')).toBeVisible({ timeout: 10000 });
    await page.fill('#verify-otp-code', '123456');
    await page.getByRole('button', { name: /Verify & Continue/i }).click();

    await expect(page.getByText(/Pet Owner Portal/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Appointments & Booking/i }).click();
    const hospSelect = page.locator('#owner-book-hospital');
    await expect(hospSelect).toBeVisible({ timeout: 10000 });
    const discoverOptions = await hospSelect.locator('option').allTextContents();
    expect(discoverOptions.some((o) => o.includes(hospName))).toBe(true);
    expect(discoverOptions.some((o) => o.includes('Independent Practice'))).toBe(true);
  });
});

