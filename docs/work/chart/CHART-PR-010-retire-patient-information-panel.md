---
id: "CHART-PR-010"
status: "implemented"
area: "chart"
priority: "P1"
target_pr: "Browser Comment 1 / retire chart patient information panel"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
dependencies: []
updated: "2026-07-12"
---

# Retire Chart Patient Information Panel

## Goal

Remove the retired patient information right panel from the treatment/chart workspace.

## Scope

- Remove the chart module's right-panel registration and renderer.
- Keep the chart history content-aside and patient context bar intact.
- Normalize legacy `right` query values away from treatment URLs.
- Replace panel-presence coverage with a regression test for absence and URL normalization.

## Out Of Scope

- Patient and guardian profile drawers used by other modules.
- Reception, billing, lab, imaging, and other right-panel contracts.
- Chart data, SOAP, diagnosis, order, or consultation workflows.

## Done When

- Treatment/chart no longer reserves or renders the retired patient information panel.
- A treatment URL containing `right=open` is normalized without a `right` query.
- Chart history remains available through its existing content-aside control.

## Verification

- `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts -g "chart removes the retired patient information panel and legacy right query|legacy chart route opens treatment shell without tab sync loop" --project=chromium --reporter=line`: 2 passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npx eslint src/features/chart/module.tsx src/modules/registry.ts tests/chart.spec.ts tests/app-shell.spec.ts`: passed.
- `npm run docs:check`: passed.
- `npm run build`: passed with existing dynamic filesystem tracing warnings.
