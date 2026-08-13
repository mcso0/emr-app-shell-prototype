---
id: "CHART-PR-020"
status: "implemented"
area: "chart"
priority: "P1"
target_pr: "User request / collapsible S/O, Assessment, and History panels"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/work/chart/CHART-PR-019-figma-exact-chart-screen.md"
dependencies:
  - "CHART-PR-019"
result_report: "docs/completed/chart/2026-08-13-chart-collapsible-clinical-panels-report.html"
updated: "2026-08-13"
---

# Collapsible Clinical Chart Panels

## Goal

Allow S/O, Assessment, and History to collapse independently into a persistent 46px vertical rail, following Figma node `27985:64631`, while preserving the chart workspace, editing, persistence, encounter-selection, and URL contracts delivered by CHART-PR-019.

## Scope

- Add a chart feature-local collapsible panel group for S/O, Assessment, and History.
- Keep all three clinical panels expanded by default and keep their local collapse state independent from the existing shell-level `aside=history|closed` chart-history panel.
- Show the collapse action on panel hover, keyboard focus, and non-hover/coarse-pointer environments.
- Keep panel children mounted while collapsed so SOAP editor and diagnosis state are not reset.
- Preserve the 8px group gap, 46px collapsed rail, existing chart panel surfaces, and reduced-motion behavior.
- Add focused Playwright coverage for geometry, disclosure state, keyboard access, shell-aside independence, and mounted editor state.

## Out Of Scope

- Schema, API, Supabase, RLS, permission, persistence, billing, or consultation workflow changes.
- New shared EMR or shell primitives.
- Persisting S/O or Assessment collapse state across sessions.
- Changing Plan/Order resize or scroll contracts.
- Fixed-staging alias changes, environment/secret changes, schema changes, or live-data operations. The later user-authorized direct-main release request is handled through the repository production gate without broadening the feature scope.

## Done Criteria

1. Each clinical panel can collapse and expand independently, including an all-collapsed state.
2. A collapsed panel renders a 46px vertical rail with an accessible expand button and correct label.
3. Collapse controls use native buttons with `aria-expanded` and `aria-controls`, and are available through pointer and keyboard navigation.
4. Collapsing S/O does not unmount or reset its editor state.
5. Inline History collapse and expansion do not open or close the separate shell-level chart-history aside or change its existing URL contract.
6. Existing chart, Order, responsive, and reduced-motion behavior remains intact.

## Verification Plan

- Focused ESLint and TypeScript checks for the chart component, module, tests, and work item.
- Focused Playwright coverage for collapse/expand, keyboard, URL state, mounted editor state, exact 46px/8px geometry, narrow overflow, and reduced motion.
- Existing CHART-PR-019 chart workspace and Figma geometry tests.
- `npm run docs:check`, `npm run security:secrets`, and `git diff --check`.

## Implementation

- Added a chart-local `ChartCollapsiblePanelGroup` and `ChartCollapsiblePanel` composition. Expanded tracks stay fluid, while each collapsed track becomes a persistent 46px rail with a vertical title and expand control.
- Added hover, focus-within, non-hover, and coarse-pointer disclosure for the collapse controls. Native button semantics, `aria-expanded`, `aria-controls`, `inert`, reduced-motion handling, and focus handoff are included.
- Kept all three panel children mounted while collapsed and used local UI state for the inline panels. The separate shell-level chart-history aside continues to own `aside=history|closed`, preserving the newer CHART-PR-019 follow-up contract without coupling two History surfaces.
- Kept the component feature-local instead of adding a shared design-system primitive before a second caller exists.
- Updated chart and app-shell coverage for the new default History rail and the existing all-open Figma visual fixture.

## Verification

- Feature-focused collapse, Figma geometry, History ownership, and responsive checks passed on a fresh Playwright web server. The full latest-main chart run passed 36/37; the remaining SOAP-tab menu timeout reproduced unchanged on a clean `origin/main` worktree and is recorded as a pre-existing timing baseline rather than a collapse regression.
- Focused app-shell regression: legacy chart routing, treatment queue rendering with inline History collapse, and shell-level topbar history controls passed.
- Collapse coverage verifies independent/all-collapsed states, 46px rails, 8px gaps, hover disclosure, sequential keyboard reachability, focus handoff, mounted panel content, local Assessment search-state preservation, reduced motion, shell-aside independence, and no group overflow with three open panels at a 1280px viewport.
- Manual browser inspection passed at `1622 × 1086` and `900 × 650`, including the Figma-focused S/O-expanded plus Assessment/History-collapsed composition.
- Repository ESLint, TypeScript, production build, docs link check, secret scan, and diff check passed.

## Remaining Review Boundary

- All three inline panel collapse states intentionally reset on a full reload. The separate shell-level History aside retains its existing URL-backed state.
- No API, schema, permission, billing, consultation, or Plan/Order behavior changed.
- The feature is ready for the separately requested commit, PR, and direct-main production gate. Release completion still requires an exact candidate `Release Check`, Preview readiness, merged `origin/main` evidence, Vercel Ready status, scoped production smoke, and a recorded rollback candidate.
