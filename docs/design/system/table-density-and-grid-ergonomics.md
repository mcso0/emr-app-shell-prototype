---
status: "active"
updated: "2026-05-24"
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
- Do not render a visible `밀도` text label next to the selector. Use icon-only controls with tooltip and accessible labels.
- Use a single-value toggle group or equivalent segmented control, not content tabs, because density changes presentation without changing the data set.
- Prefer a persistent per-table selector only on high-frequency dense work surfaces. When a screen repeats multiple same-role tables, place one shared selector in the screen toolbar/filter row instead of repeating it in every section header.
- Density icons should communicate row compactness by line spacing. Use lucide-style row/list icons where possible and make the selected state visually stronger than hover.

### DEN-245 Benchmark-Based Placement Contract

Service and grid benchmark summary:

- MUI Data Grid exposes `standard`, `compact`, and `comfortable` density and supports a toolbar density selector.
- Airtable exposes row height from the view bar, uses `Short`, `Medium`, `Tall`, and `Extra Tall`, and treats row height as a view-level setting.
- AG Grid and Ant Design treat compactness/size as table-level configuration rather than a repeated label beside every table.
- shadcn/ui examples place table view options in a toolbar/dropdown pattern and use Radix-style accessible controls.

CLAiR placement rules:

- Keep density close to the table action cluster, but remove the visible `밀도` label everywhere.
- Place density before the primary table action when the action belongs to the same table (`Order 출력`, `판정적용`, `PACS`).
- Place density after filter controls when the filter/action row is the table toolbar (`조제/처치`).
- Keep existing density placement for `수납`, `고객관리`, and `병원관리` if the selector already lives in the table toolbar; only remove the label.
- For `입원`, remove repeated per-section density controls and replace the duplicate `all` dropdown in the top filter row with one shared density selector.
- Tooltips and `aria-label` values must be:
  - `좁게 보기`
  - `기본 보기`
  - `넓게 보기`

Implementation report:

- `docs/completed/design/2026-05-23-den-243-table-density-width-placement-report.html`
- `docs/completed/design/2026-05-23-den-245-table-density-control-benchmark-report.html`

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

### DEN-250 Header Ergonomics Proposal

Research report:

- `docs/completed/design/2026-05-24-den-250-table-header-ergonomics-research-report.html`

Reference conclusions:

- MUI X, AG Grid, TanStack Table, and shadcn/TanStack examples separate sorting, filtering, menu, visibility, and resizing state. CLAiR must not encode all of these as one generic header interaction.
- Accessor/data columns may sort, filter, and resize when the column definition opts in. Display columns such as selection, action, warning, expander, and icon-only columns stay static.
- If resizing is enabled for a table, every eligible data header in that table should expose the same resize hit zone. Do not make only one or two arbitrary headers draggable.
- Header menus should be reserved for admin/master-data grids or explicit view configuration. Clinical input/review tables should default to direct sort/filter controls only when they support the workflow.
- Toolbar/global filters are preferred for high-level status, category, date, 담당자, and search controls. Column-local filters are for advanced data-management grids where users need field-specific narrowing.

CLAiR table classes:

| Class | Surfaces | Header behavior |
|---|---|---|
| `clinical-review` | 임상병리 검사 결과, 영상검사 Order 상세 | minimal sorting; no column menu by default; resize only if content routinely overflows |
| `operational-worklist` | 조제/처치, 입원, 진료/차트 오더 작업 | sortable scalar columns; toolbar filters; resize for eligible data columns |
| `master-data-grid` | 고객관리, 병원관리 Order 관리 | sort/filter/menu/column visibility can be enabled through shared config |
| `financial-edit-grid` | 수납 청구 항목 | limited sort/filter; protect amount/quantity editing and totals alignment |

Recommended shared API additions for the next implementation issue:

```ts
type EmrTableKind =
  | "clinical-review"
  | "operational-worklist"
  | "master-data-grid"
  | "financial-edit-grid";

type EmrHeaderInteraction =
  | "static"
  | "sortable"
  | "filterable"
  | "sortable-filterable"
  | "menu"
  | "compound";

type EmrColumnResize = "none" | "data-column";
```

Implementation guidance:

- Add a shared header-cell component before spreading behavior across feature tables.
- Use `aria-sort` only on sorted columns.
- Use visible active states for sort/filter; hover-only state is not enough.
- Resize handles use `cursor: col-resize` and an edge hit zone, not a permanent icon inside every header label.
- Use lucide `ArrowUpDown`, `ArrowUp`, `ArrowDown`, `ListFilter` or `Funnel`, `SlidersHorizontal`, `Settings2`, `MoreHorizontal`, and `GripVertical` only where the action exists.

## Cell Text Wrapping Rules

Default rule:

- Table cells use one-line text by default.
- One-line cells truncate with ellipsis when text exceeds the column width.
- Two-line cells are allowed only for columns whose meaning is lost if clipped too aggressively.
- Dynamic row height based on arbitrary content is not a default CLAiR table behavior.

### DEN-251 One-Line Default Proposal

Research report:

- `docs/completed/design/2026-05-24-den-251-table-cell-text-wrapping-research-report.html`

Reference conclusions:

- MUI X recommends fixed row height for predictable density and treats dynamic row height as a special mode that can ignore density and affect virtualization/scroll behavior.
- AG Grid defaults to single-line clipped text when wrapping is not enabled; auto row height should be limited to columns that truly require it because it affects rendering and scroll stability.
- Ant Design exposes `ellipsis` as an explicit column property and changes table layout behavior when it is enabled.
- MUI's long-text recipe keeps row height stable and shows full content through a popup instead of expanding every row.
- TanStack Table is headless, so CLAiR must own the visual text policy as a shared cell primitive.

Text display modes:

| Mode | Use for | Behavior |
|---|---|---|
| `one-line` | IDs, names, status labels, 담당자, dates, amounts, short order names, phone numbers | single line, ellipsis on overflow |
| `two-line-if-long` | order names, 진단명, 입실 메모, 복약지도, clinical caution summaries | clamp to 2 lines only when content exceeds one line |
| `always-multiline` | row detail panels, comments, 판독의견 editors, 종합소견 text areas | not used inside dense table body cells by default |
| `badge-wrap` | multiple status/caution badges | badges may wrap to 2 lines in standard/comfortable density; compact prefers horizontal scroll or overflow containment |
| `full-on-demand` | clinically important long text that may be truncated | one- or two-line preview plus tooltip, popover, side detail, or drawer full text |

Density interaction:

- `compact`: default one-line. Allow `two-line-if-long` only for high-value clinical summary columns and keep row target bounded.
- `standard`: allow one or two `two-line-if-long` columns per table when the workflow needs preview context.
- `comfortable`: allow review-heavy rows to use two-line previews, but still avoid uncontrolled auto height in grid bodies.

Implementation guidance:

- Add a shared cell text primitive before broad adoption, for example `EmrTableCellText`.
- Suggested props: `mode`, `title`, `fullText`, `tooltip`, `className`, `as`.
- Use CSS line clamp for two-line preview rather than content-measured row height.
- Tooltips should supplement truncated data, not become the only place to read required information.
- If a table needs long-form reading or editing, move the full content into a side panel, drawer, row detail, or editor area outside the dense grid.

### DEN-264 Pilot Implementation

- `src/components/emr/table-primitives.tsx` adds the first shared `EmrTableHeaderCell` and `EmrTableCellText` primitives.
- `src/components/emr/table-density.ts` now exports the DEN-250/251 API vocabulary for table kind, header interaction, resize policy, and cell text modes.
- `src/components/emr/emr-data-table.tsx` pilots the API in the dispensing/treatment worklist table only.
- The pilot keeps scalar cells one-line by default and allows limited two-line previews for order names and warning/change messages.
- Checkbox, assignment control, and workflow action columns are excluded from resize affordances. Wider table adoption remains out of scope for DEN-264.

### DEN-267 Customer Table Adoption

- `src/features/customer/module.tsx` applies `EmrTableHeaderCell` and `EmrTableCellText` through the shared customer management data table renderer.
- Customer table columns now record local metadata for header interaction, resize policy, and text mode.
- Selection and row action columns stay static and are excluded from resize affordance policy.
- Scalar/contact/date values stay `one-line`.
- Person names, connected guardian/patient summaries, and CS/work summary-style text may use `two-line-if-long` when clipping would lose meaning.
- Badge cells remain feature-local structured content rather than being forced through the text primitive.
- The adoption does not add real sort, filter, column menu, resize behavior, live Supabase, DB, RLS, server enforcement, role policy, or external messaging changes.

## Implementation Gate

Before Project 12 implementation issues:

1. Inventory the current table surface and classify it as clinical dense, financial, master data, admin, history, or small summary.
2. Pick density default and whether the table is `fill` or `scroll`.
3. Define minimum width and column role table.
4. Add responsive evidence at 1440, 1280, and 1024 when the table has more than six columns.
5. Keep DB, RLS, payment, provider integration, and server policy out of table UX issues.
