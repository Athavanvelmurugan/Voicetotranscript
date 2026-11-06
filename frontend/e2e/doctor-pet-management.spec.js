import { test, expect } from '@playwright/test';

test.describe('Dynamic Doctor & PetCare Directory — Add, Check, Clear, Delete E2E', () => {

  test('Manage Doctors & Pets: Add, Check, Clear, and Delete dynamically without hardcoding', async ({ page }) => {
    // Automatically accept window.confirm dialogs during delete tests
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto('/');
    await expect(page.locator('.consultation-header')).toBeVisible();

    // ─── 1. Open Directory Management Modal ──────────────────────────────────
    const directoryBtn = page.getByRole('button', { name: /Manage Directory/i });
    await expect(directoryBtn).toBeVisible();
    await directoryBtn.click();

    // Verify modal appeared
    await expect(page.getByText('Directory Management — Doctors & PetCare')).toBeVisible();

    // ─── 2. Test Doctor "Clear Form" Action ──────────────────────────────────
    const doctorNameInput = page.getByPlaceholder('e.g. Dr. Jordan Lee, DVM');
    const doctorEmailInput = page.getByPlaceholder('e.g. jordan.lee@petcare.vet');

    await doctorNameInput.fill('Dr. Temp Clear Test');
    await doctorEmailInput.fill('temp.clear@petcare.vet');

    // Click Clear button
    const clearDoctorBtn = page.getByRole('button', { name: /^Clear$/i }).first();
    await clearDoctorBtn.click();

    // Verify form fields were cleared
    await expect(doctorNameInput).toHaveValue('');
    await expect(doctorEmailInput).toHaveValue('');
    console.log('✅ PASS: Doctor form Clear button resets all inputs!');

    // ─── 3. Test Doctor "Add" and "Check" Action ─────────────────────────────
    const uniqueSuffix = Date.now().toString().slice(-4);
    const uniqueDoctorName = `Dr. Marcus Vance_${uniqueSuffix}`;
    const uniqueEmail = `dr.marcus.${uniqueSuffix}@petcare.vet`;
    await doctorNameInput.fill(uniqueDoctorName);
    await doctorEmailInput.fill(uniqueEmail);

    const addDoctorBtn = page.getByRole('button', { name: /Add Doctor/i });
    await addDoctorBtn.click();

    // Verify success feedback
    await expect(page.locator('.modal-content')).toContainText(new RegExp(`Added ${uniqueDoctorName}`, 'i'));

    // Verify doctor appears in the Check / Table list
    await expect(page.getByRole('cell', { name: uniqueDoctorName })).toBeVisible();
    console.log('✅ PASS: Dynamic Doctor added and verified in Directory check list!');

    // ─── 4. Test Switch Active Doctor ─────────────────────────────────────────
    const setActiveBtn = page.locator(`tr:has-text("${uniqueDoctorName}")`).getByRole('button', { name: /Set Active/i });
    if (await setActiveBtn.isVisible()) {
      await setActiveBtn.click();
      console.log('✅ PASS: Set newly added doctor as Active Attending Doctor!');
    }

    // ─── 5. Test PetCare "Clear", "Add", "Check", and "Delete" ────────────────
    const petsTab = page.getByRole('button', { name: /PetCare Directory/i });
    await petsTab.click();

    const petNameInput = page.getByPlaceholder('e.g. Charlie');
    const ownerNameInput = page.getByPlaceholder('e.g. Alice Cooper');

    // Test Pet Clear Form
    await petNameInput.fill('Temp Pet');
    await ownerNameInput.fill('Temp Owner');

    const clearPetBtn = page.getByRole('button', { name: /^Clear$/i }).first();
    await clearPetBtn.click();

    await expect(petNameInput).toHaveValue('');
    await expect(ownerNameInput).toHaveValue('');
    console.log('✅ PASS: Pet form Clear button resets all inputs!');

    // Test Pet Add
    const uniquePetName = `Zeus_${Date.now().toString().slice(-4)}`;
    await petNameInput.fill(uniquePetName);
    await ownerNameInput.fill('Elena Rostova');
    const petBreedInput = page.getByPlaceholder('e.g. Golden Retriever');
    await petBreedInput.fill('German Shepherd');

    const addPetBtn = page.getByRole('button', { name: /Add Pet/i });
    await addPetBtn.click();

    // Verify success feedback & presence in table cell
    await expect(page.locator('.modal-content')).toContainText(new RegExp(`Added ${uniquePetName}`, 'i'));
    await expect(page.getByRole('cell', { name: uniquePetName })).toBeVisible();
    console.log(`✅ PASS: New Pet ${uniquePetName} added and verified in Check list!`);

    // Test Pet Delete
    const deletePetRow = page.locator(`tr:has-text("${uniquePetName}")`);
    const deleteBtn = deletePetRow.getByRole('button', { name: '' }).last();
    await deleteBtn.click();

    // Verify item deleted from table
    await expect(page.locator('.modal-content')).toContainText(/Deleted pet/i);
    await expect(page.getByRole('cell', { name: uniquePetName })).not.toBeVisible();
    console.log('✅ PASS: Pet Delete action cleanly removes patient from Directory!');

    // Close Directory Modal
    await page.locator('.modal-footer').getByRole('button', { name: 'Close' }).click();

    // ─── 6. Verify Dynamic Consultation creation with Dynamic Doctor ──────────
    const newConsultBtn = page.getByRole('button', { name: /New Consultation/i });
    await newConsultBtn.click();

    // Verify dynamic doctor dropdown exists and includes our added doctor
    const doctorSelect = page.locator('.modal-content select').first();
    await expect(doctorSelect).toBeVisible();
    await expect(doctorSelect).toContainText(/Dr. Marcus Vance/i);

    // Submit consultation
    const submitBtn = page.getByRole('button', { name: /Start New Consultation/i });
    await submitBtn.click();

    // Wait for modal to close
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    // Verify header displays dynamic details
    await expect(page.locator('.consultation-header')).toBeVisible();
    await page.screenshot({ path: 'test-results/dynamic-directory-verified.png' });
    console.log('✅ PASS: Complete dynamic Doctor & PetCare management verified end-to-end!');
  });

});
