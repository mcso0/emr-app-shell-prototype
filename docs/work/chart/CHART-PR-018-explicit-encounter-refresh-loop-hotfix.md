---
id: "CHART-PR-018"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "Production hotfix / explicit chart encounter refresh loop"
source_docs:
  - "docs/work/chart/CHART-PR-013-preconsultation-figma-alignment.md"
  - "docs/engineering/operations/production-release-staging-to-main-runbook.md"
dependencies:
  - "CHART-PR-013"
updated: "2026-07-21"
---

# Explicit Chart Encounter Refresh Loop Hotfix

## Goal

Keep a chart deep link stable while a live-queue refresh temporarily omits its encounter, preventing the explicit URL effect and queue cleanup effect from repeatedly replacing each other's selection.

## Scope

- Preserve an explicitly requested encounter ID during the live-queue cleanup effect.
- Add a focused browser regression that reproduces the temporary-omission path and asserts that the chart shell does not reach the application error boundary.
- Keep the existing normal preconsultation call flow and queue-selection coverage in the focused verification set.

## Out of Scope

- Changing queue API data, workspace access, session persistence, consultation state transitions, or chart data persistence.
- Changing the Figma-aligned preconsultation layout, today-vital edit control, or patient and guardian profile actions.
- Adding new fallback data when an explicitly linked encounter is genuinely unavailable.

## Done Criteria

1. A refreshed queue that does not currently contain the explicit encounter cannot clear and reapply the selection in a render loop.
2. The focused browser regression fails before the guard and passes after it.
3. Existing focused preconsultation call and queue-selection regressions continue to pass.
4. Type, lint, build, documentation, and secret checks pass before promotion.

## Verification

- The new focused browser regression reproduced `Maximum update depth exceeded` before the guard.
- `npx playwright test tests/chart.spec.ts -g 'chart explicit encounter does not crash when the refreshed queue temporarily omits it|chart consultation CTA moves from call to start before chart completion|chart queue selection changes the selected encounter' --project=chromium`: 3 passed.
- `npm run security:secrets`, `npm run docs:check`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`: passed. The build retains the existing broad Turbopack NFT trace warning rooted in `src/lib/prd-viewer/doc-reader.ts`.
- Release verification will be appended with the exact PR, commit, deployment, and production smoke evidence.
