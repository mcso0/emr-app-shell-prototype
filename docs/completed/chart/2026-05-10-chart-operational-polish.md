---
id: "CHART-PR-004"
completed: "2026-05-10"
area: "chart"
work_item: "docs/work/chart/CHART-PR-004-chart-operational-polish.md"
---

# Chart Operational Polish Closeout

## Summary

CHART-PR-004 refined the 진료(차트) workspace into a brighter, quieter operational SaaS screen using the CLAiR EMR light foundation. This was a visual and structural polish only: no chart data, order workflow state, live DB/API boundary, Supabase behavior, or semantic status colors changed.

## Completed

- Dropped the stale stash after confirming it mostly contained already-merged reverse diffs; unused `avatar.tsx` and `progress.tsx` were intentionally left out.
- Replaced chart-local hardcoded panel, muted, border, and radius styling with `--emr-*` aliases in the chart root, SOAP, diagnosis, order table, order footer, and chart dialogs.
- Added a stable order table wrapper with hairline border, muted header, white body rows, and horizontal overflow behavior.
- Added `min-w-0` containment to chart workspace panels so the history aside and right panel can both be open without SOAP, diagnosis, or order areas sliding underneath the right panel.
- Tightened the order footer so selected count, totals, discount input, and action buttons remain visible in narrower chart layouts.
- Updated the work index, work item, and current status document.

## Verification

- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Manual visual screenshots:
  - `/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed`
  - `/w/clair-demo/treatment?modulePanel=open&aside=history&right=open`
  - `/w/clair-demo/home?modulePanel=open`

## Notes

- Home stayed on the restored `홈` / `업무 현황` tab model.
- The chart right-panel layout check caught an overflow issue during implementation; the fix is included in this PR via workspace `min-w-0` containment.
