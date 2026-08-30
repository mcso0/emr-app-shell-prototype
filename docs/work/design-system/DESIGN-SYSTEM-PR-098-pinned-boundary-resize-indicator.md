---
id: "DESIGN-SYSTEM-PR-098"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "Browser comment / pinned boundary resize indicator visibility"
created: "2026-08-30"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
dependencies:
  - "DESIGN-SYSTEM-PR-096"
  - "DESIGN-SYSTEM-PR-097"
---

# Pinned Boundary Resize Indicator Visibility

## Goal

Keep the last left-pinned column resizable without drawing a second persistent
line beside the shared pinned-table divider.

## Cause

The pinned viewport already draws a permanent 1px boundary. The shared resize
button also drew its 1px pseudo-element at the same edge, so the fixed and
scrollable regions appeared to have a heavier double divider.

## In Scope

- Hide only the resize button pseudo-element on the last left-pinned header.
- Preserve the 8px resize hit zone, `col-resize` cursor, keyboard behavior, and
  pointer/touch handlers.
- Keep non-boundary resize indicators visible.
- Add shared Storybook and hospital-admin pointer regressions.

## Out Of Scope

- Pinned offsets, column sizing math, resize persistence, or dimmer behavior.
- Right-pinned boundary redesign or feature-local table conditions.
- Data, sorting, filtering, selection, API, DB, auth, or permission changes.

## Done Criteria

- The last left-pinned resize indicator is visually hidden.
- Its resize hit zone remains present and changes width during pointer drag.
- A scrollable data-column resize indicator remains visible and functional.
- Focused Storybook and Playwright regressions pass.
- Lint, TypeScript, build, docs, secret scan, and diff gates pass.

## Result

- `EmrTableHeaderCell` now derives the visual exception from the existing
  `pinned="left"` and `pinnedEdge` contract.
- Only the handle pseudo-element becomes transparent; the resize button and
  every existing interaction handler remain unchanged.
- The shared pinned divider remains the single persistent boundary line.

## Verification

- Storybook `EmrDataTable` stories: 25 passed, including pinned-boundary and
  ordinary scrolling grip visibility.
- Focused hospital-admin Playwright: passed, including live width changes for
  both the hidden boundary grip and visible scrolling grip.
- Full lint, TypeScript, production build, docs links, secret scan, and diff
  whitespace gates passed. The build retained the existing non-blocking Next.js
  NFT tracing warning for the docs reader.

## Completion Report

`docs/completed/design-system/2026-08-30-pinned-boundary-resize-indicator-report.html`
