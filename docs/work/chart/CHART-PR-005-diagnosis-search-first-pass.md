---
id: CHART-PR-005
status: done
area: chart
priority: P1
target_pr: PR 5
source_docs:
  - docs/engineering/current-status.md
  - docs/work/chart/CHART-PR-001-workspace-restructure.md
  - docs/work/chart/CHART-PR-003-chart-safety-mvp-ux.md
  - docs/engineering/data-model/emr-saas-db-structure-spec.ko.md
dependencies:
  - CHART-PR-001
  - CHART-PR-003
updated: 2026-05-12
---

# Chart Diagnosis Search First Pass

## Goal

Add a first-pass, session-only diagnosis search and recommendation interaction to the 진료(차트) diagnosis panel.

## PR Gate

- Goal: make the diagnosis search field respond to focus and keyword entry with useful catalog recommendations and session-only row actions.
- PR-sized scope: chart diagnosis panel only, focused React state, mock catalog recommendations, focused Playwright coverage, work/status/closeout docs.
- Out of scope: live diagnosis catalog API, Supabase persistence, server validation, audit log events, order recommendation automation, billing changes.
- Done criteria: focusing the field opens recommendations; typing filters Korean/English/synonym terms; selecting a catalog result adds a diagnosis row; free text can be added as an unlinked diagnosis; rows can be marked confirmed/primary and removed in the current session.
- Source docs: current MVP status, chart workspace/safety work items, diagnosis data model.
- Verification: lint, TypeScript, chart Playwright checks, local browser smoke check.
- Duplicate check: no existing active chart diagnosis search work item was listed in `docs/work/index.md`.

## Scope

- Replace the read-only diagnosis search placeholder with a controlled search input and popover.
- Add a small mock diagnosis catalog in `src/features/chart/module.tsx`.
- Show SOAP/context-based recommendations before typing and filtered results after typing.
- Support session-only catalog selection and free-text diagnosis rows.
- Keep diagnosis row actions local to the chart panel and avoid implying persistence.
- Add Playwright coverage for recommendation, selection, status marking, free-text add, and remove.

## Out Of Scope

- Persisting diagnosis rows to the mock domain store or backend.
- Adding a real `diagnosis_catalog` API or DB migration.
- Resolving the durable meaning/storage of `중점`.
- Auto-changing SOAP, Plan, order, billing, or chart completion state from diagnosis selection.

## Verification

- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- `npm run lint`

Completed on 2026-05-12. Closeout: `docs/completed/chart/2026-05-12-diagnosis-search-first-pass.md`.
