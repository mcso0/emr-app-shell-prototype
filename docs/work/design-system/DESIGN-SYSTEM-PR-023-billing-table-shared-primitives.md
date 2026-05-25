---
id: "DESIGN-SYSTEM-PR-023"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 12 / DEN-266"
linear: "DEN-266"
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
updated: "2026-05-24"
---

# Billing Invoice Table Shared Primitives

## Goal

Apply the DEN-264 shared `EmrTableHeaderCell` and `EmrTableCellText` primitives to the billing invoice line table only.

## Scope

- Classify billing invoice line columns by header role, resize policy, and text mode.
- Apply shared header cells to the billing invoice line table headers.
- Apply shared cell text primitives to visible billing invoice line text.
- Keep scalar billing values one-line by default.
- Allow limited two-line preview only for invoice item description text.
- Exclude input/display-only financial columns from resize affordance policy.
- Preserve billing workflow, invoice line quantity editing, confirmation dialogs, payment state behavior, and mock/session behavior.
- Capture browser evidence with mock auth so the report shows the billing table, not the login screen.

## Out Of Scope

- Broad adoption across all remaining EMR tables.
- New sort, filter, column menu, or real resize behavior.
- Live Supabase validation, migrations, RLS, server enforcement, persistence, payment-provider confirmation, email, deploy, or production data work.
- Status changes for DEN-250, DEN-251, DEN-264, or DEN-265.

## Implementation Notes

- `src/features/billing/module.tsx` owns the local billing invoice line column policy metadata.
- The table is treated as a `financial-edit-grid`: item descriptions can use two-line preview, while amounts and calculated values stay one-line.
- Quantity remains an editable input column and is excluded from resize affordance policy.
- Discount and total amount columns remain display-only in this scope and are excluded from resize affordance policy.

## Verification

- `npx eslint src/features/billing/module.tsx tests/billing.spec.ts`
- `npx tsc --noEmit`
- `npx playwright test tests/billing.spec.ts -g "billing workspace renders waiting invoice, guardian group, editable lines, and payment actions" --reporter=line`
- Browser QA for `/w/clair-demo/billing?modulePanel=open&right=open&aside=closed` with mock auth.
- `npm run lint`
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-266. This is a narrow billing invoice table adoption slice; full-table adoption and real sorting/filtering remain out of scope.
