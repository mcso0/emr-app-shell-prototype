---
id: "DESIGN-SYSTEM-PR-037"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-297"
linear: "DEN-297"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-030-hospital-admin-order-catalog-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-033-advanced-table-filter-builder-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-034-advanced-filter-builder-table-adoption.md"
dependencies:
  - "DEN-274"
  - "DEN-293"
  - "DEN-294"
  - "DEN-296"
updated: "2026-05-26"
---

# Hospital Admin Advanced Filter Builder Migration

## Goal

Migrate the hospital admin order catalog table filter UI from its feature-local builder to the reusable `EmrTableFilterBuilder` while preserving the DEN-274 order catalog sort/filter behavior and admin order workflow.

## Scope

- Replace the hospital admin order catalog local filter builder with the shared advanced builder model and UI.
- Keep order catalog table headers as single-column sort controls only.
- Keep the Filter button in the table section action area and show `Filter N` from completed active rules only.
- Keep first-open behavior to one incomplete draft condition row.
- Ignore incomplete field/operator/value rows in filtering and active count.
- Preserve existing category navigation, search, status, billing, work-type filters, mock/session behavior, row selection, row actions, and drawer workflows.
- Keep checkbox, action, and display-only columns out of filter field configs.

## Out Of Scope

- Saved views, saved filters, active chip rows, URL/localStorage/session filter persistence, server-side filtering, Supabase, DB/RLS, migrations, or live validation.
- Hospital admin order catalog workflow redesign, role-policy changes, or live production catalog changes.
- Broad all-table rollout outside the Project 13 adopted table set.

## Implementation Notes

- `src/features/hospital-admin/module.tsx` now derives order catalog filter fields for status, target species, service item type, billing linkage, and sale price threshold.
- Hospital admin order filters now auto-apply through `filterRowsByEmrTableFilterBuilder(...)`.
- The active Filter button count comes from `getEmrTableFilterBuilderActiveCount(...)`.
- Existing category/search/status/billing/work-type filters still run before advanced builder rules.
- Existing single-column sort state, row selection, action menu, drawer edit/create/use-stop behavior, and mock-auth workspace catalog reads are preserved.

## Evidence

- `docs/completed/design/evidence/2026-05-26-den-297-hospital-admin-advanced-filter-builder.png`

## Verification

- `npx eslint src/features/hospital-admin/module.tsx tests/hospital-admin.spec.ts` attempted; blocked by pre-existing dirty-worktree React hooks lint rule in `src/features/hospital-admin/module.tsx`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3109 npx playwright test tests/hospital-admin.spec.ts -g "hospital admin order catalog supports single sort and section filter builder" --reporter=line`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3109 npx playwright test tests/hospital-admin.spec.ts --reporter=line`
- `npx tsc --noEmit`
- Mock-auth Playwright screenshot evidence under `docs/completed/design/evidence/`.
- `npm run docs:check`
- `git diff --check`

## Known Verification Caveat

- Full lint is currently blocked by the existing `react-hooks/set-state-in-effect` issue in `src/features/hospital-admin/module.tsx`.

## Handoff Notes

Implementation is handed to Human Review in Linear as DEN-297 on 2026-05-26. Do not move to Done until 승욱 explicitly accepts it.
