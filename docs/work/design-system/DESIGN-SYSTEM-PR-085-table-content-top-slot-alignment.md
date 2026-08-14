---
id: "DESIGN-SYSTEM-PR-085"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Browser comment / table content-top slot alignment"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
dependencies:
  - "DESIGN-SYSTEM-PR-084"
updated: "2026-07-27"
---

# Table Content-Top Slot Alignment

## Goal

Apply the approved CDS.V2 table-workspace layout follow-up: a feature-owned
56px content-top slot, `#FCFCFC` content frame, and a 0px table-header-to-first-
row gap.

## Scope

- Apply the slot and content surface to the shared customer animal/guardian
  table boundary.
- Apply the same slot and content surface to hospital-admin Order management
  and audit review.
- Preserve the existing title, filters, sorting, density, selection, drawer,
  loading, empty, error, and permission behavior.
- Add focused geometry coverage for customer animal/guardian and
  hospital-admin Order/audit tables.

## Out Of Scope

- Deleted customer history, membership/settings screens, or hospital-admin
  surfaces that do not render these table workspaces.
- Global app-shell insertion or global workspace-surface token changes.
- New table abstractions, row-density behavior, data behavior, API, Supabase,
  permission, or persistence changes.
- Production deployment, PR creation, or merge.

## Done Criteria

- Customer animal and guardian tables render one 56px top slot before the
  existing 108px list header.
- Hospital-admin Order and audit tables render one 56px top slot before their
  existing title sections.
- Touched content frames compute to `rgb(252, 252, 252)`.
- The first body row starts at the table-header boundary with at most 0.5px
  collapsed-border tolerance.
- Focused customer, hospital-admin, and audit behavior tests pass.
- ESLint, TypeScript, production build, docs validation, and visual review are
  recorded.

## Result

- Added the empty decorative slot with `aria-hidden="true"` and a shared
  `data-emr-content-top-slot` inspection contract at each feature boundary.
- Kept the customer table surface white and column header `#FAFAFA` while the
  surrounding content frame and list header use `#FCFCFC`.
- Kept hospital-admin Order and audit table surfaces white while their title
  and control sections inherit the `#FCFCFC` content frame.
- Preserved all existing customer and hospital-admin workflow behavior.
- Stabilized the existing customer density regression test by activating the
  Base UI radio item directly after it becomes visible.

## Verification Result

- Focused ESLint: pass.
- `npx tsc --noEmit --pretty false`: pass.
- Customer geometry/selection/navigation subset: 3/3 pass.
- Hospital Order/audit geometry and behavior subset: 3/3 pass.
- Additional customer animal/guardian shared-slot assertion: pass.
- Full customer/hospital-admin run: 46/47 pass. The only failure was the
  unrelated vital-settings revert-button wait timing out; its isolated rerun
  passed 1/1.
- `npm run build`: pass with the existing NFT trace warning from
  `src/lib/prd-viewer/doc-reader.ts`.
- Desktop visual review at 1540x1024: customer guardian, hospital Order, and
  hospital audit surfaces pass with no overlap or unintended gap.
- Expected local mock-session API 401 console entries remain; no new runtime
  exception was observed.

## Broad-Suite Caveat

The fresh broad customer/hospital-admin run passed 46 of 47 tests. The only
failure was an unrelated vital-settings revert-button wait timing out after 30
seconds; the same test passed in 8.8 seconds when rerun in isolation. Focused
tests for this change pass consistently.

## Review Artifact

- `docs/completed/design-system/2026-07-27-table-content-top-slot-alignment-report.html`
