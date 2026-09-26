---
id: "DESIGN-SYSTEM-PR-100"
status: "active"
area: "design-system"
priority: "P1"
target_pr: "User-approved mockup / pinned boundary resize grip alignment"
created: "2026-09-26"
source_docs:
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-098-pinned-boundary-resize-indicator.md"
dependencies:
  - "DESIGN-SYSTEM-PR-098"
---

# Pinned Boundary Resize Grip Alignment

## Goal

Center the last left-pinned column's resize hit zone on the shared divider and
use the divider itself as the only resting visual affordance.

## Cause

The 8px hit zone is positioned with its right edge on the divider, leaving its
center 4px to the pinned side. Its hover fill also makes the off-center hit zone
look like a separate grab mark beside the divider.

## In Scope

- Center the 8px hit zone over the 1px divider for the last left-pinned header.
- Remove only the boundary handle's hover fill.
- Keep the resize cursor, pointer/touch behavior, keyboard focus ring, and
  active-drag feedback.
- Preserve the existing indicator and hover treatment on ordinary scrollable
  column handles.
- Add focused Plan/Order geometry and interaction regression coverage.

## Out Of Scope

- Column sizing limits, resize persistence, pinned offsets, or resize eligibility.
- Right-pinned boundary behavior or other table layout changes.
- Data, sorting, filtering, selection, API, DB, auth, or permission changes.

## Done Criteria

- The boundary hit-zone center matches the persistent divider center.
- Hovering the boundary hit zone does not add a background fill.
- Ordinary scroll-column handles retain visible hover feedback and resize.
- The boundary handle remains keyboard- and pointer-resizable.
- Focused Playwright, local release checks, Preview, and Release Check pass for
  the exact PR candidate.

## Verification

- `npx playwright test tests/chart-order-table-contract.spec.ts --grep "Plan/Order keeps the boundary line|Plan/Order scroll columns keep|Plan/Order boundary drag"`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Exact-candidate GitHub Release Check and Ready Vercel Preview.

## Local Result

- The 8px boundary hit zone is centered on the persistent divider and has no
  hover fill; ordinary scrolling handles keep their hover feedback.
- The three focused boundary, scrolling-column, and resize tests passed.
- The full spec had 15 passing tests and one unrelated timeout in the synthetic
  linked-adjustment editor test while waiting for its override POST response; an
  isolated rerun timed out at the same wait.
- Secret scan, docs links, UX-copy check, lint, TypeScript, production build,
  and `git diff --check` passed.
