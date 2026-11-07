import { test, expect } from '@playwright/test';

test.describe('SaaS Directory Management Page — Multi-Page Navigation, KPI Stats, Search & CRUD', () => {

  test('Seamless SaaS navigation between Live Consultation and Directory Management', async ({ page }) => {
    // Automatically accept window.confirm dialogs during delete operations
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // ─── 1. Load Homepage & Verify SaaS Top Navigation ────────────────────────
    await page.goto('/');
    await expect(page.locator('.navbar')).toBeVisible();
    await expect(page.getByText('PetCare AI')).toBeVisible();

    const liveConsultationNavBtn = page.getByRole('button', { name: /Live Consultation/i });
    const directoryNavBtn = page.getByRole('button', { name: /Directory Management/i });

    await expect(liveConsultationNavBtn).toBeVisible();
    await expect(directoryNavBtn).toBeVisible();
    await expect(liveConsultationNavBtn).toHaveClass(/active/);

    // ─── 2. Navigate to Directory Management Page ─────────────────────────────
    await directoryNavBtn.click();
    await expect(directoryNavBtn).toHaveClass(/active/);
    await expect(page).toHaveURL(/.*[?&]page=directory/);

    // Verify Directory Page Header & Subtext
    await expect(page.getByRole('heading', { name: 'Directory Management — Doctors & PetCare' })).toBeVisible();

    // Verify Executive KPI Stat Cards
    await expect(page.getByText('Attending Veterinarians', { exact: true })).toBeVisible();
    await expect(page.getByText('Registered Patients', { exact: true })).toBeVisible();
    await expect(page.getByText('Clinical Safety Status', { exact: true })).toBeVisible();

    // ─── 3. Test Search & Filter on Doctors ────────────────────────────────────
    const searchInput = page.getByPlaceholder(/Search doctors by name/i);
    await expect(searchInput).toBeVisible();

    // ─── 4. Test Add Doctor on Directory Page ──────────────────────────────────
    const uniqueSuffix = Date.now().toString().slice(-4);
    const newDocName = `Dr. SaaS Specialist_${uniqueSuffix}`;
    const newDocEmail = `saas.spec.${uniqueSuffix}@petcare.vet`;

    const doctorNameInput = page.getByPlaceholder('e.g. Dr. Jordan Lee, DVM');
    const doctorEmailInput = page.getByPlaceholder('e.g. jordan.lee@petcare.vet');

    await doctorNameInput.fill(newDocName);
    await doctorEmailInput.fill(newDocEmail);

    const addDoctorBtn = page.getByRole('button', { name: /Add Doctor/i });
    await addDoctorBtn.click();

    // Verify Doctor appears in Table
    await expect(page.getByRole('cell', { name: newDocName })).toBeVisible();
    console.log(`✅ PASS: Doctor ${newDocName} added successfully on Directory Page!`);

    // ─── 5. Test PetCare Tab & Add Pet on Directory Page ───────────────────────
    const petsTabBtn = page.getByRole('button', { name: /PetCare Directory/i });
    await petsTabBtn.click();
    await expect(petsTabBtn).toHaveClass(/active/);

    const uniquePetName = `SaaS_Nova_${uniqueSuffix}`;
    const petNameInput = page.getByPlaceholder('e.g. Charlie');
    const ownerNameInput = page.getByPlaceholder('e.g. Alice Cooper');
    const breedInput = page.getByPlaceholder('e.g. Golden Retriever');

    await petNameInput.fill(uniquePetName);
    await ownerNameInput.fill('Sarah Jenkins');
    await breedInput.fill('Border Collie');

    const addPetBtn = page.getByRole('button', { name: /Add Pet/i });
    await addPetBtn.click();

    // Verify Pet appears in Table
    await expect(page.getByRole('cell', { name: uniquePetName })).toBeVisible();
    console.log(`✅ PASS: Pet ${uniquePetName} added successfully on Directory Page!`);

    // ─── 6. Navigate Back to Live Consultation Workspace ──────────────────────
    const backToScribeBtn = page.getByRole('button', { name: /Go to Live Scribe Workspace/i });
    await expect(backToScribeBtn).toBeVisible();
    await backToScribeBtn.click();

    // Verify Live Consultation Workspace is Active
    await expect(page.locator('.consultation-workspace')).toBeVisible();
    await expect(liveConsultationNavBtn).toHaveClass(/active/);
    console.log('✅ PASS: Navigation returned smoothly to Live Consultation Workspace!');

    // ─── 7. Direct URL Refresh Test (?page=directory) ─────────────────────────
    await page.goto('/?page=directory');
    await expect(page.getByRole('heading', { name: 'Directory Management — Doctors & PetCare' })).toBeVisible();
    await expect(directoryNavBtn).toHaveClass(/active/);
    console.log('✅ PASS: Direct URL access to /?page=directory verified successfully!');
  });

});
