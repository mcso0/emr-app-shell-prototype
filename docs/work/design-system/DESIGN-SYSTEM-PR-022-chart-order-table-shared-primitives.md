---
id: "DESIGN-SYSTEM-PR-022"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 12 / DEN-265"
linear: "DEN-265"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-021-shared-table-header-cell-text-primitives.md"
dependencies:
  - "DEN-250"
  - "DEN-251"
  - "DEN-264"
updated: "2026-05-24"
---

# Chart/order Table Shared Primitive Adoption

## Goal

Apply the DEN-264 `EmrTableHeaderCell` and `EmrTableCellText` primitives to the chart/order dense clinical table without broad table migration or new sort/filter behavior.

## Scope

- Inspect chart/order table structure and classify column roles.
- Apply `EmrTableHeaderCell` to chart/order table headers.
- Apply `EmrTableCellText` to chart/order table text cells.
- Keep scalar values one-line by default.
- Allow limited two-line preview only for high-value long clinical text such as order names and diagnosis names.
- Keep checkbox, action, and display-only columns out of resize affordance scope.
- Preserve chart workflow, order draft editing, order confirmation, mock auth, and session behavior.

## Out Of Scope

- Whole-app table migration.
- New live sort or filter behavior.
- New data grid library adoption.
- Supabase validation, DB migration, RLS, server enforcement, or role-policy changes.
- Moving DEN-250, DEN-251, DEN-264, or other Linear issues to Done.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- Focused Playwright for chart/order workflow
- Browser QA with mock auth and chart/order table evidence screenshot
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-265. The implementation stays limited to chart/order table primitive adoption, with evidence and closeout at `docs/completed/design/2026-05-24-den-265-chart-order-table-shared-primitives-report.html`.

## Local follow-up — 2026-10-31

- User approved local implementation and verification of full order-name tooltips; remote DB and deployment are excluded.
- Based on `origin/main` at `7baa5f89`, isolated in `codex/order-name-tooltip` to preserve existing WIP.
- Plan/Order opts into `EmrTableCellText.tooltipOnOverflow`. Only clipped one-line names expose the shared tooltip on hover/focus; column resize updates availability. Native titles remain unchanged for other callers.
- Synthetic Storybook checks cover full text, short text, keyboard focus, resize, and row click propagation. Three focused Chromium story tests passed. Manual browser hover and rendered appearance were also verified.
- Verification: lint, TypeScript, docs check, Storybook build and smoke passed. The initial shared-dependency test-runner path error and span/div ref typing error were corrected; final focused browser tests and type checks passed. Local-only; authenticated application and production behavior are not claimed.

### Release authorization — 2026-10-31

- User subsequently authorized delivery of this bounded tooltip task through Production. The earlier local-only limit is superseded for this task.
- No DB, API, schema, permission, or migration change is included, so no remote DB application is required.
- Release scope is the five changed source/story/documentation files. Local browser artifacts remain untracked and are not published.
- Require current-candidate Release Check, Ready Preview, local production preflight, and exact-head merge protection. Smoke covers `/login` availability and shipped tooltip code; focused interaction evidence uses synthetic local Storybook data. No remote clinical rows or mutation flows are needed.
- Record exact candidate, Preview/Production deployment, rollback candidate and final outcomes in the local release evidence. Stop on failed required checks, unexpected source SHA, unavailable Preview, or failed smoke.
