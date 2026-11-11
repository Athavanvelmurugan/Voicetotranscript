import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile-s', width: 360, height: 640 },
  { name: 'mobile-l', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
];

const pages = [
  { path: '/', name: 'consultation' },
  { path: '/?page=directory', name: 'directory' },
  { path: '/?portal=owner', name: 'owner-portal' },
  { path: '/verify/0000000000000000000000000000000000000000000000000000000000000000', name: 'public-verify' },
];

const themes = ['light', 'dark'];

for (const vp of viewports) {
  for (const p of pages) {
    for (const theme of themes) {
      test(`Responsive check: ${p.name} @ ${vp.name} (${vp.width}x${vp.height}) [${theme}]`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(p.path, { waitUntil: 'networkidle' });
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);

        // 1. Verify no horizontal page overflow
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(overflow, `Page ${p.name} should not have horizontal scroll at ${vp.width}px (${theme})`).toBe(false);

        // 2. Tap targets check on mobile (< 600px)
        if (vp.width < 600) {
          const primaryButtons = await page.$$eval('.nav-link, .btn-primary, .btn-control-action', els =>
            els.filter(e => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.height < 36;
            }).map(e => e.innerText || e.className)
          );
          expect(primaryButtons, `Critical buttons should meet touch target standards on mobile`).toEqual([]);
        }
      });
    }
  }
}
