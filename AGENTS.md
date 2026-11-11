# Agent Guidelines & Working Agreements

This document defines core operating rules for all AI coding agents (Claude, Antigravity, Cursor, etc.) working in this repository.

---

## 1. UI Rules (Mandatory)

> Full specification: [UI_GUIDELINES.md](file:///c:/Users/Athavan/Desktop/Voice%20to%20transcript/UI_GUIDELINES.md)

- **Read `UI_GUIDELINES.md` before any frontend change.**
- **Never hardcode colors, font sizes, spacing or radius.** Use CSS variables from `frontend/src/styles/theme.css`. If a token is missing, add it to `theme.css` first.
- **Write mobile-first CSS** using `min-width` media queries at `600px` and `1024px` only.
- **After every UI change, verify at 360, 768 and 1280 px widths**, in light and dark themes, and report what you checked. Do not claim a layout works without checking it.
- **Do not create new CSS files with their own color values.** Reuse `components.css` classes.
- **Do not use inline styles** for color, spacing or font.
- **Run `npm run lint:theme` and the Playwright responsive spec** before finishing.

---

## 2. Safe Editing Rules

- **Run `graphify explain "<symbol>"` first** before changing any symbol to understand what connects to it.
- **State the file(s) you will modify** explicitly.
- **State what you will NOT modify**.
- **Explain why each edit is necessary** — fix the bug/task, no "while we're here" cleanup.
- **Make the minimal change.**

---

## 3. Knowledge Graph Maintenance

- After modifying code files in this session, run `graphify update .` to keep the graph current.

