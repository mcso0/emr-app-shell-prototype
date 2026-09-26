---
id: "DESIGN-SYSTEM-PR-102"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User-approved HTML comparison / clinical instruction title alignment"
created: "2026-09-27"
source_docs:
  - "docs/design/system/instruction-title-header.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/engineering/operations/release-environment-policy.md"
dependencies:
  - "DESIGN-SYSTEM-PR-089"
---

# Clinical Instruction Title Alignment

## Goal

Match the selected 조제/처치, 임상병리검사, and 영상검사 document title rows to
the chart title density shown in the user-approved local HTML comparison.

## In Scope

- Set the shared instruction title row, history icon, title, badge, and action
  gaps to the chart-derived sizes.
- Move PDF 다운로드 and 출력하기 into a ghost ellipsis menu after the assignment
  or status action in all three screens. Render both menu actions disabled.
- Keep 영상검사 PACS visible; retain existing 수행기록·이력 and status actions.
- Verify wide and narrow title layouts and the disabled menu state.
- Follow-up to the released title row: align the three content panes with the
  chart's top edge and 16px horizontal inset, including the information card,
  filters, result sections, and bottom breathing room.

## Out Of Scope

- History side-panel content or interaction, patient context, information
  fields, filter and table behavior, API, persistence, auth, permissions, or
  real PDF/print output.
- A new dependency or broad page-header redesign.

## Done Criteria

- All three title rows match the documented geometry without button overlap or
  horizontal overflow at the reviewed widths.
- The ellipsis menu opens by mouse and keyboard, and its PDF/print items are
  visibly disabled and cannot run output actions.
- 영상검사 PACS and the existing workflow actions remain available.
- Focused UI tests, lint, typecheck, build, docs, secret scan, and diff checks
  pass for the release candidate.
- The title begins at the content pane's top edge; the first card begins at the
  title's bottom edge. Cards, filters, and results share the 16px horizontal
  inset at both the wide reference viewport and the compact viewport.

## Release Boundary

The work branch and PR preview are the review candidate. A merge to `main`
is a production release and follows the repository's exact-candidate approval,
Release Check, smoke, and rollback gates.

## Local Verification

- Compared the three rendered headers with the approved HTML at wide and narrow
  layouts. The chart title remains the size reference; imaging keeps PACS visible.
- The focused browser checks cover row geometry, overflow, visible actions,
  disabled output items, and mouse/keyboard access to the ellipsis menu.
- Lint, TypeScript, build, documentation links, and the focused browser checks
  passed locally. The existing imaging assignment transition test fails at the
  same assertion on both this branch and the untouched `origin/main` baseline;
  it does not exercise the document title or output menu.
- Content-spacing follow-up: measured the released chart and all three document
  panes, then compared local mock screenshots at 2262×1254. The title starts at
  the same pane edge and 48px height; information cards start 16px inside the
  pane directly below it. The focused three-screen geometry and output-menu
  checks pass at 1303×870, along with TypeScript, lint, build, docs, and diff
  checks. The screenshots use synthetic mock data; no remote data or UI action
  was changed by this follow-up.
