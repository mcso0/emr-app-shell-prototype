---
id: "CHART-PR-004"
status: "done"
area: "chart"
priority: "P1"
target_pr: "PR 4"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
dependencies:
  - "CHART-PR-003"
  - "DESIGN-SYSTEM-PR-001"
updated: "2026-05-10"
---

# Chart Operational Polish

## Goal

Refine the 진료(차트) workspace into a brighter, quieter operational SaaS screen using the CLAiR EMR design direction and EMR surface aliases.

## PR Gate

- Goal: improve visual hierarchy, surface consistency, table stability, and panel density in the chart workspace.
- PR-sized scope: stale stash cleanup, chart work item/docs, chart module visual structure, focused chart/app-shell/home verification.
- Out of scope: live DB/API persistence, Supabase, audit events, billing workflow mutation, order status mutation, semantic status color redesign, new shared primitives.
- Done criteria: chart remains bright; SOAP, diagnosis, and order areas use quieter panel/surface rules; order table has stable wrapper/overflow; footer information and actions scan cleanly; existing chart safety UX still passes.
- Source docs: current status, CLAiR EMR design guide, Light Operational Foundation.
- Verification: docs check, lint, TypeScript, build, focused Playwright chart/app-shell/home suites, manual visual screenshots.
- Status/dependencies: done; depends on completed chart safety UX and design foundation.
- Duplicate check: previous chart work covered workspace structure, scroll boundary, safety UX, and order table semantics; this item is limited to visual operational polish.

## Scope

- Use `--emr-surface-app`, `--emr-surface-panel`, `--emr-surface-muted`, `--emr-line-hairline`, `--emr-line-strong`, and `--emr-radius-panel` where the chart screen currently hardcodes equivalent surfaces.
- Keep patient context, chart completion dialog, order confirmation dialog, and selected-order behavior unchanged.
- Add a stable order table wrapper with hairline border, muted header, white body, and horizontal overflow handling.
- Tighten the order footer layout so summary, selected total, discount input, and actions remain readable.
- Update current status and add a closeout when complete.

## Out Of Scope

- Adding `Avatar`, `Progress`, or other unused primitives.
- Changing generated Clair tokens.
- Changing chart data, mock stores, or order workflow state.
- Pixel-perfect reference alignment.

## Verification

- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Manual visual checks:
  - `/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed`
  - `/w/clair-demo/treatment?modulePanel=open&aside=history&right=open`
  - `/w/clair-demo/home?modulePanel=open`

## Completion Notes

- Dropped stale stash after confirming it mostly represented already-merged reverse diffs; unused `avatar.tsx` and `progress.tsx` were not added.
- Updated chart workspace surfaces to the EMR alias layer while keeping patient context, dialogs, data, and status semantics unchanged.
- Added `min-w-0` containment to the chart workspace so SOAP, diagnosis, and order panels stay inside the available width when the history aside and right panel are both open.
- Stabilized the order table with a bordered overflow wrapper and tightened the order footer so totals and actions remain visible in narrower chart layouts.
