---
status: "active"
updated: "2026-10-10"
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

## Presentation Versus Feature Adapters


An owner is the code area responsible for a change, not a named person.
`CustomerListHeader` wraps `EmrTableWorkspaceHeader` to supply customer-specific
labels and test IDs; preserve this adapter. `EmrProfilePanel` supplies a shared
frame while reception's `ProfileSidePanel` supplies patient/guardian content.
These are complementary responsibilities, not duplicate implementations.

For patient queues, `features/work-queue/patient-queue.ts` owns rule inputs and
group/sort behavior without importing a UI card type. `PatientQueueDisplayRow`
in the shared UI combines those inputs with the existing card contract. Callers
prepare the explicit assignee sort name and card together; changing card copy
must not silently redefine sorting. Preserve existing fallback and identity rules.

Storybook Patterns/Templates are synthetic usage examples. Product features
need not import them. The representative inventory below records callers, Storybook placement and
scoped review status. The separate uncommitted v1 recipes/catalog are not part
of this delivery; this PR does not add their implementation.

## Representative UI Ownership And Review Inventory

Checked against local source and Storybook on 2026-10-10. Owners below are code
responsibilities, not assigned people. Usage lists are representative source
callers, not proof of every rendered route or a deployment. `DS` abbreviates
`Design System` in the Storybook column. This isolated inventory covers existing
product components; prior uncommitted v1 catalog/recipe work is excluded.

Keep three facts separate:

- **Product usage:** an existing product caller, or a Storybook-only example.
- **Automated verification:** named checks and their recorded result/date in the
  [active work item](../../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-011-patient-queue-view.md#approved-minimal-rulepresentation-separation--2026-10-10).
  A passing synthetic story does not prove production integration.
- **Human acceptance:** only the explicitly reviewed scope is accepted. Earlier
  local v1 review notes do not prove those WIP changes are in this PR. **Pending**
  below means full v1 acceptance is not recorded; it does not mean an existing product component is unfinished.

| UI | Role and owner | Representative product usage | Storybook path | Human review scope |
| --- | --- | --- | --- | --- |
| Button / Input | Basic UI owns generic controls/accessibility; feature owns values/actions | Auth, customer forms, chart, billing | DS/UI/Button; DS/UI/Input | Full v1 acceptance pending |
| EmrDataTable | Shared EMR owns table rendering/scroll; feature owns data, selection and sorting state | Customer tables, hospital order management, chart, lab, billing, dispensing | DS/EMR/EmrDataTable | Sort appearance and synthetic list refinements partially reviewed; full v1 pending |
| EmrTableWorkspaceHeader | Shared EMR owns title/count/search layout; feature owns criteria | CustomerListHeader adapter; hospital module/order sets direct usage | DS/EMR/EmrTableWorkspaceHeader | Synthetic list review only; full v1 pending |
| EmrEmptyState | Shared EMR owns feedback presentation; caller selects state/copy/retry | Customer tables, chart, lab, billing, profiles | DS/EMR/EmrEmptyState | Example icon/copy restoration verified; human review pending |
| EmrPatientContextBar | Shared EMR owns summary presentation; feature supplies data/permitted actions | Chart workspace, lab module, dispensing module | DS/EMR/EmrPatientContextBar | 14px icon correction approved; full v1 pending |
| EmrProfilePanel | Shared EMR owns frame, identity, tabs and state surfaces | Reception patient/guardian profile; staff operational profile | DS/EMR/Profile Panel | Full v1 acceptance pending |
| ProfileSidePanel | Feature owns patient/guardian information, history, reservations and billing content; current source is features/reception | Patient/guardian profile drawers | Features/Customer/Patient Guardian Profile Side Panel | Full v1 acceptance pending; Customer is the product grouping, not a source-folder claim |
| History Controls | Shared EMR owns search/filter controls; feature owns history/query/selection | Chart, billing, fulfillment patient-history aside | DS/EMR/History Controls | Full v1 acceptance pending |
| EmrDialogShell | Shared EMR owns dialog regions; feature owns validation/save/open state | Registration, chart, execution result, atomic retest, billing | DS/EMR/EmrDialogShell | Existing 18px title retained; full v1 pending |
| PatientQueue | Shared EMR owns presentation; features/work-queue supplies grouping/status/priority rules | Lab module; dispensing via EmrOrderQueueSidePanel | DS/EMR/PatientQueue | Full v1 acceptance pending; rule/display inputs separated in the approved minimal follow-up |
| WorkspaceDocumentLayout | Shell owns production layout/width behavior; feature owns content | Chart, lab/imaging, dispensing/treatment, billing | No standalone story in this slice; prior local template WIP is excluded | Existing adoption is separate from full v1 acceptance, which is pending |

The profile frame and patient/guardian content are complementary stories. The
feature imports the shared frame; keep both. Likewise, keep CustomerListHeader
as a feature adapter, not a duplicate header implementation.

Approved Storybook classification correction: `EMR/Profile Panel` becomes
`Design System/EMR/Profile Panel`. Its generated ID prefix changes from
`emr-profile-panel--` to `design-system-emr-profile-panel--`; Docs uses
`design-system-emr-profile-panel--docs`. Old bookmarks need the new prefix.
Other story titles, production component paths and APIs are unchanged.

Earlier local v1 work retained a separate customer/guardian header-geometry
check failure. That visual work is excluded here; this PR does not claim to
resolve or revalidate it. Existing local recipe examples and their descriptions
remain in the primary checkout, outside this PR.
The later approved queue follow-up separates rule inputs from card presentation
without moving files or changing behavior. `PatientQueueRow` owns rule metadata
and the explicit `assigneeSortName`; `PatientQueueDisplayRow` adds the existing
card shape at the UI boundary. Adapters preserve the previous name value and
name → assigned ID → fallback ordering. Grouping returns the original rows.
The UI still calls the existing grouping helper; no broader layer change is
required. Product geometry fixes and example-file moves remain outside scope.
See [queue work evidence](../../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-011-patient-queue-view.md#approved-minimal-rulepresentation-separation--2026-10-10).


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
| Tables | `src/components/ui/table.tsx` owns low-level semantic table/overflow/sticky primitives; `src/components/emr/emr-data-table.tsx` owns TanStack-driven dense operational table rendering and the required `viewportMode` height contract; `EmrPinnedTableViewport` owns the single Base UI scroll viewport and center-only scrollbar for pinned grids; `EmrTableWorkspaceHeader`, `EmrTableFeedbackSurface`, and feature adapters own controls, terminal states, and workflow behavior | use `Table` for generic information tables and static summaries; use `EmrDataTable<TData>` when a screen has a TanStack table instance and needs the shared customer-style header/row, density, sizing, or optional pinning contract; choose `fill` only for a bounded workspace and `content` for natural-height inline tables; keep data fetching, sorting/filtering/selection state, drawers, mutations, and domain cells in the feature; pin selection before identity when both are present; do not add a feature-local ScrollArea around a pinned `EmrDataTable` |
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
