---
id: "RECEPTION-PR-011"
status: "done"
area: "reception"
priority: "P1"
target_pr: "User request / reception and reservation patient lookup field alignment"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/reception/RECEPTION-PR-005-calendar-task-creation-ux.md"
dependencies: []
updated: "2026-07-15"
---

# Reception and Reservation Patient Lookup Field Alignment

## Goal

Align patient lookup fields in all reception and reservation creation presentations with the CDS V2 patient-name search field contract.

## Scope

- Apply `환자명` to walk-in and reservation creation fields.
- Place the 16px search decoration in a right-side 24px slot.
- Replace the search decoration with a right-side X while a query exists.
- Preserve the existing lookup API, selection, loading, empty, error, and clear behavior.
- Cover both side-panel and legacy drawer render paths.

## Out of Scope

- Read-only reception detail fields.
- Generic `Input` or design-system API changes.
- API, DB, RLS, or search-domain behavior changes.
- Remote Supabase or production validation.

## Done When

- All four creation render paths use the shared feature-local decoration contract.
- Clearing the query returns the field to the empty search-icon state.
- Focused reception Playwright, lint, typecheck, docs check, build, and browser QA pass.

## Verification

- `npm run lint -- src/features/reception/module.tsx tests/reception.spec.ts`
- `npx tsc --noEmit --pretty false --incremental false`
- `npm run docs:check`
- `npx playwright test tests/reception.spec.ts -g "registration and reception create side panels use CDS V2 32px controls" --reporter=line`
- Browser QA for both side-panel creation routes; no console errors or warnings.

## Result

Implemented and verified for PR merge. No API, database, or global input component changes are included.
