---
status: "active"
updated: "2026-06-06"
linear_issue: "DEN-435"
linear_project: "공통 UX/UI 기준 정리 및 화면 적용"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
---

# Tab And Table Density UX Contract

This document defines the shared UX contract for CLAiR EMR tabs, tab-like controls, and table density controls.

DEN-435 is a design-system contract issue. It does not implement app code, replace table components, introduce a data-grid library, or change DB/API sort and filter contracts.

## Contract Summary

- Use real tabs only when one selected value changes the visible panel within the same context.
- Use workspace tabs for shell-level open work areas and navigation history, not for filters.
- Use segmented controls or filter buttons for data narrowing; do not present filters as tabs unless the choices are a small, stable mode set.
- Keep table density as a presentation preference. It must not change row identity, data scope, sort/filter results, permissions, or persistence boundaries.
- Keep the existing three table density options: `compact`, `standard`, and `comfortable`.
- Do not globally replace the current density selector with a dropdown. Use a dropdown only when toolbar space, mobile width, or combined view options make a segmented selector too noisy.

## Tab Type Decision Table

| Type | Use For | UI Owner | State Scope | Do Not Use For |
| --- | --- | --- | --- | --- |
| Workspace tab | Open work areas, route-backed module workspaces, tab close/restore/history | `src/shell/*` | shell route/history state | status filters, table density, section-only content |
| Section tab | Switching peer panels inside one screen section, such as detail subviews or record sections | feature-local first; shared only after repetition | local component or route state when deep-linking is scoped | primary route navigation, long option lists, transient filters |
| Subsection tab | A second-level peer switch inside an already selected section | feature-local | local state | nested workflow trees, repeated table filters |
| Segmented mode | Small stable mode choice that changes display mode or filter mode | `SegmentedControl` or feature-local wrapper | local state unless explicitly scoped | opening/closing workspace pages, long category taxonomies |
| Filter control | Narrowing rows by status, category, 담당자, date, or search | table toolbar/filter builder | table-local state by default | content panels that need tab semantics |
| Density control | Presentation-only row/header/cell density | table toolbar or view options dropdown | component-local by default | data filtering, sorting, or workflow status |

## Tab Usage Rules

### Workspace Tabs

Workspace tabs are shell navigation. They may show active route, close affordance, per-tab navigation history, and module/workspace identity.

Rules:

- Keep workspace tab behavior in `src/shell/*`.
- Preserve close, active switching, back/forward history, and route state when changing visual treatment.
- Keep active state visible without hover.
- Use icons only when they clarify the module or action; icon-only controls need accessible labels.
- Do not overload workspace tabs with table filters, table density, or section settings.

### Section Tabs

Section tabs switch peer content panels within one screen context.

Rules:

- Use section tabs when the user is choosing between peer panels, not when narrowing one table.
- Put section tabs close to the title or content they control.
- Keep labels short and stable. If labels need counters, use compact counts that do not change tab width abruptly.
- Avoid more than one nested tab row in a single viewport. If a third level appears, use side navigation, a drawer, or a select/menu instead.
- Prefer feature-local ownership until the same tab structure repeats across at least two screen families.

### Segmented And Filter-Like Controls

Use segmented controls when the selected option is a small display or workflow mode. Use filter controls when the selected option narrows data.

Rules:

- A status/category filter should usually live in the table toolbar or filter builder, not as content tabs.
- A mode switch can use a segmented control when there are two to five stable options.
- If the option list can grow, use a filter dropdown, side navigation, command picker, or table filter builder.
- Do not make a tab row look like navigation if it only filters rows.

## Table Density Contract

Use the existing density modes from `table-density-and-grid-ergonomics.md`:

| Mode | Korean Copy | Intended Use | Row Target | Header Target |
| --- | --- | --- | ---: | ---: |
| `compact` | 좁게 | Clinical/order/admin tables where visible row count matters | 36px | 36px |
| `standard` | 기본 | Default operational tables | 44px | 40px |
| `comfortable` | 넓게 | Review-heavy rows, multi-line summaries, low row count | 52px | 44px |

Density changes:

- affect row height, header height, cell padding, dense text role, checkbox/action hit area, and inline badge size
- do not affect row identity, source data, selected row identity, workflow status, sort/filter criteria, billing totals, permission checks, or DB/API state
- remain local component state unless a later issue explicitly scopes user preference persistence

## Density Control Decision

### Default: Icon Segmented Selector

Use the existing icon-only segmented density selector when:

- the table is a high-frequency operational surface
- users benefit from one-click density switching
- the toolbar has enough space
- one selector controls one table or one repeated same-role table group

Accessibility:

- Each option has an accessible name and hover title:
  - `좁게 보기`
  - `기본 보기`
  - `넓게 보기`
- Selected state must be stronger than hover state.
- Tooltips supplement the accessible name; they are not the only label.

### Conditional: Density Dropdown

Use a dropdown only when it reduces toolbar noise without hiding a frequent action.

Allowed cases:

- narrow/mobile toolbar where three density buttons would crowd primary actions
- admin/master-data table toolbar that already groups view options such as columns, density, and display settings
- a screen-level table group where one density choice controls multiple same-role tables
- low-frequency density changes where one extra click is acceptable

Dropdown contract:

- Trigger copy may be `보기` or `표시 옵션`; avoid a standalone visible `밀도` label in dense toolbars.
- Trigger icon should be `SlidersHorizontal`, `Rows3`, `List`, or an equivalent lucide icon if implemented.
- Selected option remains visible inside the menu through checkmark or active item style.
- The trigger must expose the current density through accessible name or description, for example `표시 옵션, 현재 기본 보기`.
- The dropdown must not include saved views, URL state, localStorage persistence, or server-backed preferences unless separately scoped.

Do not use a dropdown when density is the only table toolbar control and the table is switched frequently; the segmented selector is faster and clearer.

## Responsive And Overflow Rules

- Keep tabs and density controls inside the section or toolbar they affect.
- At narrow widths, workspace tabs may horizontally scroll or collapse according to shell rules, but section tabs should avoid hiding critical workflow actions.
- When a table uses `layout="scroll"`, the table container remains the only horizontal overflow owner.
- Sticky headers and table empty states must align to the same scroll width as body rows.
- Density controls must not sit inside the horizontal table scroll area unless they are part of a sticky table toolbar explicitly scoped by the screen issue.

## Ownership Rules

- Workspace tabs stay in `src/shell/*`.
- Generic tab primitives should use existing shadcn/Base UI primitives first.
- Feature-specific section tabs stay local until two or more screen families prove the same role.
- Table density primitives stay under the existing EMR table contract. Do not create a second density API.
- A new shared tab wrapper is allowed only after a later implementation issue proves repeated behavior and accessibility needs.

## Follow-Up Acceptance Criteria

Use these in DEN-436 through DEN-439 or later screen issues when relevant:

- Identify each tab-like control as workspace tab, section tab, segmented mode, filter, or density control before changing visuals.
- Do not convert filters into tabs only for visual compactness.
- Keep active tab, active filter, and selected row states visually distinct.
- Preserve route, drawer, tab, selected row, sort/filter, and session-only mock behavior.
- Keep density presentation-only and local unless the issue explicitly scopes preference persistence.
- Use dropdown density only when toolbar constraints justify the extra click.
- Treat high-frequency queue ranges such as `전체`, `예약`, and `외래` as quick scope shortcuts, not as detailed filters. Detailed status, assignee, urgency, elapsed-time, and note conditions belong in the queue filter control.
- TASK card overflow controls open a contextual dropdown first. The dropdown item list is derived from the task/order type, status, and current screen context; each item may then navigate, assign, open a drawer, open a dialog, or show unavailable feedback.
- Verify dense responsive behavior with `npm run docs:check` for docs-only changes and focused UI checks for implementation changes.

## Out Of Scope

- App code changes for DEN-435.
- Immediate replacement of all table components.
- New data-grid library adoption.
- Server-side sort/filter, DB/API query contracts, live Supabase, migrations, RLS, server enforcement, production deploy, or real data access.
