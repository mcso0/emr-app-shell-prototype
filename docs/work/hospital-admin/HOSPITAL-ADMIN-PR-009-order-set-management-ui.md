---
id: "HOSPITAL-ADMIN-PR-009"
status: "implemented"
area: "hospital-admin"
priority: "P0"
target_pr: "User-approved Order Set first-pass implementation"
source_docs:
  - "docs/work/hospital-admin/HOSPITAL-ADMIN-LIVE-PR-006-order-set-persistence.md"
  - "docs/product/demo-data/order-sets-and-templates-v1.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-001"
  - "HOSPITAL-ADMIN-LIVE-PR-006"
updated: "2026-08-25"
---

# Order Set Management UI

## Goal

Replace the read-only Order Set summary card with the same hospital-admin table
workspace and revision-aware editing flow used by individual Order management.

## Scope

- Adopt `EmrPinnedTableWorkspace`, `EmrTableWorkspaceHeader`, and
  `EmrDataTable` for Order Set search, filters, density, columns, selection,
  duplication, and row focus.
- Add a feature-local drawer for basic information, atomic and one-level nested
  composition, pricing and guidance, immutable revision history, and update
  review resolution.
- Preserve the existing list/detail/create/save/review API contracts, including
  idempotency and conditional request headers.
- Default the screen to active sets, while keeping existing inactive sets
  available through the all-status filter.

## Out Of Scope

- New schema or API fields, CSV import, or automatic workspace provisioning.
- Airtable, remote Supabase, production deployment, or the 400-order V4 data
  publication before the representative UI review checkpoint.
- Medication dosing, prescription recommendations, real hospital prices, or
  clinical decision support.

## Done Criteria

- The table matches the approved individual Order management page structure.
- Create, edit, duplicate, activation validation, nested composition, pricing,
  revision history, and review actions use the existing contracts.
- Focused lint, typecheck, contract tests, browser interaction checks, and
  desktop screenshots are available for representative review.
- No remote data or deployment state is changed before that review.

## Verification Checkpoint

- Focused Order Set UI scenarios: `2/2` passed.
- Definition, filtering, duplication, formatting, and read-boundary contract
  scenarios: `8/8` passed.
- Full ESLint, TypeScript, production build, Korean UX copy, docs links, and
  `git diff --check`: passed. The build retains one pre-existing Turbopack NFT
  trace warning from `next.config.mjs` and the PRD viewer.
- Manual local browser checks covered selection versus row focus, create
  defaults, all four drawer areas, atomic composition, fixed-price child billing
  default, and empty-active-set validation; browser warning/error log: empty.
- Review correction verified the row menu as a contextual hover/focus affordance
  without a visible `작업` header or a separately pinned right-column divider.
- Drawer review correction reduced the header to the create/edit title and close
  control. Basic, composition, pricing, and edit-only revision content now flow
  as continuous body sections without header subcopy or navigation tabs.
- Pinned table cells now use an opaque composed hover surface, preventing
  horizontally scrolled column text from showing through the fixed region.
- The broader `tests/hospital-admin.spec.ts` run completed `40/43`; the three
  failures are existing shared-header expectation drift (`56px` expected versus
  the current `44px`) in space, vital, and table geometry checks and are not
  caused by this Order Set slice.
- V4 live data now provides 20 active sets in each target workspace; Cheongdam
  preserves its four legacy inactive sets, so its all-status view contains 24.
- Production application deployment remains gated on the exact release SHA.
- Representative review screenshots:
  `order-set-management-v1-actions-corrected-hover.png` and
  `order-set-pinned-surface-opaque.png` and
  `order-set-drawer-header-simplified.png`.
