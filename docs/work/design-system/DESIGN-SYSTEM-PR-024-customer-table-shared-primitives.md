---
id: "DESIGN-SYSTEM-PR-024"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 12 / DEN-267"
linear: "DEN-267"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
dependencies:
  - "DEN-250"
  - "DEN-251"
  - "DEN-264"
  - "DEN-265"
  - "DEN-266"
updated: "2026-05-24"
---

# Customer Table Shared Primitives

## Goal

Apply the DEN-264 shared `EmrTableHeaderCell` and `EmrTableCellText` primitives to the customer management table renderer.

## Scope

- Classify customer table columns by header role, resize policy, and text mode.
- Apply shared header cells to the customer management data table renderer.
- Apply shared cell text primitives to scalar customer table text.
- Keep scalar/contact/status/date values one-line by default.
- Allow limited two-line preview for person/patient names, connected guardian/patient summaries, and CS/work summaries where clipping causes meaning loss.
- Exclude selection and row action columns from resize affordance policy.
- Preserve customer workflow behavior, row selection, column visibility, detail drawer opening, search/filter behavior, and mock/session behavior.
- Capture browser evidence with mock auth so the report shows the customer table, not the login screen.

## Out Of Scope

- Broad adoption across all remaining EMR modules.
- New sort, filter, column menu, or real resize behavior.
- Live Supabase validation, migrations, RLS, server enforcement, real customer data import, role/permission policy changes, or external messaging integration.
- Status changes for DEN-250, DEN-251, DEN-264, DEN-265, or DEN-266.

## Implementation Notes

- `src/features/customer/module.tsx` owns the local customer table column policy metadata.
- The shared renderer now records header interaction and resize metadata for visible customer columns.
- String/number cell values are wrapped with `EmrTableCellText`; complex badge cells remain feature-local content.
- The focused acceptance test verifies the patient table because it is the default customer management dense table surface.

## Verification

- `npx eslint src/features/customer/module.tsx tests/customer.spec.ts`
- `npx tsc --noEmit`
- `npx playwright test tests/customer.spec.ts -g "customer workspace renders animal master list" --reporter=line`
- `npx playwright test tests/customer.spec.ts --reporter=line`
- Browser QA for `/w/clair-demo/customer?modulePanel=open` with mock auth.
- `npm run lint`
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-267. This is a narrow customer management table primitive adoption slice; full remaining module adoption and real sorting/filtering remain out of scope.
