import { test, expect } from '@playwright/test';

test.describe('AI Veterinary Scribe — Dynamic Consultation & Live Recording E2E', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('1. Verify Start Recording option is clearly visible and enabled', async ({ page }) => {
    // Verify the Start Recording (or Record More) button exists and is visible
    const recordBtn = page.getByRole('button', { name: /Start Recording|Record More/i });
    await expect(recordBtn).toBeVisible();
    await expect(recordBtn).toBeEnabled();

    // Capture screenshot confirming Start Recording button is present
    await page.screenshot({ path: 'e2e-start-recording-visible.png' });
    console.log('✅ PASS: Start Recording button is clearly visible and enabled!');
  });

  test('2. Verify Dynamic Consultation creation without hardcoded values', async ({ page }) => {
    // Verify "+ New Consultation" button in header
    const newConsultBtn = page.getByRole('button', { name: /New Consultation/i });
    await expect(newConsultBtn).toBeVisible();
    await newConsultBtn.click();

    // Verify modal appeared
    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.getByText('Create New Consultation')).toBeVisible();

    // Select dynamic patient inside the modal (first select: patient)
    const petSelect = page.locator('.modal-content select').nth(0);
    await expect(petSelect).toBeVisible();
    const options = await petSelect.locator('option').all();
    if (options.length > 1) {
      const lunaOption = options[1];
      const lunaValue = await lunaOption.getAttribute('value');
      await petSelect.selectOption(lunaValue);
    }

    // Submit new consultation
    const submitBtn = page.getByRole('button', { name: /Start New Consultation/i });
    await submitBtn.click();

    // Wait for modal to close
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    // Verify dynamic patient details updated in header
    await expect(page.locator('.pet-details')).toBeVisible();

    // Verify Start Recording button is ready for the new consultation
    const recordBtn = page.getByRole('button', { name: /Start Recording|Record More/i });
    await expect(recordBtn).toBeVisible();
    console.log('✅ PASS: Dynamic consultation created successfully for new patient!');
  });

  test('3. Verify Recording state transitions and Speaker Toggle', async ({ page }) => {
    const context = page.context();
    await context.grantPermissions(['microphone']);

    // Ensure consultation metadata has loaded, then grant consent if still pending
    const consentBadge = page.locator('.consultation-header .badge[title*="Consent"]').first();
    await expect(consentBadge).toBeVisible({ timeout: 10000 });
    const grantConsentBtn = page.locator('button.consent-action-btn');
    if (await grantConsentBtn.isVisible().catch(() => false)) {
      await grantConsentBtn.click();
    }

    // Click Start Recording
    const recordBtn = page.getByRole('button', { name: /Start Recording|Record More/i });
    await recordBtn.click();

    // Verify status changes to RECORDING
    await expect(page.locator('.timer-box')).toContainText(/RECORDING/i);
    await expect(page.locator('.recording-pulse')).toBeVisible();

    // Verify Speaker Toggles appear
    const vetBtn = page.locator('button[title="Force current speaker tag to Attending Veterinarian"]');
    const ownerBtn = page.locator('button[title="Force current speaker tag to Pet Owner"]');
    await expect(vetBtn).toBeVisible();
    await expect(ownerBtn).toBeVisible();

    // Toggle to Pet Owner
    await ownerBtn.click();
    console.log('✅ PASS: Speaker toggled to Pet Owner');

    // Toggle back to Veterinarian
    await vetBtn.click();
    console.log('✅ PASS: Speaker toggled to Veterinarian');

    // Test Pause and Resume
    const pauseBtn = page.getByRole('button', { name: /Pause/i });
    await pauseBtn.click();
    await expect(page.locator('.timer-box')).toContainText(/PAUSED/i);

    const resumeBtn = page.getByRole('button', { name: /Resume/i });
    await resumeBtn.click();
    await expect(page.locator('.timer-box')).toContainText(/RECORDING/i);

    // Stop recording
    const stopBtn = page.getByRole('button', { name: /Stop & Scribe/i });
    await stopBtn.click();

    // Verify that after stopping, the button is STILL available (Record More)
    const afterStopBtn = page.getByRole('button', { name: /Start Recording|Record More/i });
    await expect(afterStopBtn).toBeVisible({ timeout: 10000 });
    console.log('✅ PASS: Recording controls transitioned cleanly without disappearing!');
  });

  test('4. Verify realigned Clinical Document Tabs (Summary, Prescription, Lab Tests) render and allow review', async ({ page }) => {
    // Verify 3 realigned tabs exist in order: Summary, Prescription, Lab Tests
    const summaryTab      = page.locator('.tab-button', { hasText: /Summary/i });
    const prescriptionTab = page.locator('.tab-button', { hasText: /Prescription/i });
    const labTestsTab     = page.locator('.tab-button', { hasText: /Lab Tests/i });

    await expect(summaryTab).toBeVisible();
    await expect(prescriptionTab).toBeVisible();
    await expect(labTestsTab).toBeVisible();

    // Verify SOAP Notes and Follow-up are cleanly removed
    await expect(page.locator('.tab-button', { hasText: /SOAP Notes/i })).not.toBeVisible();
    await expect(page.locator('.tab-button', { hasText: /Follow-up/i })).not.toBeVisible();

    // Click each tab to verify interactive tab switching
    await summaryTab.click();
    await expect(summaryTab).toHaveClass(/active/);
    await expect(page.locator('.doc-content-container')).toBeVisible();

    await prescriptionTab.click();
    await expect(prescriptionTab).toHaveClass(/active/);

    await labTestsTab.click();
    await expect(labTestsTab).toHaveClass(/active/);

    await page.screenshot({ path: 'e2e-all-tabs-verified.png', fullPage: true });
    console.log('✅ PASS: Realigned Clinical Document Tabs (Summary, Prescription, Lab Tests) verified interactive!');
  });

  test('5. Verify bottom transcript Generate button opens Clinical Insights Popup (Summary, Medicine, Tests)', async ({ page }) => {
    // Verify the bottom button is visible below transcript
    const insightsBtn = page.locator('.btn-generate-insights');
    await expect(insightsBtn).toBeVisible();

    // Click to open popup
    await insightsBtn.click();

    // Verify modal overlay and header appear
    const insightsModal = page.locator('.modal-insights-content');
    await expect(insightsModal).toBeVisible({ timeout: 25000 });
    await expect(insightsModal).toContainText(/AI Clinical Insights & Templates/i);

    // Verify 3 tabs exist inside modal in alignment: Summary, Medicine, Tests
    const summaryModalTab  = insightsModal.getByRole('button', { name: 'Summary', exact: true });
    const medicineModalTab = insightsModal.getByRole('button', { name: /Medicine/i });
    const testsModalTab    = insightsModal.getByRole('button', { name: /Tests/i });

    await expect(summaryModalTab).toBeVisible();
    await expect(medicineModalTab).toBeVisible();
    await expect(testsModalTab).toBeVisible();

    // Verify Follow-ups is removed from modal tabs
    await expect(insightsModal.getByRole('button', { name: /Follow-ups/i })).not.toBeVisible();

    // Switch to Medicine tab
    await medicineModalTab.click();
    await expect(insightsModal).toContainText(/Dosage|Frequency|No prescription medications/i);

    // Switch to Tests tab
    await testsModalTab.click();
    await expect(insightsModal).toContainText(/Biomarker|Target|Laboratory|No specific laboratory/i);

    // Switch back to Summary tab
    await summaryModalTab.click();
    await expect(insightsModal).toContainText(/Clinical Overview/i);

    await page.screenshot({ path: 'test-results/clinical-insights-popup.png' });

    // Close modal
    const closeBtn = insightsModal.locator('button[aria-label="Close clinical insights modal"]');
    await closeBtn.click();
    await expect(insightsModal).not.toBeVisible();

    console.log('✅ PASS: Clinical Insights Popup with Summary, Medicine, and Tests verified end-to-end!');
  });
});

