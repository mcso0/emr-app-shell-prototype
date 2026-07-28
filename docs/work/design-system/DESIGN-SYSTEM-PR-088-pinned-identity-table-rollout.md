---
id: "DESIGN-SYSTEM-PR-088"
status: "active"
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
