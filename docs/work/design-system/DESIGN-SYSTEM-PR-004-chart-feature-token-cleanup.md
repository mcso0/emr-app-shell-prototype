---
id: "DESIGN-SYSTEM-PR-004"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 4"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/completed/design/2026-05-14-shared-semantic-token-adoption.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
updated: "2026-05-14"
---

# Chart Feature Semantic Token Cleanup

## Goal

Convert the 진료(차트) feature screen's remaining direct Clair atomic/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in the requested high-priority feature screens to classify follow-up work.
- Change only `src/features/chart/module.tsx` for this PR-sized pass.
- Replace local chart screen text, hover, selected, link, dirty/status, danger, drag, and shadow color usage with shadcn or EMR semantic aliases.
- Preserve current session-only chart behavior, SOAP/order interactions, and existing user-owned chart test updates.

## Out Of Scope

- Editing generated Clair token output.
- Recoloring reception, lab/imaging, profile drawer, home kanban, auth/login, inpatient, customer, hospital-admin, billing, or dispensing screens.
- Changing live DB/API, Supabase, permissions, persistence, or server enforcement.
- Refactoring shared component APIs.

## Done When

- Chart direct `clair-color-*`, hex, and rgba color usage is removed from `src/features/chart/module.tsx` under the audit pattern used for this work.
- Semantic status meaning is preserved: info/link remains informational, danger remains destructive/error, neutral structure stays neutral.
- Follow-up feature screens are listed for later cleanup.
- Focused chart verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/chart.spec.ts --reporter=line`

## Handoff Notes

Started from a dirty worktree containing existing user changes in `src/features/chart/module.tsx`, `src/shell/nav-rail.tsx`, and `tests/chart.spec.ts`. This pass works with the chart changes and leaves nav rail/test edits intact.

Completed on 2026-05-14. `src/features/chart/module.tsx` has no remaining matches for the direct color audit pattern used in this work.
