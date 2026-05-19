---
id: "DESIGN-SYSTEM-PR-020"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 06 / DEN-131"
linear: "DEN-131"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/inpatient/INPATIENT-PR-001-ward-workspace.md"
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-debt-inventory.md"
  - "docs/design/system/ui-refactor-dod.md"
dependencies:
  - "INPATIENT-PR-001"
  - "DESIGN-SYSTEM-PR-010"
  - "DESIGN-SYSTEM-PR-019"
updated: "2026-05-20"
---

# Inpatient Table And Status Standardization

## Goal

Standardize the inpatient ward board table, status badge, caution tag, and summary card patterns while preserving the existing session-only inpatient workflow.

## Scope

- Refactor inpatient ward table sizing into an explicit local column recipe.
- Preserve dense table scanning and horizontal overflow for narrow screens.
- Map admission statuses, caution tags, and summary card tones through shared semantic EMR status tone names.
- Add predictable truncation titles for long diagnosis and admission memo cells.
- Keep row selection, drawer entry, search, ward filtering, date picker, and mock discharge action behavior unchanged.

## Out Of Scope

- Inpatient lifecycle persistence.
- Discharge workflow implementation.
- Clinical diagnosis or ward data model changes.
- Server validation, audit log persistence, Supabase, DB, RLS, or migration changes.
- Real patient, guardian, hospital, or production data access.

## Implementation Notes

- `EmrStatusBadge` remains intentionally unused for inpatient status because it is label-based and currently scoped to a limited order/status vocabulary.
- Inpatient status and caution badges stay feature-local, but now resolve through semantic tone names before applying EMR status tokens.
- The `min-w-[1180px]` table decision is retained as a documented dense-table exception for stable ward-board scanning.
- The table uses `table-fixed` with local column classes so long diagnosis and memo text truncate predictably.

## Verification

- `npx eslint src/features/inpatient/module.tsx tests/inpatient.spec.ts`
- `npx tsc --noEmit`
- `npx playwright test tests/inpatient.spec.ts --reporter=line`
- Browser QA on desktop and narrow viewport for `/w/clair-demo/inpatient?modulePanel=open&right=open`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`

## Handoff Notes

Ready for Human Review as DEN-131. No inpatient persistence, discharge workflow, server validation, or production data boundary was touched.
