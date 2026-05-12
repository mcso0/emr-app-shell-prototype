---
id: CHART-PR-006
status: done
area: chart
priority: P1
target_pr: PR 6
source_docs:
  - docs/engineering/current-status.md
  - docs/work/chart/CHART-PR-001-workspace-restructure.md
  - docs/work/chart/CHART-PR-002-soap-order-scroll-boundary.md
dependencies:
  - CHART-PR-001
  - CHART-PR-002
  - CHART-PR-005
updated: 2026-05-13
---

# SOAP Editor UX Foundation

## Goal

Improve the treatment chart SOAP editor while keeping the existing Tiptap foundation and session-only prototype boundary.

## Scope

- Keep Tiptap as the editor engine.
- Preserve SOAP as structured `Subjective`, `Objective`, `Assessment`, and `Plan` fields instead of rendering editable labels inside one rich-text document.
- Replace the browser prompt-based link action with an inline popover.
- Add basic authoring toolbar actions for active SOAP fields: undo, redo, bold, italic, underline, bullet list, numbered list, and link.
- Keep SOAP attachments outside the rich-text body.
- Add focused chart regression coverage for the structured SOAP editor and link popover.

## Out Of Scope

- Replacing Tiptap with another editor engine.
- Live persistence, audit logging, autosave behavior, or server validation.
- Full template/snippet library, medical macro expansion, or order recommendation automation.
- Rich document export or external editor integrations.

## Done When

- SOAP labels are stable UI labels, not editable document text.
- Existing SOAP content still renders for the selected chart.
- Link editing no longer uses `window.prompt`.
- Chart layout and order visibility regression tests continue to pass.

## Verification

- `npx tsc --noEmit`
- `npx eslint src/features/chart/module.tsx tests/chart.spec.ts`
- `npx playwright test tests/chart.spec.ts --reporter=line`

## Handoff Notes

This is a UX foundation pass, not a full medical note authoring system. The next useful unit is a SOAP template/snippet picker and keyboard shortcut pass, still within the Tiptap engine.
