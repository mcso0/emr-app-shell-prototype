---
id: "DESIGN-SYSTEM-PR-088"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "User request / customer and hospital-admin pinned identity table rollout"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md"
updated: "2026-07-29"
---

# Pinned Identity Table Rollout

## Goal

Roll the shared pinned-column surface out to customer patient, guardian, and
archive tables plus every hospital-admin Order leaf table. For selectable
tables, keep the selection column and the domain identity column fixed
together while aligning the identity label and row value to the workspace
title axis. Keep one horizontal scroll owner and use the shared whole-table
feedback surface whenever normal rows cannot be rendered.

## Approved Decisions

- Hospital-admin pins `표준 Order명`.
- Selectable customer and Order tables pin `select` first and the domain
  identity second.
- The customer animal list removes the leading avatar; the selection control
  occupies the space before the unchanged animal-name text axis.
- No-data, filtered-empty, read-error, and permission-denied states use the
  shared whole-table Empty State surface.
- Customer archive uses the existing archive GET/PATCH routes and includes
  restore, permission denial, and failure states.
- All 15 Order leaf screens are required for completion.
- Review units are shared contract, customer rollout, and Order rollout.

## In Scope

- Shared pinned workspace and identity text-axis primitives.
- Shared selection-column width and contextual row-selection visibility.
- Shared whole-table feedback surface.
- Shared 0px pinned-table workspace header padding-top.
- Customer patient, guardian, and deleted guardian/patient tables.
- Customer archive read, filter, retry, restore, permission, and failure UI.
- Hospital-admin Order renderer used by all leaf screens.
- Single `Table` container horizontal overflow ownership.

## Out Of Scope

- Hospital-admin audit, membership, role, schedule, vital, space, concept, or
  drawer-summary tables.
- New archive schema, migrations, hard deletion, or real customer data.
- New grid dependencies.
- Remote Supabase mutation or schema deployment.

## Done Criteria

- Every selectable in-scope table has an opaque pinned selection column and
  opaque pinned identity column in default, hover, selected, and loading
  states. The non-selectable archive table keeps its identity-only pin.
- Title, applicable search edge, pinned header text, pinned row identity text,
  and footer total use one exact local identity axis.
- Customer archive loads the existing soft-deleted list and restores through
  the target-specific existing mutation route.
- Read and mutation permission denial and retryable failures are visible.
- Terminal no-data, no-filter-results, read-error, and no-permission states
  replace the table body with the shared Empty State surface.
- All 15 Order leaf screens use the same `표준 Order명` pinned renderer.
- The shared table container is the only horizontal overflow owner.
- Focused behavior, responsive geometry, lint, typecheck, docs, secret scan,
  Storybook build, and Next build verification are recorded.

## Result

- `EmrPinnedTableWorkspace`, `EmrTableHeaderCell identity`,
  `EmrTableIdentityCellContent`, and `EmrTableFeedbackSurface` now own the
  cross-family identity axis and whole-table feedback boundary.
- Animal and guardian tables pin the 44px selection column plus their domain
  name column. The animal list no longer renders an avatar before the name.
  Title, header, row text, and footer total retain the same 48px local axis.
- Header selection stays visible; desktop row selection appears on hover,
  focus-within, or selected rows, while touch devices keep it available.
- The deleted guardian/patient table remains non-selectable and therefore pins
  only its display-name identity.
- The deleted screen reads the existing soft-deleted archive route, restores
  through the existing target-specific PATCH route, updates the archive count,
  and exposes loading, empty, filtered-empty, denied, retry, and restore-failure
  states.
- Every Order leaf uses the same renderer with selection as the physical first
  pinned column and `표준 Order명` as the second pinned identity column. The
  title/header/row identity axis is 48px.
- The Order table no longer uses an outer `ScrollArea`; the shared Table
  container is the sole horizontal table-overflow owner.
- Customer and Order no-data, filtered-empty, read-error, and denied states
  render through the shared whole-table feedback surface without stale rows.
- No schema, migration, new dependency, hard-delete behavior, drawer workflow,
  or production state changed.

## Verification

- Customer and archive Playwright suite: 20/20 passed.
- Hospital-admin Playwright suite: 37/37 passed.
- Shared Table Storybook interaction tests: 5/5 passed.
- Full ESLint, TypeScript, docs check (888 files), secret scan (3,485 tracked
  files), diff check, Storybook build, and Next production build passed.

Result report:

- `docs/completed/design-system/2026-07-29-selectable-pinned-identity-empty-state-correction-report.html`
