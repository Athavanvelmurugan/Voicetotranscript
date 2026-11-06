---
trigger: always_on
description: Prevent AI from introducing cascading bugs by enforcing scoped, minimal edits.
---

## Safe Editing Rules

BEFORE making any code change, you MUST:

1. **Run `graphify explain "<symbol>"` first** — understand what connects to it
2. **State the file(s) you will modify** — list them explicitly
3. **State what you will NOT modify** — list files you considered but won't touch
4. **Explain why each edit is necessary** — no "while we're here" cleanup
5. **Make the minimal change** — fix the bug, nothing more

NEVER do these without explicit user approval:
- Refactor code that isn't broken
- "Improve" error handling in unrelated files
- Update imports or type hints in files you weren't asked to change
- Add logging, comments, or formatting changes to untouched files
- Change function signatures that other files depend on

If a fix requires changing multiple files, list ALL affected files and get approval BEFORE editing.

After every edit, run: `graphify update .`

