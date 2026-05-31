---
id: DESIGN-SYSTEM-PR-041
status: human_review
area: design-system
priority: P0
target_pr: Project 17 / DEN-353
created: 2026-06-01
---

# DESIGN-SYSTEM-PR-041: CDS V2 Side Panel Status Title Icons

## Goal

Align module side-panel status group titles with the CDS V2 sidebar/list title components while preserving existing queue grouping and collapse behavior.

## Scope

- Add side-panel list title and state icon token aliases that map to existing CLAiR color, spacing, radius, and control-height tokens.
- Add reusable `EmrSidePanelStateIcon` variants that mirror the CDS V2 stateIcon component paths for done, in-progress, to-do, cancel, rework, and stop.
- Update the shared `EmrSidePanelCollapsibleGroup` title row to use the CDS V2 32px title rhythm, 16px state icon, neutral count text, and 24px collapse affordance.
- Add shared status tone resolution for common side-panel statuses such as 재요청, 진행중, 대기중, 완료, 취소, 호출, and 부분완료.
- Apply the new status icon title treatment to order queue side-panel groups.

## Figma References

- Sidebar component: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27286-70720&t=f9WcQkeeromZ4Bem-4
- List item title: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27311-27315&t=f9WcQkeeromZ4Bem-4
- State icon component: https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=27324-68014&t=f9WcQkeeromZ4Bem-4

## Out Of Scope

- Order queue task card hierarchy, selected state, metadata chips, and overflow behavior. These remain DEN-354.
- Patient information bar and document title bar work. These remain DEN-355.
- Content aside/history card layout. This remains DEN-356.
- Live auth, Supabase, server enforcement, or order table body changes.

## Acceptance Criteria

- Side-panel group titles render a leading reusable state icon for common statuses and keep the label, count, and collapse affordance readable.
- The title row uses token aliases for color, spacing, size, radius, and hover state; no one-off component hardcoding is introduced.
- Existing click and keyboard collapse/expand behavior remains unchanged.
- Focused app-shell regression coverage passes with typecheck and lint.

## Verification

- Passed: `npx tsc --noEmit`
- Passed: `npx playwright test tests/app-shell.spec.ts --project=chromium -g "order queue side panel renders status group titles|order queue status groups can collapse and expand"`
- Passed: `npx playwright test tests/app-shell.spec.ts --project=chromium`
- Passed with 5 pre-existing warnings: `npm run lint -- --ignore-pattern '.worktrees/**'`
- Passed: `npm run docs:check`
- Captured visual evidence: `docs/completed/design/evidence/2026-06-01-den-353-sidepanel-status-title.png`
