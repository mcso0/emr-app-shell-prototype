---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-016-shell-chrome-token-cleanup.md"
---

# Shell Chrome Semantic Token Cleanup Closeout

## Summary

Completed the fourth residual screen cleanup after the primary feature screens. This pass scoped the app shell chrome and global command palette in `src/shell/**`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- App shell root used a direct service background token with a hex fallback.
- Nav rail used hard-coded dark hex surfaces, direct gray icon color, rgba active state, direct green status color, and direct divider hex.
- Global command trigger/dialog used direct Clair line/background/fill tokens, `bg-white`, and arbitrary rgba shadows.
- Command empty state, footer, active rows, icons, and badges used direct local surfaces/text colors.

## Completed

- Converted app shell background to the EMR app surface alias.
- Converted nav rail shell, inactive/active states, avatar, online indicator, and divider to shadcn/EMR semantic tokens.
- Converted global command trigger, dialog content, keyboard hint, empty state, footer, command rows, row icons, and badges to semantic/EMR tokens.
- Added a shell chrome source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- Shared `src/components/emr/**` secondary component direct color audit.
- `src/components/ui/**` wrapper audit if a later broad scan finds local color drift.
- PWA manifest/theme metadata and generated icon/asset-like files.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "shell chrome source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 246 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts tests/auth.spec.ts --reporter=line` (`47 passed`)
