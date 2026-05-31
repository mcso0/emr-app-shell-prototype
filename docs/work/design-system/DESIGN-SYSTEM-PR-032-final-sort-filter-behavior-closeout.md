---
id: "DESIGN-SYSTEM-PR-032"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-276"
linear: "DEN-276"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-026-table-sort-filter-behavior-contract.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-027-billing-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-028-chart-order-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-029-customer-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-030-hospital-admin-order-catalog-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-031-adopted-table-sort-filter-qa.md"
dependencies:
  - "DEN-270"
  - "DEN-271"
  - "DEN-272"
  - "DEN-273"
  - "DEN-274"
  - "DEN-275"
updated: "2026-05-25"
---

# Final Sort And Filter Behavior Closeout

## Goal

Close out Project 13 by summarizing the approved table sort/filter contract, pilot implementation, adopted table behavior, QA evidence, and remaining exclusions.

## Scope

- Summarize DEN-270 through DEN-275 outcomes in one representative-facing closeout.
- Record the final Project 13 readiness decision in the table sort/filter behavior source doc.
- Link the final Korean HTML closeout report under `docs/completed/design/`.
- Keep the report focused on the scoped table set: billing invoice lines, chart/order rows, customer management rows, and hospital admin order catalog rows.

## Out Of Scope

- New sort/filter behavior implementation.
- Broad adoption to every table.
- Saved views, saved filters, active chip rows, multi-sort, URL or storage persistence.
- Supabase, DB/RLS, migrations, server-side sorting/filtering, live validation, pricing model, role policy, or production data changes.
- Marking unrelated Linear projects or issues Done.

## Closeout Notes

- Project 13 established a reusable policy: table headers expose sort only, while filters live in the section header action area.
- Filter buttons expose active condition count as `Filter N`.
- Filter builder conditions compose with AND, with `초기화`, `Apply filters`, and `Close` in the footer.
- Display-only, checkbox, and action columns remain static.
- Implemented and QA-checked representative tables are ready for Human Review.

## Verification

- `npm run docs:check`
- `git diff --check`

## Handoff Notes

Ready for Human Review as DEN-276. Project 13 can be marked Done only after representative acceptance.
