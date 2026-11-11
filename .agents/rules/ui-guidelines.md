---
trigger: always_on
description: UI, Theme & Mobile-Responsive rules for all frontend modifications.
---

## UI, Theme & Mobile-Responsive Rules

When modifying or creating any frontend code:

1. **Read `UI_GUIDELINES.md` first.**
2. **Single Theme File:** All colors, font sizes, spacing, radius, and shadows live in `frontend/src/styles/theme.css`. Never hardcode colors (hex, rgb), magic pixel values, or font sizes in components or other stylesheets.
3. **Mobile First:** Write mobile-first styles using `min-width` media queries at `600px` (tablet) and `1024px` (desktop) only. Never use `max-width` queries.
4. **Side-by-Side Verification:** After every UI change, verify layout at 360px, 768px, and 1280px widths in both light and dark themes. Report what viewports were tested.
5. **No Inline Styling:** Do not use inline `style={{ ... }}` for colors, spacing, or fonts.
6. **Tap Targets & Safe Areas:** Tap targets must be >= 44x44px (`var(--touch-target)`). Use `dvh` for full viewport height and safe-area padding for mobile notches.
7. **Verification Tools:** Run `npm run lint:theme` and the Playwright responsive test suite before marking a UI task done.

