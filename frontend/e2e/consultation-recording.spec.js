import { test, expect } from '@playwright/test';

test.describe('AI Veterinary Scribe — Dynamic Consultation & Live Recording E2E', () => {

  test('1. Verify Start Recording option is clearly visible and enabled', async ({ page }) => {
    await page.goto('/');

    // Wait for the workspace to load
    await expect(page.locator('.consultation-header')).toBeVisible();

    // Verify the Start Recording (or Record More Audio) button exists and is visible
    const recordBtn = page.getByRole('button', { name: /Start Recording|Record More Audio/i });
    await expect(recordBtn).toBeVisible();
    await expect(recordBtn).toBeEnabled();

    // Capture screenshot confirming Start Recording button is present
    await page.screenshot({ path: 'e2e-start-recording-visible.png' });
    console.log('✅ PASS: Start Recording button is clearly visible and enabled!');
  });

  test('2. Verify Dynamic Consultation creation without hardcoded values', async ({ page }) => {
    await page.goto('/');

    // Verify "+ New Consultation" button in header
    const newConsultBtn = page.getByRole('button', { name: /New Consultation/i });
    await expect(newConsultBtn).toBeVisible();
    await newConsultBtn.click();

    // Verify modal appeared
    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.getByText('Create New Consultation')).toBeVisible();

    // Select dynamic patient inside the modal: Luna (Siamese Cat) (second select in modal)
    const petSelect = page.locator('.modal-content select').nth(1);
    await expect(petSelect).toBeVisible();
    // Select the second pet option (Luna)
    const options = await petSelect.locator('option').all();
    if (options.length > 1) {
      const lunaValue = await options[1].getAttribute('value');
      await petSelect.selectOption(lunaValue);
    }

    // Submit new consultation
    const submitBtn = page.getByRole('button', { name: /Start New Consultation/i });
    await submitBtn.click();

    // Wait for modal to close
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    // Verify dynamic patient details updated in header (Luna, Cat)
    await expect(page.locator('.pet-details')).toContainText(/Luna|Cat|Feline/i);

    // Verify Start Recording button is ready for the new consultation
    const recordBtn = page.getByRole('button', { name: /Start Recording/i });
    await expect(recordBtn).toBeVisible();
    console.log('✅ PASS: Dynamic consultation created successfully for new patient!');
  });

  test('3. Verify Recording state transitions and Speaker Toggle', async ({ page }) => {
    // Grant microphone permission in browser context
    const context = page.context();
    await context.grantPermissions(['microphone']);

    await page.goto('/');

    // Click Start Recording
    const recordBtn = page.getByRole('button', { name: /Start Recording|Record More Audio/i });
    await recordBtn.click();

    // Verify status changes to RECORDING
    await expect(page.locator('.timer-box')).toContainText(/RECORDING/i);
    await expect(page.locator('.recording-pulse')).toBeVisible();

    // Verify Speaker Toggles appear
    const vetBtn = page.getByRole('button', { name: /Veterinarian|Dr\./i });
    const ownerBtn = page.getByRole('button', { name: /Pet Owner|Owner/i });
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

    // Verify that after stopping, the button is STILL available (Record More Audio)
    const afterStopBtn = page.getByRole('button', { name: /Start Recording|Record More Audio/i });
    await expect(afterStopBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ PASS: Recording controls transitioned cleanly without disappearing!');
  });

  test('4. Verify realigned Clinical Document Tabs (Summary, Prescription, Lab Tests) render and allow review', async ({ page }) => {
    await page.goto('/');

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

    // Allow workspace and documents to settle
    await page.waitForTimeout(2000);

    // Trigger document generation if awaiting extraction
    const generateBtn = page.getByRole('button', { name: /Generate Clinical Documents/i });
    if (await generateBtn.isVisible().catch(() => false)) {
      try {
        await generateBtn.click({ timeout: 5000 });
        await page.waitForTimeout(3000);
      } catch {
        // Element may have resolved or auto-populated
      }
    }

    // Click each tab to verify dynamic rendering
    await summaryTab.click();
    await expect(page.locator('.doc-content-container')).toContainText(/Summary|Consultation|Clinical Overview/i);

    await prescriptionTab.click();
    await expect(page.locator('.doc-content-container')).toContainText(/Prescribed Medications|Medication/i);

    await labTestsTab.click();
    await expect(page.locator('.doc-content-container')).toContainText(/Laboratory|Test/i);

    // Capture full-page screenshot of working workspace
    await page.screenshot({ path: 'e2e-all-tabs-verified.png', fullPage: true });
    console.log('✅ PASS: Realigned Clinical Document Tabs (Summary, Prescription, Lab Tests) verified interactive!');
  });

  test('5. Verify bottom transcript Generate button opens Clinical Insights Popup (Summary, Medicine, Tests)', async ({ page }) => {
    await page.goto('/');

    // Verify the bottom button is visible below transcript
    const insightsBtn = page.locator('.btn-generate-insights');
    await expect(insightsBtn).toBeVisible();

    // Click to open popup
    await insightsBtn.click();

    // Verify modal overlay and header appear
    await expect(page.getByText(/AI Clinical Insights & Templates/i)).toBeVisible();

    // Verify 3 tabs exist inside modal in alignment: Summary, Medicine, Tests
    const summaryModalTab  = page.locator('.modal-content').getByRole('button', { name: 'Summary', exact: true });
    const medicineModalTab = page.locator('.modal-content').getByRole('button', { name: /Medicine/i });
    const testsModalTab    = page.locator('.modal-content').getByRole('button', { name: /Tests/i });

    await expect(summaryModalTab).toBeVisible();
    await expect(medicineModalTab).toBeVisible();
    await expect(testsModalTab).toBeVisible();

    // Verify Follow-ups is removed from modal tabs
    await expect(page.locator('.modal-content').getByRole('button', { name: /Follow-ups/i })).not.toBeVisible();

    // Switch to Medicine tab
    await medicineModalTab.click();
    await expect(page.locator('.modal-content')).toContainText(/Dosage|Frequency|No prescription medications/i);

    // Switch to Tests tab
    await testsModalTab.click();
    await expect(page.locator('.modal-content')).toContainText(/Biomarker|Target|Laboratory/i);

    // Switch back to Summary tab
    await summaryModalTab.click();
    await expect(page.locator('.modal-content')).toContainText(/Clinical Overview/i);

    // Take screenshot of open popup
    await page.screenshot({ path: 'test-results/clinical-insights-popup.png' });

    // Close modal
    const closeBtn = page.locator('.modal-content').getByRole('button', { name: 'Close', exact: true });
    await closeBtn.click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    console.log('✅ PASS: Clinical Insights Popup with Summary, Medicine, and Tests verified end-to-end!');
  });
});

