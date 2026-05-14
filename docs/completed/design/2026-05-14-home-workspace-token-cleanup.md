---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-014-home-workspace-token-cleanup.md"
---

# Home Workspace Semantic Token Cleanup Closeout

## Summary

Completed the second residual screen cleanup after the primary feature screens. This pass scoped the home dashboard, kanban workspace, demo launcher, and related home widgets in `src/features/home/**`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Home demo launcher and shell surfaces used direct Clair background and `bg-white` utilities.
- Compact flow, task list, alerts, widgets, and hospital flow panels used direct red/orange/sky atomic status colors.
- Home kanban tabs, summary signals, role next action cards, bottleneck board, filters, kanban columns, task cards, and dividers used direct Clair label/status/background/line tokens.
- The role next action surface used a hex gradient and next action cards used an rgba shadow.

## Completed

- Converted home surfaces, hover states, labels, status badges, selected filter rows, progress bars, and dividers to shadcn/EMR semantic tokens.
- Preserved the original status meanings: urgent/danger remains danger, delay/warning remains warning, selected/info remains info/selected, and neutral structural surfaces remain neutral.
- Added a home workspace source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- auth/login cleanup.
- Any remaining secondary shell/app chrome cleanup discovered by broader audit.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "home workspace source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 243 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/home.spec.ts --reporter=line` (`28 passed`)
