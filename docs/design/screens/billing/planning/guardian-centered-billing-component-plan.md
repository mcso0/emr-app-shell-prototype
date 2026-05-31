---
id: DESIGN-SCREEN-BILLING-GUARDIAN-CENTERED-COMPONENT-PLAN
status: approved
area: design
doc_type: implementation-plan
related_work:
  - DEN-359
  - DEN-358
  - DEN-360
  - DEN-361
  - DEN-362
  - DEN-363
  - DEN-364
supersedes: []
superseded_by: []
last_updated: 2026-05-31
---

# Guardian-Centered Billing Component Plan

This is the DEN-359 component and file-ownership plan for implementing the
guardian-centered billing checkout flow without a broad one-shot rewrite.

Source UX contract:
[Guardian-Centered Billing Checkout Flow](../../../flows/guardian-centered-billing-checkout-flow.md)

## Current Module Inventory

`src/features/billing/module.tsx` is currently a 2,296-line client module with
five different responsibilities:

| Responsibility | Current location | Notes |
| --- | --- | --- |
| Route/API fetch and persistence helpers | lines 447-626 | Candidate, invoice-line, and payment-status requests are embedded in the UI module. |
| Candidate line merging and live candidate detail | lines 627-721 | Important DEN-348 behavior; preserve before UI reshaping. |
| Workspace data hook | lines 723-915 | Reads URL params, store state, persisted candidates, invoice lines, and payment state. |
| Side panel, header, title, guardian groups, combine panel | lines 921-1281 | Queue/header/guardian grouping responsibilities are mixed. |
| Invoice line table | lines 1283-1619 | Sort/filter/table behavior and candidate row badge are self-contained enough to split later. |
| Main billing content | lines 1621-1726 | Orchestrates title card, guardian groups, combine panel, and invoice table. |
| Right payment panel and financial dialogs | lines 1728-2296 | Payment method, status notes, issue invoice, unpaid, paid, and preflight dialog are mixed. |

Supporting files:

| File | Current role | DEN-359 recommendation |
| --- | --- | --- |
| `src/features/billing/data.ts` | Mock/domain selectors for queue rows, guardian groups, and billing detail. | Extend here first for guardian ledger and queue semantics before UI code grows. |
| `src/features/billing/store.ts` | Zustand store for selected invoice, combined invoice IDs, payment method, line edits. | Add checkout selection state here only when DEN-362/DEN-363 needs cross-component selected ledger rows. |
| `src/features/billing/server-payment-status-persistence-core.ts` | Local-first/server payment status route core. | DEN-366 owns reason-backed unpaid semantics; avoid changing in earlier UI-only issues. |
| `src/features/billing/server-invoice-candidate-sync-core.ts` | Candidate sync and invoice candidate readback. | Preserve DEN-348/DEN-341 candidate behavior; no UI issue should rewrite it. |

## Component Boundary Plan

### Shared Utility Boundary

Create `src/features/billing/billing-formatters.ts` or equivalent only if the
first implementation issue needs to share formatting outside `module.tsx`.

Suggested exports:

- `formatBillingAmount`
- `formatBillingShortDateTime`
- `getBillingPaymentMethodLabel`
- invoice/payment status label helpers

Keep this small. Do not move route fetchers into this utility.

### DEN-360: Guardian Context Bar

Primary ownership:

- `BillingHeader`
- top-level context-bar component under `src/features/billing/components/guardian-context-bar.tsx` or a small local component if the implementation remains single-file for the first PR
- selector helpers in `src/features/billing/data.ts` only if needed for guardian summary amounts

Reuse:

- `EmrPatientContextBar` layout semantics if it can be configured safely
- `Badge`
- `EmrStatusBadge`
- EMR typography tokens

Avoid:

- changing queue grouping
- changing invoice-line table behavior
- changing payment route/core behavior

Required follow-up test:

- focused billing visual/content assertion that guardian name, owned patients,
  `수납대기`, and `미납` summary appear while breed/age/sex are not primary header
  fields.

### DEN-361: Billing Queue

Primary ownership:

- `billingQueueGroups`
- `QueueItem`
- `BillingSidePanel`
- `BillingQueueGroup`
- `getBillingFilterForInvoice`
- `getBillingQueueRows`
- `BillingFilter`

Recommended semantic mapping:

| New group | Current filter candidate | Required refinement |
| --- | --- | --- |
| `수납대기` | current `waiting` / `draft` | Include payable candidate-backed draft rows. Do not mark same-day normal waiting as unpaid. |
| `미납` | current `unpaid` / issued with balance | Only reason-backed deferred/overdue rows should be shown here once DEN-366 lands. |
| `완료` | current `closed` | Paid, refunded, voided, or terminal billing rows. |

Avoid:

- ledger multi-select work
- payment state route/core changes
- right panel CTA changes

Required follow-up test:

- focused billing side panel grouping and row labels.

### DEN-362: Guardian Ledger Sidebar

Primary ownership:

- new ledger selector helpers in `src/features/billing/data.ts`
- selected ledger state in `src/features/billing/store.ts`
- new component such as `GuardianBillingLedger`
- replacement or reshaping of current `GuardianGroups` and `CombinePanel`

Current components to replace or absorb:

- `GuardianGroups`
- `CombinePanel`

Recommended state:

- selected checkout invoice IDs stay in store
- ledger filter/date range can stay local unless right panel or tests need access
- co-guardian include toggle should be UI-only until a later DB/query issue

Avoid:

- right payment panel mutation behavior
- server payment status semantics

Required follow-up test:

- ledger selection updates the central selected checkout context.

### DEN-363: Selected Checkout Workspace

Primary ownership:

- `InvoiceLinesTable`
- `BillingInvoiceLineSortableHead`
- invoice-line filter/sort constants
- candidate row helpers:
  - `billingCandidateInvoiceLineIdPrefix`
  - `isBillingCandidateInvoiceLine`
  - `getPersistedInvoiceLines`
  - `mergeInvoiceCandidateLines`

Recommended extraction:

- Move table-specific constants and table component to
  `src/features/billing/components/checkout-items-table.tsx` when the first
  substantial table edit happens.
- Keep candidate merge helpers close to the data hook or a `billing-candidates`
  helper file; do not bury DEN-348 behavior inside table rendering.

Avoid:

- changing `clair_sync_billing_invoice_candidates` expectations
- making candidate rows editable unless the server/core contract is updated

Required follow-up test:

- DEN-348 candidate table readback still passes.
- selected checkout groups show patient/encounter/invoice grouping.

### DEN-364: Payment Summary And CTA

Primary ownership:

- `BillingRightPanel`
- `SummaryLine`
- `PaymentMethodControl`
- `PaymentStatusNote`
- `BillingPaymentErrorMessage`
- `BillingFinancialPreflightDialog`
- `BillingPreflightLine`
- `BillingPaymentActionFooter`

Required semantic changes:

- replace user-facing primary `청구 확정` with `수납 진행` / `결제 진행`
- keep `수납 완료` as payment completion
- move `미납 처리` to secondary/overflow hierarchy
- require unpaid reason before `mark_unpaid`

Avoid:

- DB migration
- combined payment allocation persistence
- candidate sync rewrite

Required follow-up test:

- payment summary primary CTA copy
- unpaid reason dialog validation
- existing synthetic paid path remains intact

## Suggested Extraction Sequence

Do not extract everything before changing UX. Prefer small, reviewable moves:

1. DEN-360 may keep a local billing-specific wrapper if shared context-bar API
   changes would touch clinical screens.
2. DEN-361 should update queue labels/selectors before moving queue components.
3. DEN-362 can introduce a new ledger component and retire `GuardianGroups` /
   `CombinePanel` from the rendered path.
4. DEN-363 can extract checkout table after ledger selection shape is known.
5. DEN-364 should isolate payment summary last, because it depends on final
   checkout selection, amount, and unpaid semantics.

## File Ownership Matrix

| Issue | Primary files | Secondary files | Must not touch unless unavoidable |
| --- | --- | --- | --- |
| DEN-360 | `src/features/billing/module.tsx`, optional `components/guardian-context-bar.tsx` | `src/features/billing/data.ts` | payment status core, candidate sync core |
| DEN-361 | `src/features/billing/module.tsx`, `src/features/billing/data.ts`, `src/features/billing/store.ts` | focused billing tests | right panel payment action handlers |
| DEN-362 | `src/features/billing/module.tsx`, `src/features/billing/data.ts`, `src/features/billing/store.ts`, optional `components/guardian-billing-ledger.tsx` | billing tests | server payment status core |
| DEN-363 | `src/features/billing/module.tsx`, optional `components/checkout-items-table.tsx` | candidate readback tests | payment status core, remote RPC contracts |
| DEN-364 | `src/features/billing/module.tsx`, optional `components/payment-summary-panel.tsx`, `src/features/billing/server-payment-status-persistence-core.ts` only for reason validation if scoped | payment status tests | candidate sync core |

## Reusable Components And Tokens

Use existing primitives first:

- `EmrSubpanel`, `EmrSubpanelTitle`, `EmrSubpanelBody`
- `EmrListHeader`, `EmrListHeaderIconButton`
- `EmrSidePanelCard`, `EmrSidePanelCollapsibleGroup`
- `EmrStatusBadge`, `Badge`
- `EmrInlineAlert`, `EmrDialogShell`
- `EmrTableCellText`, `EmrTableHeaderCell`, `EmrTableDensitySelector`
- `Table`, `Checkbox`, `Button`, `Input`, `SegmentedControl`, `Popover`

Token guidance:

- use `--emr-surface-workspace`, `--emr-surface-muted`, `--emr-line-hairline`,
  `--emr-state-selected`, and EMR typography classes
- do not introduce a new billing-only color palette
- do not rely on row background color alone for billing state
- keep cards at compact operational radius

New components are acceptable when they isolate stable billing concepts:

- `BillingGuardianContextBar`
- `GuardianBillingLedger`
- `CheckoutItemsTable`
- `BillingPaymentSummaryPanel`
- `UnpaidReasonDialog`

Prefer feature-local components first. Promote to shared `components/emr` only
after the pattern repeats outside billing.

## Next.js Docs To Read Before App Code Changes

Before any DEN-360 through DEN-364 app code work, read the relevant local Next.js
docs under `node_modules/next/dist/docs/`:

- App Router / routing docs for route and search param behavior if changing
  URL-driven invoice/encounter selection.
- Client Components docs before editing `src/features/billing/module.tsx` or
  adding feature-local client components.
- Data fetching / route handler docs before changing billing API calls or
  route boundaries.

DEN-359 itself does not modify app code, so no Next.js docs were required for
this planning step.

## Verification Order For Follow-Up Issues

Use narrow checks first:

1. focused billing Playwright test for the touched UI slice
2. focused billing server spec if payment/candidate persistence is touched
3. `npx tsc --noEmit --pretty false`
4. targeted lint for touched source files
5. `npm run security:secrets`

Add fixed staging replay only at DEN-368 or when a staging-only candidate/readback
bug is suspected.
