---
id: "DESIGN-SYSTEM-PR-097"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "Browser comment / customer and hospital-admin live column resize"
created: "2026-08-30"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
dependencies:
  - "DESIGN-SYSTEM-PR-087"
  - "DESIGN-SYSTEM-PR-095"
---

# Customer And Hospital-Admin Live Column Resize

## Goal

Make eligible customer-management and hospital-admin table columns visibly
follow the pointer during drag, matching the existing Chart table behavior.

## Cause

TanStack Table defaults `columnResizeMode` to `onEnd`. The hospital-admin
Order and Order Set controllers omitted an override, so their widths changed
only after pointer release. Customer tables also omitted the mode and never
opted eligible data columns into the shared resize policy, so they exposed no
resize handles at all.

## In Scope

- Set `columnResizeMode: "onChange"` for customer, hospital-admin Order, and
  hospital-admin Order Set table controllers.
- Opt eligible customer data columns into the shared `data-column` resize
  policy.
- Keep fixed-width patient code, selection, and row-action columns static.
- Add pointer regressions that assert width changes before pointer release.
- Update the canonical grid ergonomics contract and completion report.

## Out Of Scope

- Shared component redesign, new dependencies, or resize persistence.
- Sorting, filtering, selection, pinning, row data, drawer, or navigation
  behavior changes.
- DB, Supabase, API, auth, permission, or workspace-boundary changes.

## Done Criteria

- Hospital-admin `원내 Order명` and `Order 세트명` widths change while dragging.
- Customer `동물명` and other eligible data columns expose the shared grip and
  resize while dragging.
- Customer patient code, selection, and row-action columns remain fixed.
- Focused Playwright tests measure changed width before `mouse.up()`.
- Lint, TypeScript, build, docs, secret scan, and diff gates pass.

## Result

- Added live resize timing to the three table controllers without changing the
  shared `EmrDataTable` API.
- Added customer feature-level resize policy derivation so only eligible data
  columns receive grips.
- Added focused pre-release browser regressions for all three affected table
  configurations.

## Verification

- Focused Playwright: customer animal, customer guardian geometry,
  hospital-admin category navigation, individual Order live resize, and Order
  Set live resize passed.
- The broader customer/hospital-admin run passed 65 of 70 before two
  resize-button-aware locator corrections; both corrected tests passed on
  focused rerun. The remaining three failures are the existing main-content
  header geometry expectation of 56px against the current 44px runtime and do
  not touch this change set.
- Lint, TypeScript, production build, docs links, Korean UX copy, secret scan,
  and diff whitespace checks passed.

## Completion Report

`docs/completed/design-system/2026-08-30-live-column-resize-contract-report.html`
