---
id: "CHART-PR-028"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "Browser comments / diagnosis and chart history information hierarchy"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
dependencies:
  - "CHART-PR-025"
updated: "2026-08-31"
---

# Diagnosis And Chart History Information Hierarchy

## Goal

Give the inline `History / 진단이력` panel and the expanded `차트이력` aside distinct clinical information priorities while preserving the existing live patient-history read model and read-only historical-chart workflow.

## Approved Scope

- Keep the shared `EmrContentHistoryItem` visual primitive unchanged.
- Render inline diagnosis history from prior encounters only, with visit time, primary-first diagnosis summary, additional-diagnosis count, and veterinarian.
- Render the chart-history aside with current and prior encounters, using visit time, visit purpose, encounter status, and veterinarian.
- Remove encounter number and duplicated full date-time metadata from both compact history cards.
- Keep historical selection presentation-only so the active queue encounter and URL remain unchanged and historical charts stay read-only.
- Align diagnosis-history search and empty states with the prior-diagnosis purpose.
- Add focused browser regression coverage for both representations.

## Ownership Decision

- Supabase and the existing chart history route remain the owner of the workspace-scoped patient encounter set.
- `ChartHistoryItem` remains the feature-local adapter from one history record to the shared card primitive.
- The inline panel owns diagnosis-history filtering and diagnosis-focused search.
- The content aside owns visit-history presentation and keeps the full current-plus-prior encounter set.

## Out Of Scope

- Supabase schema, RPC, RLS, permission, or paging changes.
- Editing or reclassifying historical diagnoses.
- Changing encounter lifecycle, queue membership, or the historical read-only guard.
- Heuristically hiding numeric or malformed visit-purpose values.
- Correcting synthetic Cheongdam `visit_purpose` values in the remote database.
- Changing shared history cards used by lab, imaging, or dispensing.

## Done Criteria

1. Inline diagnosis history excludes the active writable encounter and shows prior diagnosis records grouped by date.
2. Diagnosis cards show `HH:mm`, the first server-ordered diagnosis plus `외 N건`, and veterinarian only; they do not show encounter number, duplicated date-time, or status badge.
3. Chart-history aside keeps the current and prior encounter set and shows `HH:mm`, visit purpose, status, and veterinarian only.
4. Missing diagnoses and visit purposes use honest, semantic empty labels instead of falling back to encounter numbers or unrelated clinical fields.
5. Historical selection preserves the current encounter URL/queue and all historical mutation guards.
6. Focused lint, typecheck, server history, browser history, build, docs, secret, and diff checks pass.

## Verification

- `npx eslint src/features/chart/module.tsx tests/chart.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npx playwright test tests/chart-patient-history-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --grep "live patient chart history" --reporter=line`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Verification Result

- PASS — focused and repository-wide ESLint
- PASS — TypeScript `--noEmit`
- PASS — chart patient-history server boundary tests, 5 cases
- PASS — focused browser history regression, including secondary-diagnosis search, current-encounter exclusion, active URL/queue preservation, and historical read-only behavior
- PASS — production build, docs links, secret scan, and diff whitespace check
- BASELINE — the broader chart history grep also reaches an unrelated Assessment locator assertion that fails unchanged on `origin/main`; the rendered diagnosis is present, but the legacy locator expects a retired cell-text attribute

## Closeout

- `docs/completed/chart/2026-08-31-chart-history-information-hierarchy-report.html`

## Remote Boundary

This work changes only client presentation and focused regression coverage. The existing live history RPC, route permission boundary, database rows, and production deployment remain unchanged until separately authorized delivery work.
