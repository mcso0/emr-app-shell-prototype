---
id: "DESIGN-SYSTEM-PR-088"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "User request / customer and hospital-admin pinned identity table rollout"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-087-shared-table-pinning-surface.md"
updated: "2026-07-28"
---

# Pinned Identity Table Rollout

## Goal

Roll the shared pinned-column surface out to customer patient, guardian, and
archive tables plus every hospital-admin Order leaf table. Align each pinned
identity label and row value to its owning workspace header axis and keep one
horizontal scroll owner.

## Approved Decisions

- Hospital-admin pins `표준 Order명`.
- Customer archive uses the existing archive GET/PATCH routes and includes
  restore, permission denial, and failure states.
- All 15 Order leaf screens are required for completion.
- Review units are shared contract, customer rollout, and Order rollout.

## In Scope

- Shared pinned workspace and identity text-axis primitives.
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
- Push, PR, merge, remote Supabase mutation, or deployment.

## Done Criteria

- Every in-scope table has one opaque pinned identity column in default,
  hover, selected, and loading states.
- Title, applicable search edge, pinned header text, pinned row identity text,
  and footer total use one exact local identity axis.
- Customer archive loads the existing soft-deleted list and restores through
  the target-specific existing mutation route.
- Read and mutation permission denial and retryable failures are visible.
- All 15 Order leaf screens use the same `표준 Order명` pinned renderer.
- The shared table container is the only horizontal overflow owner.
- Focused behavior, responsive geometry, lint, typecheck, docs, secret scan,
  Storybook build, and Next build verification are recorded.

## Result

- `EmrPinnedTableWorkspace`, `EmrTableHeaderCell identity`, and
  `EmrTableIdentityCellContent` now own the cross-family identity axis,
  including the 0px workspace-header top inset.
- Animal, guardian, and deleted guardian/patient tables use one opaque pinned
  identity column. Their title, search, header, row text, and footer total use
  the same 48px local axis.
- The deleted screen reads the existing soft-deleted archive route, restores
  through the existing target-specific PATCH route, updates the archive count,
  and exposes loading, empty, filtered-empty, denied, retry, and restore-failure
  states.
- Every Order leaf uses the same renderer with `표준 Order명` as the physical
  first pinned column and a 20px title/header/row identity axis.
- The Order table no longer uses an outer `ScrollArea`; the shared Table
  container is the sole horizontal table-overflow owner.
- No schema, migration, new dependency, hard-delete behavior, drawer workflow,
  or production state changed.

## Verification

- Shared Table Storybook interaction tests: 5/5 passed.
- Customer and archive Playwright suites: 23/23 passed.
- Hospital-admin Playwright suite: all 33 unaffected/Order tests passed; the
  pre-existing vital-settings test timed out in the full run and passed
  immediately when rerun alone. The same isolated timeout remained when the
  full-suite timeout was increased to 60 seconds.
- Full ESLint, TypeScript, docs check (888 files), secret scan (3,485 tracked
  files), diff check, Storybook build, and Next production build passed.

Result report:

- `docs/completed/design-system/2026-07-28-pinned-identity-table-rollout-report.html`
