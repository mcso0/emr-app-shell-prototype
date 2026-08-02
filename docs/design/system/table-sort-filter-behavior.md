---
status: "active"
updated: "2026-08-02"
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

## DEN-273 Customer Table Adoption Result

DEN-273 applied the proven pattern to the customer management patient and guardian tables with customer-workflow guardrails:

- Table headers provide single-column sort controls only.
- Sorting is limited to stable visible customer fields: patient code, patient name, birth date/age, patient registration date, guardian name, and guardian registration date.
- The customer table section action area adds a Filter button with active count shown as `Filter N`.
- The filter builder supports patient breed, sex, status badge, message consent, and guardian consent summary conditions.
- Multiple filter rows compose with AND after the existing customer search query.
- Header filter triggers, active chip rows, saved filters/views, multi-sort, URL persistence, Supabase, and server-side behavior remain excluded.
- Detail drawers, row selection, row actions, column visibility, density, mock auth, and session behavior remain in scope for preservation.

## DEN-274 Hospital Admin Order Catalog Adoption Result

DEN-274 applied the proven pattern to the hospital admin order catalog table with admin-workflow guardrails:

- Table headers provide single-column sort controls only.
- Sorting is limited to stable visible order catalog fields: standard order name, in-hospital order name, billing name, and sale price.
- Existing category navigation, search, status, billing, and work-type controls remain primary workflow filters.
- The order catalog section action area adds a Filter button with active count shown as `Filter N`.
- The filter builder supports status, target species, service item type, billing linkage, and sale price threshold conditions.
- Multiple filter rows compose with AND after the existing category/search/filter controls.
- Header filter triggers, active chip rows, saved filters/views, multi-sort, URL persistence, Supabase, and server-side behavior remain excluded.
- Row selection, row actions, detail drawer, mock auth, and session behavior remain in scope for preservation.

## DEN-275 Adopted Table QA Result

DEN-275 ran focused QA across the Project 13 adopted table set:

- Covered billing invoice lines, chart/order rows, customer management patient rows, and hospital admin order catalog rows.
- Added cross-table QA coverage for accessible sort/filter labels, visible active sort state, `Filter N` active state, keyboard Escape close behavior, empty states, reset behavior, and narrow viewport filter reachability.
- Captured mock-auth evidence screenshots for billing, chart/order, customer mobile, and hospital admin order catalog screens.
- Fixed a narrow viewport shell layering issue by raising the shared popover positioner layer so filter popovers are not visually covered by shell chrome.
- Existing focused table specs plus the DEN-275 QA spec passed together.
- Excluded tables remain unchanged: no new table adoption, saved views, saved filters, active chip rows, multi-sort, URL/localStorage persistence, Supabase, DB/RLS, or server-side behavior.

## DEN-276 Final Closeout Result

DEN-276 closes Project 13 for representative review:

- The approved contract is stable: table headers expose single-column sort only, and filters live in the section header/action area.
- Active filter state is represented by the section Filter button count as `Filter N`.
- Filter builder rows compose with AND and keep `초기화`, `Apply filters`, and `Close` in the footer.
- Display-only, checkbox, action, icon-only, summary, total, and command columns remain static.
- The adopted table set covers billing invoice lines, chart/order rows, customer management patient/guardian workflows, and the hospital admin order catalog.
- Cross-table QA verified the representative implementation set with mock-auth workspace screens and evidence images.
- Project 13 is ready for Human Review and can be closed after representative acceptance.

Remaining exclusions stay explicit:

- No broad all-table rollout.
- No saved views, saved filters, active chip rows, multi-sort, URL/localStorage/session persistence, Supabase persistence, DB/RLS, migrations, server-side sorting/filtering, live validation, pricing model, role policy, production data, or external integration changes.
- Any next expansion should start as a new scoped Linear issue or project.

## DEN-293 Advanced Filter Builder Foundation

DEN-293 starts the next Project 13 extension for the approved advanced filter builder direction:

- The UI should not import an external query-builder surface wholesale.
- CLAiR should use its own EMR component composition and table primitives, while keeping the internal data model query-builder-like.
- The reusable model starts with one top-level AND group and completed rules only; broader OR and nested group behavior remains explicit follow-up scope.
- First open must show one incomplete draft condition row, not the multi-row design reference state.
- A rule becomes active only when field, operator, and value are complete.
- Incomplete draft rules are ignored by filtering and by the `Filter N` count.
- The builder footer uses `+ Add filter` and `Clear all`; Apply/Close footer buttons are excluded from this advanced auto-apply pattern.
- Close behavior is handled by parent popover outside-click/Escape plus a top-right close icon when provided.
- Table consumers must expose only table-specific filter fields; checkbox, action, icon-only, and display-only columns stay out of the field list.

The foundation code lives in:

- `src/components/emr/table-filter-builder-model.ts`
- `src/components/emr/table-filter-builder.tsx`

## DEN-294 Advanced Filter Builder Adoption

DEN-294 applies the DEN-293 shared builder to two real Project 13 table surfaces:

- Billing invoice lines now use the shared builder for `업무` and `청구금액`.
- Chart/order rows now use the shared builder for `상태` and `수의사`.
- Both screens keep the section Filter button and `Filter N` active count.
- Both screens now auto-apply completed builder rules; there is no `Apply filters` or footer `Close` button in the shared builder.
- First open shows one incomplete draft rule row.
- Incomplete draft rules are ignored by filtering and active count.
- Customer management and hospital admin order catalog still use their existing feature-local builders after DEN-294 and should be migrated only in a separate scoped follow-up.
- The shared select popup layer is above popover content so dropdowns inside the builder remain clickable.

## Advanced Filter Builder Interaction Refinements

The shared advanced builder keeps the approved visual surface while making its empty and multi-condition states explicit:

- On a pristine open (one group, one empty rule, zero active rules), the first field selector opens automatically. Existing drafts do not auto-open a selector.
- The only empty rule in the pristine state keeps its delete action and `초기화` action visible but disabled. Both become enabled once the model differs from its pristine state.
- A single rule or group does not reserve an invisible AND/OR gutter. When a second rule or group creates a real AND/OR control, the first item receives the same gutter so all option surfaces share one start line.
- The information mark is a non-button focusable icon with the existing explanation exposed through hover and keyboard focus tooltip behavior.
- An active section Filter trigger uses the `--clair-color-atomic-sky-200` border token. Rule deletion uses `EmrIconButton` with the CDS trash icon, while footer `필터 추가` and `초기화` remain shared `Button` controls with equal horizontal padding.

## DEN-295 Advanced Filter Builder Rollout QA

DEN-295 verifies and documents the advanced filter builder rollout:

- Shared builder foundation behavior passed focused model QA.
- Billing invoice line table passed focused sort/filter QA with the shared builder.
- Chart/order table passed focused sort/filter QA with the shared builder.
- Cross-table QA passed for billing, chart/order, customer management, and hospital admin order catalog.
- Browser evidence was captured on real mock-auth workspace screens for billing and chart/order.
- The rollout is intentionally partial: billing and chart/order use the shared builder; customer and hospital admin still use their previous feature-local builders.
- The known full-suite caveats are unrelated existing lint/test failures outside this rollout scope.

## DEN-296 Customer Advanced Filter Builder Migration

DEN-296 migrates the customer management table from the DEN-273 feature-local filter builder to the DEN-293 reusable advanced builder:

- Customer patient and guardian tables now use `EmrTableFilterBuilder` and the shared model helpers.
- Table headers remain single-column sort only; filter controls stay in the customer table section action area.
- The Filter button keeps the active count as `Filter N`, counting only completed field/operator/value rules.
- First open shows one incomplete draft rule row.
- Incomplete draft rows are ignored by customer row filtering and by the active count.
- Patient filter fields remain breed, sex, status badge, and message consent.
- Guardian filter fields remain consent summary.
- Checkbox, action, phone, relationship summary, work summary, and other display-only columns remain outside the filter field configuration.
- Existing search, mock/session behavior, row selection, row actions, column visibility, density, and detail drawer routing remain preserved.
- Saved views/filters, active chip rows, persisted filter presets, server-side filtering, Supabase, DB/RLS, migrations, and live validation remain excluded.

After DEN-296, the shared advanced builder is adopted by billing invoice lines, chart/order rows, and customer management tables. Hospital admin order catalog remains on its feature-local builder until DEN-297.

## DEN-297 Hospital Admin Advanced Filter Builder Migration

DEN-297 migrates the hospital admin order catalog table from the DEN-274 feature-local filter builder to the DEN-293 reusable advanced builder:

- Hospital admin order catalog now uses `EmrTableFilterBuilder` and the shared model helpers.
- Table headers remain single-column sort only; filter controls stay in the order catalog section action area.
- The Filter button keeps the active count as `Filter N`, counting only completed field/operator/value rules.
- First open shows one incomplete draft rule row.
- Incomplete draft rows are ignored by order row filtering and by the active count.
- Order catalog filter fields remain status, target species, service item type, billing linkage, and sale price threshold.
- Checkbox, action, and display-only columns remain outside the filter field configuration.
- Existing category navigation, search, status/billing/work-type filters, mock/session behavior, row selection, row actions, and drawer workflows remain preserved.
- Saved views/filters, active chip rows, persisted filter presets, server-side filtering, Supabase, DB/RLS, migrations, and live validation remain excluded.

After DEN-297, the shared advanced builder is adopted by billing invoice lines, chart/order rows, customer management tables, and the hospital admin order catalog.

## Verification Expectations

For implementation issues, complete the checks scoped by the issue:

- `npm run lint`
- `npx tsc --noEmit`
- focused Playwright coverage for the adopted table
- browser QA with mock auth storage state so evidence captures the real workspace, not login
- HTML closeout report under `docs/completed/design/`
- `npm run docs:check`

For DEN-270 itself, `npm run docs:check` is sufficient because no app code changes are made.
