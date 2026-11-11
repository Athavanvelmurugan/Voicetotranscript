const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('--- Checking Consultation Page ---');
  for (const w of [360, 414, 768, 1024, 1280]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`Consultation ${w}px: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${scrollWidth > clientWidth}`);
    await page.screenshot({ path: `test-consultation-${w}.png`, fullPage: true });

    if (scrollWidth > clientWidth) {
      // Find overflowing elements
      const overflowing = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements
          .filter(el => el.getBoundingClientRect().right > window.innerWidth)
          .map(el => ({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            rect: el.getBoundingClientRect()
          })).slice(0, 10);
      });
      console.log(`Overflowing elements at ${w}px:`, JSON.stringify(overflowing, null, 2));
    }
  }

  console.log('--- Checking Directory Page ---');
  for (const w of [360, 414, 768, 1024, 1280]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('http://localhost:3000/?page=directory', { waitUntil: 'networkidle' });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`Directory ${w}px: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${scrollWidth > clientWidth}`);
    await page.screenshot({ path: `test-directory-${w}.png`, fullPage: true });

    if (scrollWidth > clientWidth) {
      const overflowing = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements
          .filter(el => el.getBoundingClientRect().right > window.innerWidth)
          .map(el => ({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            rect: el.getBoundingClientRect()
          })).slice(0, 10);
      });
      console.log(`Directory Overflowing elements at ${w}px:`, JSON.stringify(overflowing, null, 2));
    }
  }

  console.log('--- Checking Modals at 360px ---');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Insights Modal
  const insightsBtn = page.locator('text=Generate & View Clinical Insights');
  if (await insightsBtn.count() > 0) {
    await insightsBtn.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-modal-insights-360.png' });
    const closeBtn = page.locator('.insights-modal-close, button:has-text("Close"), .modal-header button');
    if (await closeBtn.count() > 0) await closeBtn.first().click();
    await page.waitForTimeout(300);
  }

  // 2. Directory Modal
  const dirBtn = page.locator('button:has-text("Manage Directory")');
  if (await dirBtn.count() > 0) {
    await dirBtn.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-modal-directory-360.png' });
    const closeBtn = page.locator('.modal-header button, button:has-text("Close")');
    if (await closeBtn.count() > 0) await closeBtn.first().click();
    await page.waitForTimeout(300);
  }

  // 3. New Consultation Modal
  const newBtn = page.locator('button:has-text("New Consultation")');
  if (await newBtn.count() > 0) {
    await newBtn.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-modal-new-360.png' });
  }

  await browser.close();
})();
