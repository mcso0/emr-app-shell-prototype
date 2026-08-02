---
id: "DESIGN-SYSTEM-PR-089"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "User request / shared main-content header density"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
dependencies:
  - "DESIGN-SYSTEM-PR-085"
updated: "2026-08-02"
---

# Shared Main-Content Header Density

## Goal

Replace page-local top spacers with one shared `EmrMainContentHeader` contract
whose height is controlled by semantic tokens and one viewport-height media
query.

## Approved Decisions

- `home`, `reception`, `treatment`, `lab`, `imaging`, `dispensing`, `billing`,
  and `inpatient` always use a 56px main-content header.
- Every hospital-admin and customer-management page uses 44px only when the
  browser viewport is at least 1024px wide and at most 880px high; otherwise it
  uses 56px.
- Existing feature and page owners keep their state. Shell ownership,
  registration APIs, and route restructuring are not part of this work.
- Empty clinical selections keep the header frame instead of returning no
  frame.

## Follow-up correction (2026-08-01)

- Reception is the intentional exception to the empty shared-header rule: its
  feature-owned `ScheduleToolbar` is the effective 56px main-content header.
- The reception module must not register `FixedEmptyMainContentHeader`; the
  shared `data-slot="emr-main-content-header"` remains unchanged for modules
  that do not already own an equivalent top bar.

## Follow-up correction (2026-08-02)

- The adaptive compact-header breakpoint is now a viewport height of 880px:
  customer-management and hospital-admin pages use 44px at or below 880px
  when the viewport is at least 1024px wide, and 56px above that height.

## In Scope

- Shared component, fixed/adaptive tokens, and Storybook examples.
- Current top-level module registry adoption.
- Clinical selected and empty header states.
- Hospital-admin Order, membership, audit, settings, schedule, roles, vital,
  and space screens.
- Customer patient, guardian, and archive screens.
- Focused responsive geometry and existing workflow regression coverage.
- Canonical design guidance and a Korean HTML closeout report.

## Out Of Scope

- Shell layout, menu, side-panel, right-panel, drawer, route, or state-owner
  redesign.
- Data, API, Supabase, RLS, permission, persistence, or domain behavior.
- New dependencies, environment changes, or fixed staging alias changes.
- Changes to historical completion reports.

## Done Criteria

- Every current top-level module exposes exactly one effective main-content
  header; reception satisfies this with its feature-owned `ScheduleToolbar`
  rather than a `data-slot="emr-main-content-header"` element.
- Fixed headers compute to 56px at every verified viewport.
- Adaptive headers compute to 44px at `1440x800` and `1440x880`, and to 56px
  at `1440x881`, `1023x800`, and `1920x1080`.
- All ten hospital-admin sections and all three customer list modes use the
  adaptive contract without duplicate top spacing.
- Clinical headers remain 56px with and without selected context; billing no
  longer uses a local 48px header.
- Existing back navigation, dirty guards, filters, selection, tables, drawers,
  loading, empty, error, and permission behavior remains intact.
- Focused Playwright, secret, docs, copy, lint, typecheck, Storybook, and Next
  production-build gates pass.

## Release Boundary

The approved target is this PR's verified merge candidate on `main`, followed
by the repository's automatic Vercel Production deployment. Record the exact
candidate SHA, previous Production deployment, smoke paths, and rollback
candidate before merge. Stop on any failed gate or scope drift.

## Implementation

- Added a composition-only `EmrMainContentHeader` primitive with fixed and
  adaptive modes.
- Centralized the 56px/44px values and the adaptive viewport query in the EMR
  foundation tokens.
- Registered shared headers only where a module did not already own the
  effective top-bar surface, while retaining each feature's existing state and
  interaction ownership.
- Removed only the page-local top spacers superseded by the shared frame.
- Added Fixed, Adaptive, content, and empty Storybook examples.

## Verification

- Shared header Playwright matrix: 5/5 passed.
- Customer and hospital-admin regression suite: 57/57 passed.
- Representative clinical selection and empty-state suite: 9/9 passed.
- Secrets, docs, Korean UX copy, diff check, ESLint, TypeScript, Storybook
  build, and Next production build passed.
- The local Storybook server was not running, so the project MCP check was not
  applicable; the static Storybook build includes the new stories.

## Closeout

- `docs/completed/design-system/2026-07-29-main-content-header-density-report.html`
