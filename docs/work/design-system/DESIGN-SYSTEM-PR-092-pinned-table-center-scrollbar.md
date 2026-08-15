---
id: "DESIGN-SYSTEM-PR-092"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "Browser comment / pinned-table center-only horizontal scrollbar"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/component-ownership-rules.md"
dependencies:
  - "DESIGN-SYSTEM-PR-088"
updated: "2026-08-15"
---

# Pinned Table Center-Only Horizontal Scrollbar

## Goal

Keep one scroll owner for shared pinned `EmrDataTable` surfaces while showing
the horizontal scrollbar only below the non-pinned center columns.

## In Scope

- Shared pinned `EmrDataTable` viewport and low-level table container API.
- Existing shadcn/Base UI Scroll Area primitives already installed in the repo.
- Plan/Order, customer-management, and hospital-admin Order regression checks.
- Canonical pinned-table overflow guidance.

## Out Of Scope

- New grid or scrollbar dependencies.
- Column meaning, sizing, sorting, filtering, selection, data, or persistence.
- Non-pinned tables, profile-panel scroll behavior, and feature-local redesigns.
- Fixed staging alias, environment, secret, or Supabase changes.

## Done Criteria

- Pinned tables have exactly one horizontal scroll owner.
- Native scrollbar painting is hidden and the shared horizontal scrollbar track
  starts after the left pinned width and ends before the right pinned width.
- Wheel, track, and programmatic scrolling keep pinned cells fixed.
- Plan/Order and customer geometry regressions prove the left track boundary.
- Focused Playwright, lint, TypeScript, docs, secrets, diff, and build gates pass.

## Release Boundary

The work branch may create a PR Preview. A `main` merge remains a production
release action and must use the exact candidate SHA, verification evidence,
rollback candidate, smoke path, and explicit production approval required by
the repository release policy.

## Result

- Reused the installed Base UI-backed shadcn `ScrollArea` primitives inside the
  shared pinned viewport; no dependency was added.
- Moved overflow ownership from the nested native table container to one shared
  viewport and limited the horizontal track to the non-pinned center width.
- Preserved left/right pinned cell geometry, table semantics, and existing
  sorting, selection, density, and data contracts.

## Verification

- Focused Storybook interaction tests: 7 passed.
- Focused Plan/Order, customer-management, and hospital-admin Playwright
  regressions: passed.
- Manual Storybook geometry: left gap `224px`, right gap `72px`, table container
  overflow `visible`, shared viewport overflow `scroll`.
- Result report:
  `docs/completed/design-system/2026-08-15-pinned-table-center-scrollbar-report.html`.
