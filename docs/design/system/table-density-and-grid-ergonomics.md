---
status: "active"
updated: "2026-10-11"
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
- AG Grid column resizing and custom headers:
  `https://www.ag-grid.com/javascript-data-grid/column-sizing/` and
  `https://www.ag-grid.com/javascript-data-grid/column-headers-components/`
- MUI X column resizing and focus styling:
  `https://mui.com/x/react-data-grid/column-dimensions/` and
  `https://mui.com/x/react-data-grid/style-recipes/`
- TanStack Table column resizing:
  `https://tanstack.com/table/v8/docs/guide/column-sizing`
- W3C WCAG focus visibility:
  `https://www.w3.org/WAI/WCAG22/Understanding/focus-visible`
- Ant Design Table: `https://ant.design/components/table/?locale=en`
- TanStack Table overview/introduction: `https://tanstack.com/table/latest/docs/overview`

Research conclusions:

- Row height must be a table density decision, not a one-off row class. MUI exposes row height and density as table-level concerns.
- Dense grids need real parent dimensions. MUI warns that a grid needs a parent with intrinsic dimensions or it will not display correctly.
- Component grids separate layout, sorting, filtering, and menu affordances. CLAiR should do the same instead of implying every header is interactive.
- AG Grid treats compactness as a theme parameter and separates column menu behavior from grid data rendering.
- Ant Design Table supports table `size`, horizontal/vertical scroll, fixed header, fixed columns, and sorter/filter patterns, which maps well to a contract-first table wrapper.
- TanStack Table is headless, so CLAiR must own markup, density styling, scroll wrapper, and accessibility semantics when using it.
- AG Grid documents an invisible pointer-resize widget and keyboard resizing from a focused column header. MUI X separates separator resizing from header focus styling and warns against removing visible keyboard focus. TanStack leaves the indicator presentation to the application and describes a small resize indicator as a common option. For CLAiR's persistent pinned divider, keep pointer feedback on the divider itself and move keyboard focus feedback into the header content.

## Density Model

Use three density modes:

| Mode          | Korean UI copy | Intended use                                                | Row target | Header target |
| ------------- | -------------- | ----------------------------------------------------------- | ---------: | ------------: |
| `compact`     | 좁은 간격      | clinical/order/admin tables where visible row count matters |       36px |          36px |
| `standard`    | 기본 간격      | default operational tables                                  |       44px |          40px |
| `comfortable` | 넓은 간격      | review-heavy rows, multi-line summaries, low row count      |       52px |          44px |

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
- `src/components/emr/table-density-selector.tsx` owns the visible selected-value density dropdown.
- `src/components/ui/table.tsx` accepts `density`, `layout`, `minWidth`, `pinning`, and `containerClassName`.
- `src/components/emr/table-pinning.ts` converts TanStack column state into typed shared pinned-cell props.

Density API:

| Prop       | Values                               | Default    | Notes                                                                                 |
| ---------- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------------- |
| `density`  | `compact`, `standard`, `comfortable` | `standard` | Maps to shared row/header height and cell padding tokens.                             |
| `layout`   | `fill`, `scroll`                     | `fill`     | `scroll` gives the outer wrapper horizontal overflow and the table an unbroken width. |
| `minWidth` | number or CSS length                 | none       | Required for `scroll` tables with meaningful column minimums.                         |
| `pinning`  | `none`, `columns`                    | `none`     | Enables the shared fixed-cell layering and opaque semantic surface contract.          |

View option copy:

- `compact`: `좁은 간격`
- `standard`: `기본 간격`
- `comfortable`: `넓은 간격`

Density selector UX:

- The visible selector is one compact 32px outline button with Korean interval copy and a downward chevron; it has no leading density icon.
- The trigger must expose the generic label and active option through its accessible name, for example `테이블 보기 밀도: 좁은 간격`.
- Opening the control shows exactly `좁은 간격`, `기본 간격`, and `넓은 간격` as one radio-menu group; the active item has a check indicator.
- The selector may sit near the relevant table header or table body when header action space is already constrained.
- Do not render a separate visible `밀도` label beside the trigger.
- Density remains a presentation preference, so the menu is not a content tab or data filter.
- Prefer one persistent selector per table or same-role table group. When a screen repeats same-role tables, place it in the screen toolbar/filter row instead of repeating it in every section header.
- Density icons communicate row compactness by line spacing and are reused in both trigger and options.

### DEN-435 Tab/Table Density Control Decision

DEN-435 adds the shared tab and density UX contract:

- `docs/design/system/tab-table-density-contract.md`

Decision:

- The selected-value dropdown is the default shared density selector for all current consumers.
- The trigger shows the active density rather than hiding it behind three icon-only controls.
- The dropdown always exposes the current density through accessible copy and a checked menu item state.
- Density remains presentation-only. It must not change source data, row identity, selected row identity, sort/filter criteria, billing totals, permission checks, DB/API behavior, or persistence boundaries.
- The selector must not imply saved views or persistent user preferences unless separately scoped.

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
- The trigger `aria-label` must be `테이블 보기 밀도: <현재 선택값>`.
- Each menu option must preserve radio-menu semantics and expose its Korean option copy.

Implementation report:

- `docs/completed/design/2026-05-23-den-243-table-density-width-placement-report.html`
- `docs/completed/design/2026-05-23-den-245-table-density-control-benchmark-report.html`

Persistence:

- Table density uses local component state during Project 12 and is visible near the relevant table header or table body.
- Live user preference persistence is excluded.
- If localStorage is added later, scope it per workspace/module/table id and version the key.

## EmrDataTable Viewport Height Contract

`EmrDataTable` requires one explicit outer-height mode. This is separate from
the low-level `Table` `layout="fill" | "scroll"` width contract below.

| `viewportMode` | Use when | Height and scroll behavior |
| --- | --- | --- |
| `fill` | The table is the remaining body of a bounded flex workspace, such as Chart Plan/Order, customer management, or hospital-admin grids. | The shared root owns `h-full`, flex growth, and overflow containment. Its single table viewport fills the frame, and the horizontal scrollbar stays at the frame bottom. |
| `content` | The table is an inline section inside a page-owned vertical flow, such as billing checkout, dispensing/treatment, inpatient, membership, or clinical result detail. | The shared root keeps natural header-plus-row height. The table owns only horizontal overflow; the parent page remains the vertical scroll owner. |

Rules:

- `viewportMode` is required and has no default. New callers must decide the
  height intent instead of inheriting accidental parent flex behavior.
- A `fill` caller must provide a real bounded parent height and a flex path with
  `min-h-0`. The shared component owns its own `h-full`, `flex-1`, and
  `overflow-hidden` classes.
- A `content` caller must not add `h-full`, `flex-1`, or a feature-local vertical
  overflow wrapper to make the table fill available space.
- `containerClassName` is retained for visual surface styling only. Callers must
  not pass height, flex-growth, or overflow ownership utilities through it.
- Pinned tables keep `EmrPinnedTableViewport` as their only horizontal and
  vertical scroll owner. Non-pinned tables keep `data-slot="table-container"`
  as their only horizontal scroll owner.
- Do not wrap either mode in a feature-local `ScrollArea`. If a page needs
  vertical scrolling around a `content` table, the page-level flow owns it.
- In `fill`, the frame bottom, `data-emr-data-table` root bottom, viewport
  bottom, and horizontal scrollbar bottom must align within 1px. In `content`,
  a one-row table must remain at natural header-plus-row height even inside a
  taller parent.

### Pinned Scroll Boundary Indicator

`EmrPinnedTableViewport` owns the visual boundary between pinned columns and
the scrollable table region.

- Keep the 1px pinned divider visible at every horizontal scroll position.
- Center the 8px resize hit zone on the divider in the last left-pinned header.
- Keep that hit zone active without hover fill, active-drag fill, an internal grip,
  or a focus ring around the hit zone; the persistent divider is the pointer
  affordance. Preserve its resize cursor and pointer/touch behavior.
- Keep keyboard resizing available. When the resize button receives
  `:focus-visible`, show the focus indicator on the header content, away from
  the divider.
- Keep non-boundary resize grip indicators and hover feedback visible.
- Hide the left dimmer while the viewport is at its horizontal start. Show it
  only when the shared scroll-area root exposes `data-overflow-x-start`.
- Hide the right dimmer while the viewport is at its horizontal end. Show it
  only when the shared scroll-area root exposes `data-overflow-x-end`.
- When the table has no horizontal overflow, both dimmers remain hidden.
- Feature tables must not add their own scroll listeners, React state, shadows,
  or local boundary overlays. The Base UI scroll-area overflow attributes are
  the shared state source.

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

- Non-pinned tables keep `data-slot="table-container"` as the only horizontal
  overflow owner. Pinned `EmrDataTable` surfaces instead use the single shared
  `data-emr-pinned-table-scroll-owner="true"` Base UI viewport so its custom
  scrollbar can exclude fixed columns without adding a second scroll owner.
- `minWidth` is set on the table element, not separately on header/body rows.
- Do not wrap `TableHeader`, `TableBody`, row warning banners, or empty states in separate overflow containers.
- Adopt sticky columns only through the shared pinned-column contract below and with focused keyboard/focus verification.
- Page-level document width must remain equal to the viewport width at 1440, 1280, and 1024 screenshots.

### Shared Pinned Column Contract

- Use `Table pinning="columns"` whenever one or more header/body cells are fixed.
- Pass typed `pinned`, `pinnedOffset`, and `pinnedEdge` props to shared cells; feature code must not set sticky z-index, edge shadow, or inherited background directly.
- Pinned cells own opaque semantic surfaces for default, hover, selected, header, and loading states.
- Use the single `Table layout="scroll"` overflow owner.
- Wrap cross-family pinned table workspaces in `EmrPinnedTableWorkspace` and provide the feature-owned local identity inset once.
- When a selectable table fixes both selection and identity, provide the
  selection-column width to `EmrPinnedTableWorkspace`, pin selection at offset
  `0`, and pin identity at the selection width. The identity inset remains the
  workspace text axis, not the identity cell's physical left edge.
- Use `EmrTableHeaderCell identity` and `EmrTableIdentityCellContent` so header and row identity text inherit the same exact axis.
- When a body identity has a leading avatar/icon, pass its measured width and gap to `EmrTableIdentityCellContent`; the visual occupies the space before the shared text axis and must not move the identity text.
- Mark the opted-in title/header block with `data-emr-table-workspace-header="true"`; the shared pinned workspace contract owns its 0px padding-top.
- Mark the aligned footer with `data-emr-table-workspace-footer="true"` so its total text inherits the same identity inset.
- The first non-pinned header/body cell after the left pinned edge owns a
  10px boundary inset. Its direct `data-emr-table-content="true"` hook uses
  a 10px leading margin and zero leading padding so the content surface
  starts 10px after the boundary. Preserve nested body badge/button padding
  and the hook's trailing padding; do not apply the nested header-child
  normalization to body children.
- In `EmrDataTable`, preserve the 10px outer gap after the left pinned
  boundary. Sort buttons use 8px padding on each side, with another 2px
  inside the label span. At scroll origin, the first scrolling header text
  and plain body text start 20px after the boundary: 10px outer + 10px inner.
  Rich body content starts on that same axis and keeps its own inner padding.
  The low-level `Table` surface contract remains unchanged.
- Data-table identity labels and plain accessor cells share the workspace
  identity inset, with a 10px minimum cell inset. Existing identity wrappers
  retain avatar/icon positioning; plain cells and loading placeholders
  receive the inset once. Workspace title/search/footer insets are unchanged.
- These values follow the selected Figma fixed column and scroll containers
  (`27878:57638`, `27878:57717`, `27878:57725`). Check actual text bounds,
  not just label-span bounds; the label itself has 2px padding.
- `EmrDataTable` columns with `cellPadding: "none"` retain their
  `emr-data-table-cell-content--no-boundary-inset` opt-out for full-bleed or
  centered presentation. Boundary normalization must exclude those hooks
  and must not reach later scroll columns or right-pinned cells.
- Verify left/right offsets, multiple pinned cells, keyboard focus visibility, loading, hover, selected, and narrow desktop behavior.
- Use `EmrTableFeedbackSurface` around `EmrEmptyState` for terminal no-data,
  no-filter-results, read-error, and no-permission states. Do not leave the
  table header, stale rows, or table footer visible when the normal table
  cannot be rendered.

### Customer Identity Pinning

DESIGN-SYSTEM-PR-086 introduced the customer animal identity pin, and DESIGN-SYSTEM-PR-087 migrated its presentation to the shared pinned-column contract.

- Use the existing TanStack column-pinning state and the shared `Table layout="scroll"` container; do not add another overflow owner.
- Adapt TanStack offsets with `getEmrPinnedColumnProps`; customer feature code must not duplicate sticky position, z-index, or edge-shadow styling.
- Keep animal name, guardian name, and archived-record display name as the
  domain identity in their respective tables.
- Use explicit `pinnedIdentityColumnId` values for animal and guardian tables.
  Pin `select` first and the identity second; the non-selectable archive table
  uses identity-only shared fixed-cell props.
- Keep the animal identity column between 160px and 220px, with 184px as the default.
- Set one 48px workspace identity axis through `EmrPinnedTableWorkspace`.
  Customer animal rows do not render an avatar in the identity cell; the 44px
  selection column occupies the leading control region without moving the
  animal-name text.
- Align the title, search field, pinned header, pinned row text, and footer total through the same workspace axis instead of feature-local padding arithmetic.
- Keep patient scalar values and status badges on one line; the table owns a minimum width of 1480px.
- Sticky header and body cells must share the same hover, selected, loading, and error surface tokens as their row.
- Horizontal scrolling must not hide sort controls, checkbox focus rings, row actions, or the single table overflow owner.
- The pinned viewport's horizontal scrollbar track starts after the total left
  pinned width and ends before the total right pinned width. Wheel, keyboard,
  track, and programmatic scrolling all operate on that same viewport.
- The deleted guardian/patient screen must read the existing archive endpoint and restore through the target-specific existing mutation endpoint; permission denial and retryable read/mutation failure states stay visible.

### Hospital Admin Order Identity Pinning

- All 15 Order management leaf screens use the single shared renderer in `src/features/hospital-admin/module.tsx`.
- The 44px selection column is the physical first column and `표준 Order명` is
  the second column. Both are left-pinned, and only `표준 Order명` is the
  domain identity column.
- The Order title and pinned header/row identity text use a 48px local
  workspace axis.
- The shared pinned-table Base UI viewport owns both vertical and horizontal
  scrolling for Order tables; do not add a feature-local outer `ScrollArea` or
  another overflow container.
- Preserve sorting, filtering, selection, row actions, drawers, and workspace catalog read/mutation behavior when changing the presentation.
- Let one non-pinned data column absorb remaining table width so the fixed
  selection and identity widths do not scale.

### Row State and Action Visibility

- `EmrDataTable` action columns opt in with
  `actionVisibility: "always" | "contextual"`; the default is `always` so
  explicit work buttons and read-only table behavior do not change.
- Use `contextual` for secondary overflow menus. On fine-pointer desktop the
  action is hidden while idle and shown for row hover, `focus-within`, an open
  menu, or `data-state="selected"`. Touch and narrow layouts keep it visible.
- A detail-active row derives from the currently open drawer target and uses
  `data-state="selected"` plus `aria-current="true"`. This selected surface is
  independent from checkbox row selection and must not activate the checkbox
  or bulk-action bar.
- Apply `--emr-state-hover` (black 4%) and `--emr-state-selected` (black 6%)
  to the full row and pinned cells; reserve `--emr-state-active` (black 8%) for
  pressed or stronger active feedback. Do not add a feature-local left stripe
  or status rail for the detail-active state.
- Pinned cells must compose the same state overlay over their opaque row base.
  This keeps the visual color aligned with the row without exposing scrolled
  content through a translucent sticky cell.

## Header Interaction Rules

Define each column with a header role:

| Role         | Use for                                                               | Allowed affordance                                |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------- |
| `static`     | checkbox, action, icon-only, memo, summary, alert/change rows         | no sort/filter/menu                               |
| `sortable`   | stable scalar values: name, date/time, amount, quantity, status order | sort indicator and keyboard sort                  |
| `filterable` | status, 담당자, category/type, department, source                     | filter trigger or menu item                       |
| `menu`       | optional column actions such as hide/pin/copy in admin-heavy grids    | explicit menu button only                         |
| `compound`   | cells combining multiple values                                       | static by default; split if sort/filter is needed |

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

| Class                  | Surfaces                                | Header behavior                                                                        |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `clinical-review`      | 임상병리 검사 결과, 영상검사 Order 상세 | minimal sorting; no column menu by default; resize only if content routinely overflows |
| `operational-worklist` | 조제/처치, 입원, 진료/차트 오더 작업    | sortable scalar columns; toolbar filters; resize for eligible data columns             |
| `master-data-grid`     | 고객관리, 병원관리 Order 관리           | sort/filter/menu/column visibility can be enabled through shared config                |
| `financial-edit-grid`  | 수납 청구 항목                          | limited sort/filter; protect amount/quantity editing and totals alignment              |

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
- A resize-enabled TanStack table must use `columnResizeMode: "onChange"` so the rendered header and body widths follow the pointer before release. The default `onEnd` mode does not satisfy the CLAiR live-feedback contract.
- Pointer regression tests must measure the column width while the primary pointer button is still down. An assertion made only after `mouse.up()` does not prove live resize feedback.
- Fixed-width identifiers and display columns remain non-resizable even inside a resize-enabled table. For the customer master-data grids this excludes selection, patient code, and row actions; the remaining eligible data columns expose the shared edge hit zone.
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

| Mode               | Use for                                                                             | Behavior                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `one-line`         | IDs, names, status labels, 담당자, dates, amounts, short order names, phone numbers | single line, ellipsis on overflow                                                                                     |
| `two-line-if-long` | order names, 진단명, 입실 메모, 복약지도, clinical caution summaries                | clamp to 2 lines only when content exceeds one line                                                                   |
| `always-multiline` | row detail panels, comments, 판독의견 editors, 종합소견 text areas                  | not used inside dense table body cells by default                                                                     |
| `badge-wrap`       | multiple status/caution badges                                                      | badges may wrap to 2 lines in standard/comfortable density; compact prefers horizontal scroll or overflow containment |
| `full-on-demand`   | clinically important long text that may be truncated                                | one- or two-line preview plus tooltip, popover, side detail, or drawer full text                                      |

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

### DEN-265 Chart/order Adoption

- `src/features/chart/module.tsx` applies `EmrTableHeaderCell` and `EmrTableCellText` to the chart/order dense clinical table.
- Chart/order column roles are kept local to the table: checkbox/action columns stay static with resize excluded; scalar data columns stay one-line; order names and diagnosis names allow limited `two-line-if-long` previews.
- DEN-265 does not add live sort/filter behavior and does not broaden the primitive adoption to unrelated EMR tables.

### DEN-266 Billing Invoice Table Adoption

- `src/features/billing/module.tsx` applies `EmrTableHeaderCell` and `EmrTableCellText` to the billing invoice line table only.
- The billing invoice line table records local column policy metadata for header interaction, resize policy, and text mode.
- The table follows the `financial-edit-grid` policy: invoice item descriptions may use `two-line-if-long`, while category, unit price, discount, and line total stay `one-line`.
- Quantity remains an editable input column and is excluded from resize affordance policy.
- Display-only discount and line-total columns are excluded from resize affordance policy.
- The adoption does not add real sort, filter, column menu, resize behavior, payment-provider behavior, persistence, DB, RLS, or server enforcement changes.

### DEN-267 Customer Table Adoption

- `src/features/customer/module.tsx` applies `EmrTableHeaderCell` and `EmrTableCellText` through the shared customer management data table renderer.
- Customer table columns now record local metadata for header interaction, resize policy, and text mode.
- Selection and row action columns stay static and are excluded from resize affordance policy.
- Scalar/contact/date values stay `one-line`.
- Person names, connected guardian/patient summaries, and CS/work summary-style text may use `two-line-if-long` when clipping would lose meaning.
- Badge cells remain feature-local structured content rather than being forced through the text primitive.
- The adoption does not add real sort, filter, column menu, resize behavior, live Supabase, DB, RLS, server enforcement, role policy, or external messaging changes.

### DEN-269 Hospital Admin Order Catalog Adoption

- `src/features/hospital-admin/module.tsx` applies the shared header and cell text primitives to the hospital admin Order catalog table only.
- The table is treated as an admin/master-data catalog: type, status, and target are filterable headers; Order names and price are sortable-role headers; checkbox and action columns remain static.
- Resize policy is declared as `data-column` for data columns and `none` for checkbox/action columns. DEN-269 does not implement new resize behavior.
- Scalar values stay `one-line`; high-meaning Order names, in-hospital names, and billing names use limited `two-line-if-long`.
- Hospital admin category navigation, search/filter controls, row selection, drawer edit/delete, row action menu, and mock/session behavior remain unchanged.
- The focused regression contract lives in `tests/hospital-admin.spec.ts` and checks primitive data attributes plus cell text modes.

### DESIGN-SYSTEM-PR-097 Live Column Resize Contract

- Customer animal/guardian data grids, hospital-admin Order, and hospital-admin Order Set use TanStack `columnResizeMode: "onChange"`.
- Customer table composition assigns the shared `data-column` resize policy to eligible data columns while keeping fixed-width patient code, selection, and row-action columns at `none`.
- Hospital-admin keeps its existing column policy and hit zones; only the update timing changes from TanStack's `onEnd` default to live pointer feedback.
- Focused Playwright coverage holds the pointer down, moves the resize grip, and asserts the header width before pointer release.
- Sorting, filtering, selection, pinning, row data, persistence, DB, Supabase, auth, and permission contracts remain unchanged.

## Implementation Gate

Before Project 12 implementation issues:

1. Inventory the current table surface and classify it as clinical dense, financial, master data, admin, history, or small summary.
2. Pick density default and whether the table is `fill` or `scroll`.
3. Define minimum width and column role table.
4. Add responsive evidence at 1440, 1280, and 1024 when the table has more than six columns.
5. Keep DB, RLS, payment, provider integration, and server policy out of table UX issues.
