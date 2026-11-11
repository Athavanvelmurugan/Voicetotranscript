const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

const outDir = path.resolve(__dirname, '../frontend/test-assets/owner-audit');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Seed owner session in localStorage
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('petcare_owner_session', JSON.stringify({
      id: 27,
      name: 'athavanvelmurugan',
      email: 'athavanvelmurugan@gmail.com',
      clinic_id: 1,
      clinicName: 'Central Valley Animal Hospital'
    }));
  });

  console.log('1. Capturing Dashboard Desktop...');
  await page.goto('http://localhost:3000/?portal=owner&tab=dashboard');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '01_desktop_dashboard.png'), fullPage: true });

  console.log('2. Capturing Appointments Booking...');
  await page.goto('http://localhost:3000/?portal=owner&tab=appointments');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, '02_desktop_appointments_booking.png'), fullPage: true });

  console.log('3. Capturing Confirmed Appointments List...');
  const confirmedBtn = page.locator('button:has-text("Confirmed Appointments")');
  if (await confirmedBtn.isVisible().catch(() => false)) {
    await confirmedBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '03_desktop_appointments_confirmed.png'), fullPage: true });
  }

  console.log('4. Capturing Live Consultation Tab...');
  await page.goto('http://localhost:3000/?portal=owner&tab=consultation');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '04_desktop_live_consultation.png'), fullPage: true });

  console.log('5. Capturing Pet Detail List...');
  await page.goto('http://localhost:3000/?portal=owner&tab=pets');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '05_desktop_pets_list.png'), fullPage: true });

  console.log('6. Capturing Register New Pet Modal...');
  const regPetBtn = page.locator('button:has-text("Register New Pet")');
  if (await regPetBtn.isVisible().catch(() => false)) {
    await regPetBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '06_desktop_modal_register_pet.png') });
    const closeBtn = page.locator('.modal-close-btn');
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  }

  console.log('7. Capturing Clinical Affiliation Tab...');
  await page.goto('http://localhost:3000/?portal=owner&tab=affiliation');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '07_desktop_clinical_affiliation.png'), fullPage: true });

  console.log('8. Capturing Settings Tab...');
  await page.goto('http://localhost:3000/?portal=owner&tab=settings');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '08_desktop_settings.png'), fullPage: true });

  console.log('9. Capturing Edit Pet Details Modal...');
  const editPetBtn = page.locator('button:has-text("Edit")').first();
  if (await editPetBtn.isVisible().catch(() => false)) {
    await editPetBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '09_desktop_modal_edit_pet.png') });
    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
  }

  console.log('10. Capturing Dark Mode Dashboard...');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.goto('http://localhost:3000/?portal=owner&tab=dashboard');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '10_desktop_dashboard_dark.png'), fullPage: true });

  console.log('11. Capturing Tablet 768px View...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('http://localhost:3000/?portal=owner&tab=dashboard');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '11_tablet_768_dashboard.png'), fullPage: true });

  console.log('12. Capturing Mobile 360px View...');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('http://localhost:3000/?portal=owner&tab=dashboard');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '12_mobile_360_dashboard.png'), fullPage: true });

  console.log('13. Capturing Mobile 360px Appointments View...');
  await page.goto('http://localhost:3000/?portal=owner&tab=appointments');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '13_mobile_360_appointments.png'), fullPage: true });

  await browser.close();
  console.log('✅ COMPLETE: All 13 Playwright audit screenshots captured in frontend/test-assets/owner-audit!');
})();

