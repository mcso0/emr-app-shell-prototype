---
id: CHART-PR-041
status: in_progress
area: chart
priority: P1
updated: 2026-09-26
source_docs:
  - docs/design/system/component-ownership-rules.md
  - docs/design/system/table-density-and-grid-ergonomics.md
  - docs/work/chart/CHART-PR-002-soap-order-scroll-boundary.md
  - docs/work/chart/CHART-PR-024-assessment-diagnosis-table-fidelity.md
  - docs/work/chart/CHART-PR-028-history-information-hierarchy.md
  - docs/work/chart/CHART-PR-038-plan-order-table-contract.md
---

# Chart Scrollbar Hover Reveal

## Goal

Show scrollbars on hover in the four chart regions marked by the user while
keeping the scrollable content and its geometry stable as the scrollbar fades
in and out.

## Scope

- Assessment diagnosis table native scrollbars.
- SOAP block editor native vertical scrollbar.
- Inline History panel Base UI scrollbar.
- Plan/Order pinned table Base UI scrollbars.
- Focused browser coverage for visibility and geometry before and after hover.

## Out Of Scope

- Other chart, customer, administration, or shared-table scroll regions.
- Scroll ownership, table columns, panel sizing, data, persistence, or APIs.
- Changes to the shared ScrollArea or pinned-table primitive's default behavior.

## Done Criteria

- All four scoped scrollbar thumbs use the shared `--emr-scrollbar-thumb` token.
- Fine-pointer users see each scoped scrollbar when its area is hovered.
- Keyboard focus also reveals the scoped scrollbar; coarse-pointer devices keep
  scrollbars visible without requiring hover.
- Reveal changes scrollbar paint/opacity only. Scroll-owner and viewport
  geometry remain unchanged.
- Existing scrolling remains available, including the empty Assessment table's
  narrow-width horizontal overflow.
- Reduced-motion settings disable reveal transitions.
- No scrollbar behavior changes in other components.

## Verification

- `npx playwright test tests/chart-scrollbar-reveal.spec.ts`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Exact-candidate `Release Check`, Ready Preview, and scoped Production smoke
  follow the release runbooks.

## Color Consistency Follow-up

- Use `--emr-scrollbar-thumb`, mapped to Clair Neutral 300, for the Assessment,
  SOAP, inline History, and Plan/Order scrollbar thumbs.
- Keep reveal visibility and scroll-owner geometry unchanged. Custom ScrollArea
  color overrides remain scoped to these chart regions.
- The focused browser regression asserts the same rendered thumb color across
  native and Base UI scrollbars.
- Release evidence for this follow-up is recorded below after candidate checks.

### Local verification

- Before the color fix, the focused browser regression reproduced the mismatch:
  History rendered `rgb(229, 229, 229)` instead of the shared target.
- After the fix, `npx playwright test tests/chart-scrollbar-reveal.spec.ts
  --reporter=line` passed. Assessment, SOAP, History, and Plan/Order all render
  `rgb(212, 212, 212)` on hover, with viewport geometry unchanged.
- `npm run security:secrets`, `npm run docs:check`, `git diff --check`, and
  `npx tsc --noEmit` passed.
- `npm run lint` passed with 0 errors and 5 warnings in untouched scripts.
- `npm run build` passed. Turbopack retained the existing PRD document-reader
  trace warning.

## Local Verification Results

- Focused browser regression: 3 passed, covering all four reveals, unchanged
  viewport geometry, empty Assessment state, diagnosis-table layout, and pinned
  Plan/Order scrolling.
- Secret scan, docs links, UX copy, diff check, TypeScript, production build,
  and ESLint completed. ESLint reported 0 errors and 5 warnings in untouched
  scripts. The build retains the existing PRD document-reader trace warning.
- No dependencies, data, API, persistence, or shared scrollbar defaults changed.

## Release Boundary

Production release requires the exact PR head SHA, successful candidate checks,
Preview evidence, smoke path, and rollback candidate before approval and merge.
The exact-candidate Preview and `Release Check`, Production approval, merge, and
smoke remain pending.
