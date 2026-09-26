---
id: "DESIGN-SYSTEM-PR-101"
status: "in_progress"
area: "design-system"
priority: "P1"
target_pr: "User request / follow-up to merged PR #825"
created: "2026-09-26"
source_docs:
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-100-pinned-boundary-resize-grip-alignment.md"
dependencies:
  - "DESIGN-SYSTEM-PR-100"
---

# Pinned Boundary Resize Interaction States

## Goal

Use the persistent pinned divider as the only pointer-visible resize affordance
while keeping keyboard focus visible on the related header content.

## Cause

The previous boundary change removed its hover fill but retained the resize
button's focus ring and active-drag fill. Those states draw a separate pill-like
mark around the divider that already acts as the grab target.

## In Scope

- Remove the pinned boundary handle's hover fill, active-drag fill, and local
  focus ring.
- Show `:focus-visible` on the pinned header content when its resize control is
  keyboard-focused.
- Keep the boundary cursor, pointer/touch resize, and keyboard resize behavior.
- Preserve ordinary scrolling-column resize indicators, hover, focus, and drag
  feedback.
- Add focused Plan/Order checks for hover, active drag, focus placement, and
  keyboard resizing.
- Update the table UX contract and this work record.

## Out Of Scope

- Column sizing limits, resize persistence, pinned offsets, or resize eligibility.
- Right-pinned boundary behavior or unrelated table layout changes.
- Data, sorting, filtering, selection, API, DB, auth, or permission changes.

## Done Criteria

- Hovering or dragging the boundary does not add visible fill or a separate
  handle marker around the divider.
- Keyboard focus remains visible on the header content and does not outline the
  divider hit zone.
- Pointer and keyboard resizing still change only the intended column.
- Ordinary scrolling-column handles retain their current visual and interaction
  states.
- Focused Playwright, local release checks, Preview, and exact-candidate Release
  Check pass.

## Verification

- `npx playwright test tests/chart-order-table-contract.spec.ts --grep "Plan/Order keeps the boundary line|Plan/Order scroll columns keep|Plan/Order boundary drag"`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Ready Preview and manually dispatched Release Check for the exact candidate.
