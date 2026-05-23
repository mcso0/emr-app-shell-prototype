---
status: "active"
updated: "2026-05-23"
linear_issue: "DEN-226"
linear_project: "12 CLAiR EMR Table Density & Data Grid Ergonomics"
source_docs:
  - "docs/design/system/table-density-and-grid-ergonomics.md"
---

# Table Surface Inventory

This inventory classifies current CLAiR EMR table surfaces for Project 12.

| Surface | File | Role | Current layout | Risk | Priority |
|---|---|---|---|---|---|
| Dispensing/treatment order table | `src/components/emr/emr-data-table.tsx`, `src/features/dispensing/module.tsx` | clinical dense / order work | TanStack table with fixed column sizes; table width from `table.getTotalSize()` | high: target scroll breakage and action/footer alignment | P0 |
| Chart order draft table | `src/features/chart/module.tsx` | clinical dense / billing candidate | `min-w-[1160px] table-fixed` | high: many fixed columns, editable cells, action column | P1 |
| Billing invoice line table | `src/features/billing/module.tsx` | financial | `min-w-[720px] table-fixed` | medium: financial columns need alignment; currently stable | P1 |
| Customer guardian/patient tables | `src/features/customer/module.tsx` | master data | `min-w-[1120px]` guardian, `min-w-[1320px]` patient | medium-high: wide table, row actions, selection | P2 |
| Hospital admin order catalog | `src/features/hospital-admin/module.tsx` | admin/master data | `min-w-[1060px] table-fixed` | medium-high: many columns, search, bulk/action menu | P2 |
| Hospital admin audit table | `src/features/hospital-admin/module.tsx` | admin/history | intrinsic table with fixed head widths | medium: audit text can be long | P3 |
| Lab result input table | `src/features/lab-imaging/module.tsx` | clinical diagnostic | `min-w-[860px] table-fixed` | medium: result editing and assignee cells | P2 |
| Lab order/history table | `src/features/lab-imaging/module.tsx` | diagnostic history | `min-w-[760px] table-fixed` | medium-low: mostly read-only | P3 |
| Imaging side/order summary tables | `src/features/lab-imaging/module.tsx` | small summary / diagnostic | small fixed tables | low-medium | P3 |
| Inpatient ward table | `src/features/inpatient/module.tsx` | clinical dense / ward board | `min-w-[1180px] table-fixed` | medium-high: many columns, row drawer | P2 |
| Home task table | `src/features/home/components/home-kanban-workspace.tsx` | work queue summary | local table with fixed columns | low: outside Project 12 first adoption | P4 |
| Auth membership table | `src/features/auth/workspace-membership-management.tsx` | admin/security | `min-w-[820px] table-fixed` | defer: auth/security ownership | P4 |

## Adoption Status

- DEN-230: Dispensing/treatment order table now uses shared `Table density="compact" layout="scroll"` with a single TanStack-derived `minWidth`.
- DEN-231: Chart order draft now uses `density="compact" layout="scroll" minWidth={1160}`. Billing invoice lines use `density="standard" layout="scroll" minWidth={720}` to preserve financial readability.
- DEN-232: Customer guardian/patient, hospital admin catalog, lab result/order, imaging order summary, and inpatient ward tables now declare shared `density`, `layout="scroll"`, and explicit `minWidth` contracts. Small two-column detail tables remain local fill tables.

## Default Classification

- `compact`: dispensing/treatment order table, chart order table, inpatient ward table.
- `standard`: billing invoice, customer, hospital admin order catalog, lab result input.
- `comfortable`: audit/history, small summaries, read-only review-heavy tables.

## Fill Vs Scroll Candidates

Fill candidates:

- small summary tables
- short audit/metadata panels when column count is low

Scroll candidates:

- dispensing/treatment order table
- chart order draft table
- billing invoice line table
- customer guardian/patient tables
- hospital admin order catalog
- lab result/order tables
- inpatient ward table

## Header Interaction Risks

- Checkbox/action columns must stay static.
- Financial amount/quantity/date/status columns may become sortable after explicit column roles are added.
- Status/assignee/category columns may become filterable.
- Memo, warning, attachment, summary, compound cells stay static by default.

## Adoption Priority

1. P0: dispensing/treatment order table scroll containment.
2. P1: shared density and scroll contract, then chart/order and billing.
3. P2: customer/admin/lab/imaging/inpatient broad adoption.
4. P3/P4: small summary, home, auth/security tables after Project 12 core is stable.
