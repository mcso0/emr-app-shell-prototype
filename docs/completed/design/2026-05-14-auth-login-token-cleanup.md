---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/engineering/auth-security/mvp-auth-transition-roadmap.md"
  - "docs/engineering/auth-security/auth-login/status.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-015-auth-login-token-cleanup.md"
---

# Auth/Login Semantic Token Cleanup Closeout

## Summary

Completed the third residual screen cleanup after the primary feature screens. This pass scoped `/login`, auth gate loading states, login mock controls, and auth-related top menu/profile controls.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Login fallback and auth gate loading panels used direct Clair background, text, line, and `bg-white` utilities.
- Login form and development controls used direct background, label, primary selected-state, danger error, and subtle panel tokens.
- Mock role/storage options used direct primary/line tokens and direct radio accent color.
- Top menu workspace selector used direct service background fallback hex, line/text/primary colors, `bg-white`, and `text-black`.
- Auth profile trigger/menu used direct label colors, gray avatars, success indicator colors, `border-white`, and rgba shadow.

## Completed

- Converted login/auth surfaces, error/status panels, selected mock options, radio accent, workspace selector, top menu icon buttons, auth profile avatar/indicator, and menu text to shadcn/EMR semantic tokens.
- Preserved the original status meanings: provider errors remain danger, selected mock options remain selected/info, active user indicators remain success, and neutral surfaces remain neutral.
- Added an auth/login source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- Broader app shell and secondary chrome direct color audit outside the scoped auth/profile controls.
- Any live Supabase validation, callback route, migration/RLS, or server permission enforcement implementation.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "auth login source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 244 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/auth.spec.ts --reporter=line` (`24 passed`)
