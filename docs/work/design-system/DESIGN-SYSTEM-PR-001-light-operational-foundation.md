---
id: "DESIGN-SYSTEM-PR-001"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/references/linear-app/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
dependencies: []
updated: "2026-05-10"
---

# Light Operational Foundation

## Goal

Add a small EMR operational token layer and apply it to shared panel/list/table foundations without introducing dark mode or screen-specific redesigns.

## PR Gate

- Goal: translate the Linear reference into a bright, quiet EMR operational foundation.
- PR-sized scope: design guidance, EMR CSS alias layer, global EMR utilities, shared subpanel/list/card/table surface updates, work/completion docs.
- Out of scope: dark mode, per-screen redesigns, primary brand replacement, Button overhaul, StatusBadge/status color redesign, live data/API/security work.
- Done criteria: app remains bright, shared panel/list/table surfaces use EMR aliases, selected/hover states remain clear, semantic status colors are preserved, focused tests pass.
- Source docs: current status, Linear design reference, new design-system foundation guidance.
- Verification: `npm run lint`, `npx tsc --noEmit`, focused Playwright suite, manual visual check on Home and dispensing routes.
- Status/dependencies: in progress; no external dependency.
- Duplicate check: no existing design-system work item covers this foundation pass.

## Scope

- Add `src/styles/tokens/emr-foundation.css` as a hand-authored alias layer above generated Clair tokens.
- Import the alias layer after the shadcn token bridge.
- Update `.emr-panel`, `.emr-hairline`, and add `.emr-selected-surface`.
- Apply the aliases to `EmrSubpanel`, `EmrListItem`, `EmrSidePanelCard`, and `EmrDataTable` surface, line, hover, and selected states.
- Add `.superpowers/` to `.gitignore` so visual brainstorming artifacts stay local.

## Out Of Scope

- Dark mode.
- Full visual redesign of Home, reception, chart, lab, imaging, billing, inpatient, customer, or hospital admin screens.
- Editing generated `src/styles/tokens/clair.css`.
- Reworking status badge tones or medical semantic colors.
- Creating CLAiR's canonical `DESIGN.md`; this follows after visual validation.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/app-shell.spec.ts tests/home.spec.ts tests/button-gallery.spec.ts --reporter=line`
- Manual visual check:
  - `/w/clair-demo/home?modulePanel=open`
  - `/w/clair-demo/dispensing?modulePanel=open&aside=closed`

## Completion Notes

Completed on 2026-05-10.

- Added the Light Operational Foundation design-system guidance.
- Added the hand-authored EMR token alias layer without editing generated Clair tokens.
- Updated shared EMR panel, list, side-panel card, and dense table surfaces to use the alias layer.
- Kept dark mode, primary brand replacement, and status badge tone redesign out of scope.
- Added `.superpowers/` to `.gitignore` so visual brainstorming artifacts stay local.
