import { test, expect } from '@playwright/test';

test.describe('Doctor Portal & Clinical Navigation E2E', () => {
  test('Doctor portal loads 6 core tabs, chevron sidebar collapse, and settings', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // If redirected to login, login as doctor alex.morgan@petcare.vet
    const signInBtn = page.locator('button:has-text("Sign In")');
    if (await signInBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await page.fill('input[type="email"]', 'alex.morgan@petcare.vet');
      await page.fill('input[type="password"]', 'Password123!');
      await signInBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // 1. Verify Doctor Sidebar Navigation Items
    const sidebar = page.locator('aside.admin-vertical-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Verify all 6 tabs are present in sidebar
    await expect(sidebar.locator('button:has-text("Dashboard")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Patient List")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Live Consultation")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Register Patient")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Calendar & Slots")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Doctor Settings")')).toBeVisible();

    // Verify "Doctors Directory" / "Manage Directory" does NOT exist
    await expect(page.locator('text=Doctors Directory')).toHaveCount(0);
    await expect(page.locator('text=Manage Directory')).toHaveCount(0);

    // Verify Doctor name badge in sidebar footer
    await expect(sidebar.locator('text=Dr. Alex Morgan, DVM')).toBeVisible();

    // Verify Dashboard Tab Content
    await expect(page.locator('h1:has-text("Welcome back, Dr. Alex Morgan")')).toBeVisible();
    await expect(page.locator('text=Today\'s Appointments')).toBeVisible();
    await expect(page.locator('text=Registered Patients')).toBeVisible();
    await expect(page.locator('text=Completed Consultations')).toBeVisible();
    await expect(page.locator('text=Available Slots Today')).toBeVisible();
    await page.screenshot({ path: 'doctor_tab_dashboard.png' });

    // 2. Test Chevron Sidebar Collapse & Expand
    const chevronBtn = sidebar.locator('.sidebar-collapse-toggle-btn');
    await expect(chevronBtn).toBeVisible();

    // Collapse sidebar
    await chevronBtn.click();
    await page.waitForTimeout(400);
    await expect(sidebar).toHaveClass(/sidebar-collapsed/);
    await page.screenshot({ path: 'doctor_sidebar_collapsed.png' });

    // Expand sidebar back
    await chevronBtn.click();
    await page.waitForTimeout(400);
    await expect(sidebar).not.toHaveClass(/sidebar-collapsed/);

    // 3. Click "Patient List" Tab
    await sidebar.locator('button:has-text("Patient List")').click();
    await page.waitForTimeout(800);

    // Verify Patient list heading and cards
    await expect(page.locator('h2:has-text("Patient Directory & Clinical Charts")')).toBeVisible();
    const patientCards = page.locator('.doctor-patient-card');
    await expect(patientCards.first()).toBeVisible({ timeout: 5000 });
    const count = await patientCards.count();
    console.log(`Found ${count} patient cards in directory.`);
    await page.screenshot({ path: 'doctor_tab_patients.png' });

    // Open Clinical Chart for first patient (Inline Tab View)
    const firstChartBtn = patientCards.first().locator('button:has-text("Open Chart")');
    await firstChartBtn.click();
    await page.waitForTimeout(1000);

    // Verify Inline Patient Chart Card and Subtabs
    const chartCard = page.locator('.patient-chart-inline-card');
    await expect(chartCard).toBeVisible();
    await expect(chartCard.locator('button:has-text("Patient Detail")')).toBeVisible();
    await expect(chartCard.locator('button:has-text("AI Clinical Summary")')).toBeVisible();
    await expect(chartCard.locator('button:has-text("Patient Live Consultation")')).toBeVisible();
    await expect(chartCard.locator('button:has-text("Prescriptions")')).toBeVisible();
    await expect(chartCard.locator('button:has-text("Timeline")')).toBeVisible();

    // Back to Patient Directory
    await chartCard.locator('button:has-text("Back to Patient Directory")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('h2:has-text("Patient Directory & Clinical Charts")')).toBeVisible();

    // 4. Click "Live Consultation" Tab
    await sidebar.locator('button:has-text("Live Consultation")').click();
    await page.waitForTimeout(800);
    await expect(page.locator('.consultation-workspace')).toBeVisible();
    // Ensure NO "Manage Directory" button exists anywhere in Consultation workspace
    await expect(page.locator('button:has-text("Manage Directory")')).toHaveCount(0);
    await page.screenshot({ path: 'doctor_tab_consultation.png' });

    // 5. Click "Register Patient" Tab
    await sidebar.locator('button:has-text("Register Patient")').click();
    await page.waitForTimeout(800);
    await expect(page.locator('h2:has-text("Patient Registration Form")')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Luna, Buster, Milo"]')).toBeVisible();
    await page.screenshot({ path: 'doctor_tab_add_patient.png' });

    // 6. Click "Calendar & Slots" Tab
    await sidebar.locator('button:has-text("Calendar & Slots")').click();
    await page.waitForTimeout(800);
    await expect(page.locator('h2:has-text("Doctor Calendar & Slot Availability")')).toBeVisible();
    await expect(page.locator('h3:has-text("Available Consultation Time Slots")')).toBeVisible();
    await page.screenshot({ path: 'doctor_tab_schedule.png' });

    // 7. Click "Doctor Settings" Tab
    await sidebar.locator('button:has-text("Doctor Settings")').click();
    await page.waitForTimeout(800);
    await expect(page.locator('h1:has-text("Doctor Profile & Clinical Preferences")')).toBeVisible();
    await expect(page.locator('text=Clinician Profile & DVM Credentials')).toBeVisible();
    await expect(page.locator('text=AI Ambient Scribe Preferences')).toBeVisible();
    await expect(page.locator('text=Account Security & Credentials')).toBeVisible();
    await page.screenshot({ path: 'doctor_tab_settings.png' });

    console.log('Doctor Portal test verified with all 6 tabs, chevron collapse, and zero directory modal leakage!');
  });

  test('Responsive verification across viewports in light and dark mode', async ({ page }) => {
    const viewports = [
      { name: 'mobile', width: 360, height: 740 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000/?portal=doctor&tab=dashboard');
      await page.waitForLoadState('networkidle');

      // Login if needed
      const signInBtn = page.locator('button:has-text("Sign In")');
      if (await signInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.fill('input[type="email"]', 'alex.morgan@petcare.vet');
        await page.fill('input[type="password"]', 'Password123!');
        await signInBtn.click();
        await page.waitForLoadState('networkidle');
      }

      // Check header or hamburger depending on screen size
      if (vp.width < 1024) {
        await expect(page.locator('.admin-hamburger-btn')).toBeVisible();
      } else {
        await expect(page.locator('aside.admin-vertical-sidebar')).toBeVisible();
      }

      await page.screenshot({ path: `doctor_dashboard_${vp.name}_light.png` });

      // Toggle dark mode via script
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `doctor_dashboard_${vp.name}_dark.png` });
    }
  });
});
