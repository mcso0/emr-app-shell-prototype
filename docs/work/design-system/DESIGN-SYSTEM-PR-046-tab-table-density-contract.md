---
id: "DESIGN-SYSTEM-PR-046"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 공통 UX/UI 기준 정리 및 화면 적용 / DEN-435"
linear: "DEN-435"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
updated: "2026-06-06"
---

# Tab And Table Density UX Contract

## Goal

Define shared UX criteria for `Tab UX/UI` and `Table Density`, including whether density should use a dropdown.

## Scope

- Classify tab-like controls into workspace tabs, section tabs, subsection tabs, segmented modes, filters, and density controls.
- Define when a tab is navigation, when it is a section switch, and when a similar-looking control should be a filter or segmented control instead.
- Preserve the existing `compact`, `standard`, and `comfortable` density modes.
- Decide when density stays as the current icon segmented selector and when a dropdown is acceptable.
- Document responsive, overflow, accessibility, and ownership guardrails for follow-up screen issues.

## Out Of Scope

- App code implementation.
- Immediate replacement of all table components.
- New data-grid library adoption.
- DB/API query, sort, filter, or server contract changes.
- Live Supabase, migrations, RLS, server enforcement, production deploy, or real data access.

## Implementation Notes

- The main contract lives in `docs/design/system/tab-table-density-contract.md`.
- `docs/design/system/table-density-and-grid-ergonomics.md` records the DEN-435 density dropdown decision as an addendum to the existing table density contract.
- `docs/design/system/DESIGN.md` and `docs/design/system/README.md` now link the contract from the design-system overview.
- The current branch does not contain the DEN-433/DEN-434 source files referenced by Linear comments, so DEN-435 preserves their approved Linear-level conclusions without depending on missing local paths.

## Verification

- `npm run docs:check`

## Handoff Notes

Accepted for follow-up implementation.

Follow-up implementation issues should classify each touched tab-like control before changing UI, keep density presentation-only, and use density dropdowns only when toolbar constraints justify the extra click.

DEN-436-specific accepted direction:

- Keep `전체`, `예약`, and `외래` as quick scope shortcuts.
- Put detailed status, assignee, urgency, elapsed-time, and note conditions in the queue filter control.
- Keep sort visibly exposed in the queue toolbar.
- Put queue density under `표시 옵션`.
- TASK card overflow controls open a contextual dropdown first; the dropdown action list should later be formalized as a task/order action matrix.
