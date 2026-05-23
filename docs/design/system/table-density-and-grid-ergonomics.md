---
status: "active"
updated: "2026-05-23"
linear_issue: "DEN-225"
linear_project: "12 CLAiR EMR Table Density & Data Grid Ergonomics"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
---

# Table Density And Grid Ergonomics

This document defines the CLAiR EMR table UX gate for density, scroll containment, and header interactions.

## External Research Summary

Primary references:

- MUI X Data Grid row height: `https://mui.com/x/react-data-grid/row-height/`
- MUI X Data Grid layout: `https://mui.com/x/react-data-grid/layout/`
- MUI X Data Grid sorting: `https://mui.com/x/react-data-grid/sorting/`
- MUI X Data Grid filtering: `https://mui.com/x/react-data-grid/filtering/`
- AG Grid compactness: `https://www.ag-grid.com/javascript-data-grid/theming-compactness/`
- AG Grid column menu: `https://www.ag-grid.com/javascript-data-grid/column-menu/`
- Ant Design Table: `https://ant.design/components/table/?locale=en`
- TanStack Table overview/introduction: `https://tanstack.com/table/latest/docs/overview`

Research conclusions:

- Row height must be a table density decision, not a one-off row class. MUI exposes row height and density as table-level concerns.
- Dense grids need real parent dimensions. MUI warns that a grid needs a parent with intrinsic dimensions or it will not display correctly.
- Component grids separate layout, sorting, filtering, and menu affordances. CLAiR should do the same instead of implying every header is interactive.
- AG Grid treats compactness as a theme parameter and separates column menu behavior from grid data rendering.
- Ant Design Table supports table `size`, horizontal/vertical scroll, fixed header, fixed columns, and sorter/filter patterns, which maps well to a contract-first table wrapper.
- TanStack Table is headless, so CLAiR must own markup, density styling, scroll wrapper, and accessibility semantics when using it.

## Density Model

Use three density modes:

| Mode | Korean UI copy | Intended use | Row target | Header target |
|---|---|---|---:|---:|
| `compact` | 좁게 | clinical/order/admin tables where visible row count matters | 36px | 36px |
| `standard` | 기본 | default operational tables | 44px | 40px |
| `comfortable` | 넓게 | review-heavy rows, multi-line summaries, low row count | 52px | 44px |

Density controls:

- row height
- header height
- cell vertical padding
- dense text role
- checkbox/action hit area
- inline badge size

Do not apply density to:

- row detail panels that depend on natural content height
- rich text/editor content
- clinical attachment/media cards
- mobile card alternatives

### Shared Token/API Contract

Runtime source:

- `src/styles/tokens/emr-foundation.css` owns table density tokens:
  - `--emr-table-row-height-compact|standard|comfortable`
  - `--emr-table-header-height-compact|standard|comfortable`
  - `--emr-table-cell-padding-x-compact|standard|comfortable`
  - `--emr-table-cell-padding-y-compact|standard|comfortable`
- `src/components/emr/table-density.ts` owns density/layout/header role types and view option copy.
- `src/components/emr/table-density-selector.tsx` owns the visible icon-only density segmented control.
- `src/components/ui/table.tsx` accepts `density`, `layout`, `minWidth`, and `containerClassName`.

Density API:

| Prop | Values | Default | Notes |
|---|---|---|---|
| `density` | `compact`, `standard`, `comfortable` | `standard` | Maps to shared row/header height and cell padding tokens. |
| `layout` | `fill`, `scroll` | `fill` | `scroll` gives the outer wrapper horizontal overflow and the table an unbroken width. |
| `minWidth` | number or CSS length | none | Required for `scroll` tables with meaningful column minimums. |

View option copy:

- `compact`: `좁게`
- `standard`: `기본`
- `comfortable`: `넓게`

Density selector UX:

- The visible selector uses compact icons for `compact`, `standard`, and `comfortable` to avoid adding more text noise to dense EMR table toolbars.
- Each icon button must keep an accessible name and hover title mapped to the Korean option copy: `좁게`, `기본`, `넓게`.
- The selector may sit near the relevant table header or table body when header action space is already constrained.

Persistence:

- Table density uses local component state during Project 12 and is visible near the relevant table header or table body.
- Live user preference persistence is excluded.
- If localStorage is added later, scope it per workspace/module/table id and version the key.

## Fill Vs Scroll Layout

Use `fill` when the table can fit the available workspace without compromising column meaning.

Fill contract:

- wrapper width is `100%`
- table width is `100%`
- no required horizontal scrollbar
- columns may use `minmax(0, 1fr)` or percentage tracks only when labels remain readable

Use `scroll` when columns have meaningful minimum widths.

Scroll contract:

- outer wrapper owns `overflow-x-auto`
- inner table surface owns a single unbroken `min-width`
- header, body rows, alert/change rows, empty state, row background, and borders must share the same table width
- right blank area inside the scroll surface is a bug unless it is intentional frozen-column space
- sticky footer/action bars must align with the visible wrapper, not with a truncated inner row

Implementation contract:

```tsx
<Table density="compact" layout="scroll" minWidth={1160}>
  ...
</Table>
```

The generated structure must stay:

```html
<div data-slot="table-container" data-emr-layout="scroll">
  <table data-slot="table" data-emr-layout="scroll" data-emr-density="compact">
    ...
  </table>
</div>
```

Acceptance rules:

- `data-slot="table-container"` is the only horizontal overflow owner.
- `minWidth` is set on the table element, not separately on header/body rows.
- Do not wrap `TableHeader`, `TableBody`, row warning banners, or empty states in separate overflow containers.
- Do not add sticky columns in Project 12 unless a later issue explicitly scopes the keyboard/focus behavior.
- Page-level document width must remain equal to the viewport width at 1440, 1280, and 1024 screenshots.

## Header Interaction Rules

Define each column with a header role:

| Role | Use for | Allowed affordance |
|---|---|---|
| `static` | checkbox, action, icon-only, memo, summary, alert/change rows | no sort/filter/menu |
| `sortable` | stable scalar values: name, date/time, amount, quantity, status order | sort indicator and keyboard sort |
| `filterable` | status, 담당자, category/type, department, source | filter trigger or menu item |
| `menu` | optional column actions such as hide/pin/copy in admin-heavy grids | explicit menu button only |
| `compound` | cells combining multiple values | static by default; split if sort/filter is needed |

Header interaction gates:

- Do not show hover affordance unless the column role supports the action.
- Sort and filter must be reachable by keyboard and have accessible names.
- Do not place menu buttons on every clinical table column by default.
- Action, checkbox, attachment, memo, and warning columns stay static.
- Header role must be documented close to column definitions when table implementation begins.

### Header Component/API Contract

Runtime source:

- `src/components/emr/table-density.ts` exports `EmrTableHeaderRole` and `emrTableHeaderRoleDefinitions`.

Role assignment:

- `static`: checkbox, row action, attachment, memo, warning/change row, icon-only, summary, compound clinical text that cannot be sorted reliably.
- `sortable`: stable scalar values such as date/time, amount, quantity, name, explicit status order, room number.
- `filterable`: status, 담당자, category/type, department, source, modality.
- `menu`: admin-heavy grids where hide/copy/pin is explicitly scoped.
- `compound`: multiple values in one visible cell; keep static until the field is split.

Interaction rules:

- Header label click may sort only when role is `sortable`.
- Filter/menu buttons must be real buttons with accessible names.
- Active sort/filter state must remain visible without hover.
- Static headers must not show cursor, hover highlight, chevron, or menu affordance.
- Compound headers must not pretend to sort by an invisible subfield.
- Keyboard order is header label or trigger, then row cells; avoid inserting hidden tab stops in static headers.

## Implementation Gate

Before Project 12 implementation issues:

1. Inventory the current table surface and classify it as clinical dense, financial, master data, admin, history, or small summary.
2. Pick density default and whether the table is `fill` or `scroll`.
3. Define minimum width and column role table.
4. Add responsive evidence at 1440, 1280, and 1024 when the table has more than six columns.
5. Keep DB, RLS, payment, provider integration, and server policy out of table UX issues.
