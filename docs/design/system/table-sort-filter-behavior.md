---
status: "active"
updated: "2026-05-24"
linear_issue: "DEN-270"
linear_project: "13 CLAiR EMR Table Sort & Filter Behavior"
source_docs:
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-surface-inventory.md"
  - "docs/design/system/ux-ui-research-before-implementation.md"
---

# Table Sort And Filter Behavior

This document defines the implementation contract for real table sort and filter behavior after the Project 12 table density/header/cell primitive work.

## Purpose

Project 12 intentionally separated header affordances from real behavior. `EmrTableHeaderCell` can express a header role, but it must not imply that a column sorts or filters unless the table owns a real data operation.

Project 13 adds that behavior in controlled PR-sized slices. The first implementation should prove the contract in one representative table before broad adoption.

## Scope Guardrails

- Implement sort/filter behavior only for tables explicitly covered by the active Linear issue.
- Keep display-only columns static: checkbox, action, icon-only, attachment, memo, warning/change indicator, summary, total, expander, and command columns.
- Do not add generic column menus to clinical tables by default.
- Do not add server-side sorting/filtering, Supabase persistence, RLS, migrations, payment-provider behavior, or production data behavior unless a later issue explicitly scopes it.
- Do not convert every table in one change.
- Preserve existing chart workflows, order draft/confirmation behavior, billing totals, mock auth, and session behavior.

## Header Role Contract

Use the Project 12 role vocabulary close to column definitions.

| Role | Behavior |
|---|---|
| `static` | No sort trigger, no filter trigger, no menu trigger, no keyboard tab stop created by the header. |
| `sortable` | Header label/button changes row order using an explicit sort key and comparator. |
| `filterable` | Header or toolbar control narrows rows using an explicit filter key and option source. |
| `sortable-filterable` | Column supports both real sort and real filter behavior. |
| `compound` | Static by default. Split into explicit data columns before adding sort/filter. |
| `menu` | Reserved for master-data/admin grids or explicit view configuration. |

## Sort Behavior Requirements

Every sortable column must define:

- `sortKey`: the field or derived value used for comparison.
- `sortType`: one of string, number, date/time, boolean, or explicit enum order.
- `initialDirection`: optional; default is no active sort.
- `emptyHandling`: empty, null, and missing values sort last in both ascending and descending order.
- `tieBreaker`: stable original row order or a deterministic secondary key.
- `reset`: users can return to the default unsorted row order.

Default interaction:

- Use one active sort column at a time unless an issue explicitly scopes multi-sort.
- Header activation cycles `none -> ascending -> descending -> none`.
- The active sorted header remains visibly active without hover.
- Sorting changes visible row order only; it must not mutate row identity, draft state, selected row identity, billing totals, or underlying source arrays.

Comparator rules:

- Strings use locale-aware comparison suitable for Korean and English labels.
- Numbers parse and compare numeric values, not display-formatted strings.
- Dates compare timestamps.
- Status-like columns use an explicit product order, not alphabetical order.
- Compound clinical text does not sort by hidden subfields.

## Filter Behavior Requirements

Every filterable column or toolbar filter must define:

- `filterKey`: the field or derived value used for matching.
- `optionSource`: canonical enum, table dataset, or existing workflow state.
- `activeState`: visible active styling, usually the section Filter button count/state.
- `emptyState`: a clear no-results message when filters remove all rows.
- `clearAction`: users can clear a single filter and clear all active filters.
- `composition`: how the filter combines with search and other filters.

Default composition:

- Different filters combine with AND.
- Search combines with active filters using AND.
- Options inside one filter are single-select for first pilots unless the issue explicitly scopes multi-select.
- Existing toolbar/global filters remain primary for status, category, type, 담당자, date range, and search.
- Column-local filters are reserved for master-data/admin grids or explicitly scoped advanced data-management tables.

## State Policy

Default state for Project 13 pilots:

- Keep sort/filter state local to the table component.
- Do not persist to URL, localStorage, sessionStorage, Supabase, or server state by default.
- Reset state on route reload or table unmount.
- Preserve existing session/mock-auth behavior.
- Do not change route query parameters unless the active issue explicitly scopes URL state.

This keeps pilot changes reversible and avoids implying production-grade persistence before live data work is scoped.

## Accessibility Contract

- Sort controls are real buttons or semantically equivalent interactive elements.
- Only the active sorted header uses `aria-sort`.
- Sort controls have accessible names that include the column label and next action.
- Filter controls have accessible labels, visible active state, keyboard reachability, and clear behavior.
- Static headers must not create meaningless tab stops.
- Popover filters, when used, must support keyboard close behavior and focus recovery.
- Hover-only affordance is not enough for active sort/filter state.

## Pilot Selection

The first implementation issue should be `DEN-271`: billing invoice table.

Why billing first:

- It is a `financial-edit-grid`, so the contract can prove that sorting/filtering does not break editable row identity, amounts, or totals.
- It has a representative mix of scalar values, statuses/categories, actions, and display-only totals.
- The blast radius is smaller than chart/order workflows, which touch order draft and confirmation behavior.

Pilot constraints:

- Candidate sort columns: visible item/name text, category/status where present, quantity, unit price, amount, and date/time fields where present.
- Candidate filters: visible category/status/type controls where the billing table already exposes those concepts.
- Exclude selection, actions, edit commands, totals, payment command areas, and display-only summary rows.
- Keep billing totals and payment surfaces unchanged.

## Prototype Options

DEN-270 also includes an interactive HTML prototype options report:

- `docs/completed/design/2026-05-24-den-270-sort-filter-prototype-options.html`

The report was revised after shadcn/ui, TanStack Table, MUI X Data Grid, and AG Grid review.
The selected direction is:

- Table headers expose sort only.
- Active sort state lives in the sorted table header itself through a persistent arrow/active style.
- Inactive sort icons use one step lighter color than the header label, for example header `gray/600` with icon `gray/500`.
- Header hover/focus may show the full sort status and next action, but hover-only state is not sufficient.
- Do not require a separate sort chip or table summary row for active sort state.
- Filter controls live in the table section header/action area, not in table headers.
- The Filter button opens a dropdown/panel with multiple filter rows.
- The section header action area should expose the Filter button only for this pattern; do not add Save view or outer Clear controls by default.
- Multiple filter rows compose with AND.
- Active filter count is visible on the Filter button as `Filter N`.
- Do not require a separate active filter chip row outside the dropdown when the Filter button already shows the active count.
- The filter dropdown footer includes an explicit reset action near Close.
- Saved filter/view controls stay outside the filter dropdown unless a later issue explicitly scopes them.

The report proposes three variants of this direction:

| Option | Pattern | Recommended Use |
|---|---|---|
| A | Section-level Filter button plus header sort | Default for billing pilot. |
| B | Admin filter builder plus header sort | Customer/admin master-data grids. |
| C | Compact clinical filter builder plus header sort | Chart/order adoption. |

Recommended path: start DEN-271 with Option A. Do not place filter triggers in table headers.

## Follow-Up Adoption Order

1. `DEN-271`: implement billing invoice table pilot.
2. `DEN-272`: apply the proven behavior to chart/order table.
3. `DEN-273`: apply the proven behavior to customer management table.
4. `DEN-274`: apply the proven behavior to hospital admin order catalog table.
5. `DEN-275`: QA adopted tables across core workflows.
6. `DEN-276`: final Project 13 closeout.

## DEN-271 Billing Pilot Result

DEN-271 applied the Option A direction to the billing invoice line table:

- Table headers now provide single-column sort controls only.
- The table action area provides one Filter button, with active count shown as `Filter N`.
- Filter configuration is handled in a dropdown builder, not in the table headers.
- The builder supports multiple active conditions composed with AND.
- The footer keeps `Apply filters`, `Close`, and `초기화` together.
- Save view, saved filters, outer Clear controls, and active chip rows are intentionally excluded.
- Billing quantity editing, totals, confirmation/payment dialogs, mock auth, and session behavior remain in scope for preservation.

## DEN-272 Chart/Order Adoption Result

DEN-272 applied the proven pattern to the chart/order table with clinical workflow guardrails:

- Table headers provide single-column sort controls only.
- Sorting is limited to stable visible order fields: group, type, status, order name, billing name, quantity, unit price, amount, and veterinarian.
- Existing order type tabs remain the primary type filter.
- The section action area adds a Filter button with active count shown as `Filter N`.
- The filter builder is intentionally compact and supports status and veterinarian conditions.
- Multiple filter rows compose with AND after the existing type tab filter.
- Save view, saved filters, outer Clear controls, active chip rows, multi-sort, URL persistence, Supabase, and server-side behavior remain excluded.
- Order draft editing, quantity validation, selection, order update, order billing, order confirmation, chart workflow, mock auth, and session behavior remain in scope for preservation.

## Verification Expectations

For implementation issues, complete the checks scoped by the issue:

- `npm run lint`
- `npx tsc --noEmit`
- focused Playwright coverage for the adopted table
- browser QA with mock auth storage state so evidence captures the real workspace, not login
- HTML closeout report under `docs/completed/design/`
- `npm run docs:check`

For DEN-270 itself, `npm run docs:check` is sufficient because no app code changes are made.
