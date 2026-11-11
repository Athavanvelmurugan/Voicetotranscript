# PetCare AI — UI, Theme & Mobile-Responsive Guidelines

> Use this file as the rulebook for every developer and AI agent (Claude, Antigravity, Cursor, etc.).
> Save it in the repo root as `UI_GUIDELINES.md` and reference it from `AGENTS.md`.

## The 3 Core Rules

1. **Single theme file.** All colors, fonts, spacing, radius, shadows live in ONE file: `frontend/src/styles/theme.css`. Change the theme there and the whole app updates.
2. **Mobile first.** Build for 360px width first, then scale up.
3. **Check code and layout side by side.** After every UI change, view it at mobile, tablet and desktop widths before calling it done.

---

## 1. Theme Management (Single Source of Truth)

### 1.1 File structure

```
frontend/src/styles/
├── theme.css        ← ONLY place for colors, fonts, spacing, radius, shadows (design tokens)
├── base.css         ← reset, body, typography, uses tokens only
├── layout.css       ← grid, containers, breakpoints
├── components.css   ← buttons, cards, inputs, modals, tables (tokens only)
└── index.css        ← imports the files above in this order
```

`main.jsx` imports only `index.css`:

```css
/* index.css */
@import './theme.css';
@import './base.css';
@import './layout.css';
@import './components.css';
```

### 1.2 `theme.css` (starter, edit values here only)

```css
/* ============================================================
   THEME FILE: change values here to re-skin the entire app.
   Never hardcode colors, sizes or fonts anywhere else.
   ============================================================ */

:root {
  /* ---------- Brand ---------- */
  --color-primary:        #059669;
  --color-primary-hover:  #047857;
  --color-primary-soft:   #d1fae5;
  --color-secondary:      #7c3aed;
  --color-accent:         #d97706;

  /* ---------- Status ---------- */
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger:  #dc2626;
  --color-info:    #0284c7;

  /* ---------- Surfaces & Text ---------- */
  --color-bg:             #f8fafc;
  --color-surface:        #ffffff;
  --color-surface-alt:    #f1f5f9;
  --color-border:         #e2e8f0;
  --color-text:           #0f172a;
  --color-text-muted:     #64748b;
  --color-text-on-primary:#ffffff;

  /* ---------- Typography ---------- */
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;
  --weight-regular: 400;
  --weight-medium:  500;
  --weight-bold:    700;
  --line-height:    1.5;

  /* ---------- Spacing scale (use only these) ---------- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  /* ---------- Shape & Depth ---------- */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 999px;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, .06);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, .10);
  --shadow-lg: 0 12px 32px rgba(15, 23, 42, .16);

  /* ---------- Layout ---------- */
  --header-height: 56px;
  --sidebar-width: 240px;
  --container-max: 1200px;
  --touch-target:  44px;      /* minimum tap size on mobile */

  /* ---------- Breakpoints (reference only, CSS vars can't be used in @media) ----------
     mobile:  0 - 599px
     tablet:  600px - 1023px
     desktop: 1024px+
  ------------------------------------------------------------------------------------- */

  /* ---------- Motion ---------- */
  --transition: 150ms ease;
}

/* ---------- Dark theme: override ONLY the tokens ---------- */
[data-theme='dark'] {
  --color-bg:          #0b1220;
  --color-surface:     #111a2e;
  --color-surface-alt: #172238;
  --color-border:      #24324d;
  --color-text:        #e5edf9;
  --color-text-muted:  #94a3b8;
  --color-primary-soft:#064e3b;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, .4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, .5);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, .6);
}

/* Optional: per-clinic branding without code changes */
[data-brand='clinic-custom'] {
  --color-primary:       var(--clinic-primary, #059669);
  --color-primary-hover: var(--clinic-primary-hover, #047857);
}
```

### 1.3 Theme switcher (light / dark / system)

```js
// frontend/src/theme/useTheme.js
import { useEffect, useState } from 'react';

const KEY = 'petcare-theme'; // 'light' | 'dark' | 'system'

export function useTheme() {
  const [mode, setMode] = useState(() => localStorage.getItem(KEY) || 'system');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    localStorage.setItem(KEY, mode);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);

  return { mode, setMode };
}
```

Add this inline script to `index.html` `<head>` to avoid a white flash on load:

```html
<script>
  (function () {
    var m = localStorage.getItem('petcare-theme') || 'system';
    var d = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = d ? 'dark' : 'light';
  })();
</script>
```

### 1.4 Theme rules (strict)

| Do | Don't |
|:---|:---|
| `color: var(--color-text);` | `color: #0f172a;` |
| `padding: var(--space-4);` | `padding: 17px;` |
| `border-radius: var(--radius-md);` | `border-radius: 9px;` |
| `font-size: var(--text-lg);` | `font-size: 18px;` |
| Add a new token in `theme.css` if one is missing | Inline `style={{ color: 'red' }}` in JSX |
| Use semantic names (`--color-danger`) | Use raw names (`--red-500`) in components |

**Enforcement:** add a lint check that fails on hex colors outside `theme.css`:

```bash
# package.json script
"lint:theme": "! grep -rnE '#[0-9a-fA-F]{3,8}\\b' frontend/src --include=*.css --include=*.jsx --exclude=theme.css"
```

---

## 2. Mobile-Responsive Rules

### 2.1 Mandatory HTML meta

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### 2.2 Breakpoints (mobile first, `min-width` only)

```css
/* default = mobile (0-599px), write these styles first */

@media (min-width: 600px)  { /* tablet  */ }
@media (min-width: 1024px) { /* desktop */ }
```

Never use `max-width` queries or device-specific widths (like 375px or 768px) for layout logic.

### 2.3 Layout rules

1. **Flexbox / Grid only.** No fixed pixel widths on containers. Use `%`, `fr`, `minmax()`, `clamp()`.
2. **No horizontal scroll** on the page at any width. Wide tables scroll inside their own wrapper:
   ```css
   .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
   ```
3. **Tap targets ≥ 44×44px** (`var(--touch-target)`) for buttons, icons, checkboxes.
4. **Font size ≥ 16px on inputs** (prevents iOS zoom on focus).
5. **Use `dvh`, not `vh`**, for full-height screens (mobile browser bars): `min-height: 100dvh`.
6. **Safe areas** for notched phones: `padding-bottom: env(safe-area-inset-bottom)`.
7. **Images / video:** `max-width: 100%; height: auto;`
8. **Sticky primary actions on mobile:** Record, Approve & Sign, Save sit in a bottom bar.
9. **Modals become full-screen bottom sheets on mobile**, centered dialogs on desktop.
10. **Navigation:** bottom tab bar or hamburger on mobile, sidebar on desktop.

### 2.4 Standard layout patterns

```css
/* layout.css */
.container {
  width: 100%;
  max-width: var(--container-max);
  margin-inline: auto;
  padding-inline: var(--space-4);
}

/* Card grid: 1 col mobile, 2 tablet, 3 desktop, no media queries needed */
.grid-cards {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
}

/* App shell */
.app-shell { display: grid; min-height: 100dvh; grid-template-rows: var(--header-height) 1fr; }
.sidebar   { display: none; }                       /* mobile: hidden, use bottom nav */
.bottom-nav{ position: fixed; inset: auto 0 0 0; padding-bottom: env(safe-area-inset-bottom); }

@media (min-width: 1024px) {
  .app-shell  { grid-template-columns: var(--sidebar-width) 1fr; grid-template-rows: var(--header-height) 1fr; }
  .sidebar    { display: block; }
  .bottom-nav { display: none; }
}

/* Modal: bottom sheet on mobile, dialog on desktop */
.modal {
  position: fixed; inset: 0;
  background: var(--color-surface);
  overflow-y: auto;
}
@media (min-width: 1024px) {
  .modal {
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    width: min(720px, 90vw);
    max-height: 85dvh;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }
}
```

### 2.5 PetCare-specific responsive behavior

| Screen | Mobile (<600) | Tablet (600-1023) | Desktop (1024+) |
|:---|:---|:---|:---|
| Consultation workspace | Stacked: patient banner → record controls → tabs (Transcript / Summary / Rx / Lab) | Two columns: transcript + documents | Transcript left, documents right, insights as modal |
| Document tabs | Horizontal scroll tabs | Full tabs | Full tabs |
| Insights modal | Full-screen sheet, sticky Approve/Reject bar | Centered dialog | Centered dialog |
| Directory tables | Card list (one card per row) | Table | Table |
| Owner portal | Mobile-first (most owners use phones) | Same | Centered max-width column |
| Waveform / timer | Full width, large Record button | Same | Inline |

---

## 3. Side-by-Side Verification (Code + Layout)

**Every UI change must be checked visually before it is marked complete.**

### 3.1 Required viewports to check

| Name | Width × Height | Represents |
|:---|:---|:---|
| Mobile S | 360 × 640 | Small Android |
| Mobile L | 414 × 896 | Large phone / iPhone |
| Tablet | 768 × 1024 | iPad portrait |
| Laptop | 1280 × 800 | Standard desktop |
| Wide | 1920 × 1080 | Large monitor |

Also check **light and dark** themes on at least Mobile S and Laptop.

### 3.2 Manual workflow (developer)

1. Open the app in Chrome, DevTools → **Toggle device toolbar** (Ctrl/Cmd+Shift+M).
2. Dock DevTools to the **right or bottom** so the **code editor and the live preview are visible side by side**.
3. Use VS Code / Antigravity split view: component file on the left, browser preview on the right.
4. Drag the viewport width from 360 → 1920 and watch for overflow, overlap, clipped text, tiny tap targets.
5. Toggle light / dark.
6. Only then commit.

### 3.3 Automated check (Playwright, runs at all viewports)

```js
// frontend/e2e/responsive.spec.js
import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile-s', width: 360,  height: 640 },
  { name: 'mobile-l', width: 414,  height: 896 },
  { name: 'tablet',   width: 768,  height: 1024 },
  { name: 'laptop',   width: 1280, height: 800 },
  { name: 'wide',     width: 1920, height: 1080 },
];
const themes = ['light', 'dark'];
const pages  = ['/login', '/doctor', '/doctor/consultations/1', '/directory', '/owner'];

for (const vp of viewports) for (const theme of themes) for (const path of pages) {
  test(`${path} @ ${vp.name} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.addInitScript(t => localStorage.setItem('petcare-theme', t), theme);
    await page.goto(path);

    // 1. No horizontal page scroll
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow, 'page has horizontal scroll').toBe(false);

    // 2. Tap targets at least 44px on mobile
    if (vp.width < 600) {
      const small = await page.$$eval('button, a, [role=button], input[type=checkbox]', els =>
        els.filter(e => {
          const r = e.getBoundingClientRect();
          return r.width && r.height && (r.width < 44 || r.height < 44);
        }).map(e => e.outerHTML.slice(0, 80))
      );
      expect(small, 'tap targets under 44px').toEqual([]);
    }

    // 3. Screenshot for visual review / regression
    await expect(page).toHaveScreenshot(`${path.replace(/\//g, '_')}-${vp.name}-${theme}.png`, {
      fullPage: true, maxDiffPixelRatio: 0.01,
    });
  });
}
```

Run:

```bash
cd frontend && npx playwright test responsive.spec.js
```

Review the screenshots side by side (mobile vs tablet vs desktop) before merging.

---

## 4. Component Rules

- **Buttons:** one `.btn` base with variants `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`. Height `var(--touch-target)`.
- **Forms:** labels above inputs on mobile, single column; two columns only from 1024px.
- **Tables:** `<div class="table-wrap">` on tablet/desktop; card list on mobile.
- **Icons:** Lucide only, sized via tokens (`20px` default, `24px` on mobile nav).
- **Text:** never truncate clinical content (drug name, dose) silently. Wrap it. If truncated, provide expand.
- **Colors carry meaning, not decoration:** danger = contraindication/reject, warning = missing info, success = approved. Always pair color with an icon or text (accessibility).
- **Loading, empty and error states** are required for every data view.
- **Accessibility:** contrast ≥ 4.5:1 for text in both themes, visible focus ring, `aria-label` on icon-only buttons, respect `prefers-reduced-motion`.

---

## 5. Definition of Done for any UI change

- [ ] Uses tokens only (no hex, no magic pixel numbers outside `theme.css`)
- [ ] Looks correct at 360, 414, 768, 1280, 1920 widths
- [ ] Looks correct in light and dark themes
- [ ] No horizontal page scroll
- [ ] Tap targets ≥ 44px on mobile
- [ ] Loading / empty / error states handled
- [ ] Keyboard and screen reader basics work
- [ ] Playwright responsive spec passes
- [ ] `npm run lint:theme` passes

---

## 6. Instructions for AI Agents (copy into `AGENTS.md`)

```md
## UI rules (mandatory)
- Read UI_GUIDELINES.md before any frontend change.
- Never hardcode colors, font sizes, spacing or radius. Use CSS variables from
  frontend/src/styles/theme.css. If a token is missing, add it to theme.css first.
- Write mobile-first CSS using min-width media queries at 600px and 1024px only.
- After every UI change, verify at 360, 768 and 1280 px widths, in light and dark themes,
  and report what you checked. Do not claim a layout works without checking it.
- Do not create new CSS files with their own color values. Reuse components.css classes.
- Do not use inline styles for color, spacing or font.
- Run `npm run lint:theme` and the Playwright responsive spec before finishing.
```

---

## 7. How to Re-Theme in One Change

| Goal | What to edit |
|:---|:---|
| New brand color | `--color-primary*` in `theme.css` |
| Different font | `--font-sans` in `theme.css` (+ font import in `index.html`) |
| Rounder UI | `--radius-*` in `theme.css` |
| Tighter / looser spacing | `--space-*` in `theme.css` |
| Dark mode tweak | `[data-theme='dark']` block in `theme.css` |
| Per-clinic branding | Set `--clinic-primary` from clinic settings at runtime: `document.documentElement.style.setProperty('--clinic-primary', value)` |

No other file should need to change.

