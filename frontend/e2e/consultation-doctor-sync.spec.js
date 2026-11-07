import { test, expect } from '@playwright/test';

test.describe('Consultation Attending Doctor Synchronization E2E', () => {

  test('Attending doctor dropdown updates based on consultation doctor selection', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.consultation-header')).toBeVisible();

    // 1. Open New Consultation Modal
    const newConsultBtn = page.getByRole('button', { name: /New Consultation/i });
    await expect(newConsultBtn).toBeVisible();
    await newConsultBtn.click();

    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.getByText('Create New Consultation')).toBeVisible();

    // 2. Select Dr Mouni in the doctor select of the modal
    const doctorSelect = page.locator('.modal-content select').first();
    await expect(doctorSelect).toBeVisible();

    // Find the option containing 'Dr Mouni'
    const doctorOptions = await doctorSelect.locator('option').all();
    let mouniValue = null;
    let mouniName = null;
    for (const opt of doctorOptions) {
      const text = await opt.textContent();
      if (/Mouni/i.test(text)) {
        mouniValue = await opt.getAttribute('value');
        mouniName = text;
        break;
      }
    }

    if (mouniValue) {
      await doctorSelect.selectOption(mouniValue);
    }

    // Submit consultation
    const submitBtn = page.getByRole('button', { name: /Start New Consultation/i });
    await submitBtn.click();

    // Wait for modal to disappear
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    // 3. Verify that the header attending doctor select dropdown shows Dr Mouni
    const headerDoctorSelect = page.locator('.badge-purple select');
    await expect(headerDoctorSelect).toBeVisible();

    if (mouniValue) {
      await expect(headerDoctorSelect).toHaveValue(mouniValue);
      await expect(headerDoctorSelect.locator('option:checked')).toContainText('Mouni');
      console.log(`✅ Attending doctor in header correctly updated to: Dr Mouni (#${mouniValue})`);
    }

    // 4. Test reassigning attending doctor directly from header
    const allHeaderOptions = await headerDoctorSelect.locator('option').all();
    if (allHeaderOptions.length > 1) {
      // Find an alternate doctor option
      let alternateVal = null;
      let alternateName = null;
      for (const opt of allHeaderOptions) {
        const val = await opt.getAttribute('value');
        const text = await opt.textContent();
        if (val !== mouniValue) {
          alternateVal = val;
          alternateName = text;
          break;
        }
      }

      if (alternateVal) {
        await headerDoctorSelect.selectOption(alternateVal);
        await expect(headerDoctorSelect).toHaveValue(alternateVal);
        await expect(headerDoctorSelect.locator('option:checked')).toHaveText(alternateName);
        console.log(`✅ PASS: Attending doctor successfully reassigned to "${alternateName}"!`);
      }
    }
  });
});
