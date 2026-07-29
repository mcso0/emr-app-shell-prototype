---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-141"
linear_project: "00 UI 시스템 인벤토리 및 리팩토링 기준"
source_docs:
  - "components.json"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/system/ui-debt-inventory.md"
---

# Component Ownership Rules

These rules define where UI code should live during the UI/UX refactor initiative. They are intended for screen-level Linear issues and future agents.

## Core Decision Model

Use the smallest stable owner that preserves behavior and reduces real complexity.

Choose placement in this order:

1. Use an existing shadcn/ui primitive from `src/components/ui/*` when the need is generic UI behavior.
2. Use an existing EMR component from `src/components/emr/*` when the need matches an established EMR workspace pattern.
3. Create a feature-local component under `src/features/<feature>/components/*` or inside the feature module when the pattern is still workflow-specific.
4. Create a new EMR component only when the same stable UI role appears across at least two screen families and cannot be expressed by existing primitives.
5. Leave inline markup local when it is small, single-use, and clearer than a named component.

Do not extract UI only because a file is long. Extract when the boundary has a clear responsibility, a stable data contract, and a verification path.

## Ownership Boundaries

| Location | Owns | Does not own |
|---|---|---|
| `src/components/ui/*` | shadcn/Base UI primitives, generic component variants, accessibility structure, semantic token defaults | EMR workflow semantics, patient/order/billing-specific props, screen-specific layout decisions |
| `src/components/emr/*` | EMR workspace patterns, dense operational surfaces, patient/order/status/list/table/panel conventions, semantic token usage policy | one-screen workflow logic, data fetching, route state, live persistence, product policy changes |
| `src/features/<feature>/components/*` | feature workflow sections, local dialogs, local search rows, local drawer fields, domain-specific table cells | reusable cross-screen primitives unless proven stable |
| Local inline markup | tiny one-off layout or content that is easier to read in place | repeated control styling, repeated status logic, complex keyboard/focus behavior |
| `src/shell/*` | global navigation, workspace tabs, app shell layout, command palette, drawer routing | feature-specific cards, feature forms, product workflow changes |

## Extraction Criteria

Extract into a feature-local component when at least two are true:

- the block has a clear workflow role, such as SOAP section, diagnosis search row, invoice line editor, registration step, or drawer field
- the block mixes state and rendering enough that local names make the parent easier to scan
- the block needs focused unit or Playwright regression coverage
- the block is likely to change during one screen project but not across the whole app

Promote to `src/components/emr/*` only when all are true:

- the UI role is repeated across at least two screen families
- the visual and interaction behavior should be consistent across those screens
- the prop contract can avoid leaking one screen's data shape
- the component can be backward-compatible for existing users
- the extraction reduces duplication without hiding clinical, billing, or workflow meaning

Use `src/components/ui/*` directly when:

- the behavior is generic shadcn behavior, such as `Button`, `Dialog`, `Input`, `Select`, `Table`, `Badge`, `Popover`, `DropdownMenu`, `SegmentedControl`, `Skeleton`, or `Tooltip`
- existing variants cover the need
- EMR semantics can be expressed through composition, children, labels, and semantic tokens

Leave local when:

- the markup is one-off and shorter than the extracted API would be
- the layout value is intentionally tied to one dense table or clinical display
- the block uses workflow-specific copy or validation that would make a shared component vague
- extraction would require broad rewrites or risky behavior changes

## Naming Rules

Use `Emr` prefix for shared EMR components:

- `EmrSubpanel`
- `EmrSidePanelCard`
- `EmrStatusBadge`
- `EmrConfirmDialogContent`
- `EmrTableCheckbox`

Use feature names for feature-local components:

- `ChartSoapSection`
- `ChartDiagnosisSearchRow`
- `ReceptionWalkInDialog`
- `ProfileRegistrationStep`
- `BillingInvoiceLineTable`
- `HospitalAdminDrawerField`

Avoid vague names:

- `CommonCard`
- `GenericPanel`
- `SharedTable`
- `ReusableForm`
- `BaseThing`

Name by product role or UI responsibility, not by current styling.

## Prop Design Rules

Prefer composition for flexible content:

- pass `children`, `headerActions`, `footer`, `badge`, or `meta` slots when content varies
- pass typed callbacks for behavior, such as `onSelect`, `onToggle`, `onConfirm`, or `onValueChange`
- keep labels and aria labels explicit at the call site when they are workflow-specific

Use domain props only when the component is intentionally domain-specific:

- `EmrOrderQueueSidePanel` can accept `OrderQueueItem[]` because it is an order queue component
- a generic table wrapper should not accept `Order`, `Invoice`, or `Patient` directly
- a status badge resolver should accept a stable tone or domain mapper, not infer meaning from arbitrary Korean labels unless that is the explicit contract

Avoid shared props that leak screen assumptions:

- no `isChartScreen`, `billingMode`, or `receptionVariant` in shared EMR primitives
- no `className`-only API that requires each screen to restyle the same role
- no shared component that owns route navigation, persistence, or global store mutation unless it lives in `src/shell/*`

## shadcn Composition Rules For This Repo

The project uses shadcn `base-nova` with Base UI primitives, `@/components/ui` aliases, and `src/app/globals.css` tokens.

Follow these local shadcn rules:

- use existing components before custom markup
- use built-in `Button` variants and sizes before custom button classes
- use semantic tokens and EMR aliases, not raw color utilities
- use `FieldGroup`, `Field`, and field subcomponents for reusable form layout
- ensure `Dialog`, `Sheet`, and drawer-like overlays have a title; use `sr-only` when visually hidden
- keep `SelectItem` inside `SelectGroup` and menu items inside the matching menu structure when adding new grouped menus
- use `Badge` for badges/chips and `Skeleton` for loading placeholders
- use `data-icon` on icons inside `Button` when using button icon slots
- use `cn()` for conditional classes
- prefer `gap-*` over `space-x-*` or `space-y-*`

Do not add or update upstream shadcn components during a screen issue unless the issue explicitly scopes that work.

## Current Codebase Examples

| Pattern | Current state | Rule |
|---|---|---|
| Tables | `src/components/ui/table.tsx` owns generic table/scroll/pinning mechanics; `EmrPinnedTableWorkspace`, selection/identity primitives, and `EmrTableFeedbackSurface` own the cross-family EMR identity axis, fixed selection relationship, and terminal whole-table feedback boundary; `src/components/emr/emr-data-table.tsx` remains order-specific despite the broad name | compose the generic `Table` with EMR pinned-workspace primitives; selectable tables pin selection before their domain identity, and terminal no-data/filter/error/permission states replace the normal table surface; do not force billing, chart, customer, or hospital admin into `EmrDataTable` |
| Side panels | `EmrSubpanel`, `EmrSidePanelCard`, `EmrOrderQueueSidePanel`, `EmrTextSideNavButton`, and `EmrContentHistoryList` already exist | reuse first; add variants only after a second screen proves a stable role |
| Status badges | `EmrStatusBadge` is label-based for a limited set; feature screens still have local tone maps | keep domain-specific statuses local until a tone resolver contract is defined |
| Confirm dialogs | `EmrConfirmDialogContent` exists and is used across chart, profile, auth, and hospital admin; `EmrDialogShell` defines the forward-looking confirm/form/wide-form shell | keep existing simple confirmations stable; use `EmrDialogShell` for new or migrated dialog work when a screen issue includes visual QA |
| Row action menus | `EmrRowActionMenu` standardizes dense row/card more-menu trigger size, menu item description, click propagation, and Escape/outside-close behavior | keep item labels, unavailable feedback, navigation, drawer, and mutation callbacks at the feature call site |
| Profile/search forms | profile drawer, reception, chart diagnosis search, customer search, and auth forms use similar primitives with different behavior | split feature-local first; compare after screen work before promoting fields/search rows |
| Command/navigation controls | nav rail, workspace tabs, and global command palette carry shell state and keyboard behavior | keep in `src/shell/*`; refactor under project `08` only |

## Behavior Preservation Rules

Before extracting:

- write down the current selected, hover, disabled, empty, loading, and error states
- identify any keyboard/focus behavior and aria labels
- identify route query, drawer, tab, or global store dependencies
- keep the original component's tests passing before changing styling

During extraction:

- move markup and local helpers without changing data shape first
- keep callbacks and state ownership in the current owner unless the issue explicitly changes ownership
- preserve test IDs used by Playwright
- preserve session-only mock behavior

After extraction:

- run focused verification for the touched screen or shared component
- add browser/visual QA when layout, dialog, drawer, popover, table, or shell controls change
- document intentional local exceptions in the issue report

## Copy/Paste Rule Block For Linear Issues

Use this block in future screen-level issues when helpful:

```md
Component ownership rules:

- Prefer existing `src/components/ui/*` primitives for generic UI behavior.
- Prefer existing `src/components/emr/*` primitives for established EMR workspace patterns.
- Split workflow-heavy blocks into feature-local components before promoting shared abstractions.
- Promote to `src/components/emr/*` only when the same stable UI role appears across at least two screen families and the prop contract does not leak one screen's data shape.
- Keep one-off dense table widths, workflow-specific copy, validation, and clinical/billing semantics local unless a scoped issue defines a shared contract.
- Preserve current behavior, test IDs, route/drawer/tab state, keyboard/focus behavior, and session-only mock semantics during extraction.
- Do not introduce DB, Supabase, RLS, live persistence, server enforcement, payment, email, deploy, or role/permission policy work.
```
