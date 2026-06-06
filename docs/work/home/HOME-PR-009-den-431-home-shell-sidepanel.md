---
id: "HOME-PR-009"
status: "human_review"
area: "home"
priority: "P0"
target_pr: "Project 17 / DEN-431"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/home/HOME-PR-004-den-411-home-unified-workspace.md"
  - "docs/work/home/HOME-PR-008-den-430-home-workspace-frame-alignment.md"
dependencies:
  - "HOME-PR-004"
  - "HOME-PR-008"
updated: "2026-06-05"
---

# DEN-431 Home Shell Side Panel Adoption

## Goal

Move the Home hospital-status side panel out of the Home content area and into the shared shell `sidePanel` slot so it follows the same frame, gutter, and collapse behavior as Reception.

## Scope

- Register a Home `sidePanel` in the module registry.
- Split the Home side panel from `HomeKanbanWorkspace`.
- Reuse `EmrSubpanel`, `EmrSubpanelTitle`, `EmrSubpanelBody`, and shared EMR side-panel card primitives.
- Wire the hover collapse button with `setModulePanelOpen(false)`.
- Share selected task/detail state between the shell side panel and Home main content.

## Out Of Scope

- URL or module id changes.
- Live data, Supabase, RLS, or server enforcement.
- Home task mutation behavior.
- Global shell behavior changes.

## Done Criteria

- Home side panel renders through the shared shell module side-panel slot.
- Home side panel has the same hover collapse affordance as Reception.
- Home main content no longer contains a custom left side panel.
- Selecting tasks from side panel or Kanban still opens the non-modal right detail panel.
- Focused Home regression tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts --reporter=line`
- Browser visual QA on `/w/clair-demo/home?modulePanel=open`.

## Completion Notes

Handed to human review on 2026-06-05.

- Registered Home as a real shell `sidePanel` module.
- Moved the Home hospital-status panel out of `HomeKanbanWorkspace`.
- Reused `EmrSubpanel`, `EmrSubpanelTitle`, `EmrSubpanelBody`, and shared side-panel cards.
- Added a Home workspace store so shell side panel and main Kanban share selected task/detail state.
- Added regression coverage for shell module-panel placement, gutter, and hover collapse behavior.
