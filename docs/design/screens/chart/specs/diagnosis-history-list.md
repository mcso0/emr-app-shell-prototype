---
type: "screen-spec"
title: "History compact diagnosis rows"
description: "Approved single-line history layout, adaptive diagnosis badges, hover action, search emphasis and tooltip contract"
tags: ["chart", "history", "diagnosis", "design-system"]
status: "approved"
last_updated: "2026-09-08"
---

# History Compact Diagnosis Rows

## Decision and Scope

This replaces the earlier B layout after the user reviewed the Figma frame and an interactive HTML prototype, refined overflow/hover behavior, and approved implementation plus commit/push/PR/merge to `origin/main`.

- Design source: [Figma 28308:107517](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28308-107517).
- Change only inline History presentation and its toolbar. Preserve the separate chart-history aside.
- Keep the live encounter set/order, active-encounter exclusion, diagnosis/veterinarian search, current URL/queue, historical read-only mode and draft-save-before-switch behavior.
- No schema/API/permission/provider/data writes or new dependencies.

## Geometry and Data

- Preserve responsive panel sizing; the source frame is 305 by 452px, not a fixed app panel size. Reserve a minimum 305px History track when expanded and 240px for the other clinical panels so the wider History does not squeeze them; use the existing panel-group horizontal scrolling when space is insufficient. The existing below-1180px 360px tracks remain unchanged.
- Header 38px; toolbar 44px with 12px horizontal and 8px vertical inset. Keep `History` rather than the source typo `Histroy`.
- Toolbar controls are 28px tall, with 10px gaps: 79px diagnosis selector, flexible `키워드 입력`, 1 by 18px divider, 58px disabled filter. Filtering options remain unimplemented.
- List inset: 12px horizontal, 8px top. One encounter per 40px row with 8px inner padding and 8px radius. Adjacent rows repeat every 45px: 2px space, 1px separator, 2px space. Include the final separator.
- Date group: 12px calendar icon, 4px gap and `YY.MM.DD` date, total 68px. Use the existing checked-in/created-at fallback and date formatting. Same-day encounters remain separate rows.
- The diagnosis area begins 13px after the date group. Badges are 24px high with 6px horizontal/4px vertical inset, 6px radius, 6px gap, 12px/16px medium text and black-alpha-4 background.
- Do not show time, veterinarian, status or encounter number in each inline row. Keep those authoritative fields available in the existing chart/aside and retain veterinarian query matching.
- No diagnoses: `진단 기록 없음`; do not manufacture a diagnosis from SOAP text.

## Hover and Overflow

- Row backgrounds have only default and hover states. No selected/focus row fill or sticky first-row highlight.
- Hover exposes a 66 by 24px `차트 보기` button on the right. Match Assessment's overlay approach: opaque hover-surface behind the action with a short transparent gradient edge.
- Reserve action space before fitting diagnoses. Recalculate visible badges and the hidden count when hover changes; `+N` stays immediately after the last visible badge, never pinned to the far edge or covered by the action.
- Measure intrinsic text widths using the actual font, emphasis, padding and count digits. Observe container/font size changes.
- Always retain at least the first diagnosis. Ellipsize a long first badge while keeping the count and action accessible; its full name is available through the existing Tooltip component.
- `+N` counts all currently hidden names, including badges hidden by action reservation. It opens a read-only tooltip, not inline expansion or a modal.
- Tooltip content remains reachable on pointer transfer, can scroll within a bounded height, and supports keyboard focus/Escape and touch activation. Keep the reserved layout stable while its tooltip is open.
- Keyboard focus reveals the action without adding row selection styling. Touch/coarse-pointer devices reserve and show the action without requiring hover.

## Search and States

- Search includes every original diagnosis and the existing veterinarian field.
- In a matched encounter, display matching diagnoses first while preserving order within matching/nonmatching groups. Never mutate server data or imply clinical primary-diagnosis status.
- Emphasize only literal matching substrings with bold text, in visible badges and tooltip names. Trim query whitespace and retain case-insensitive matching; never insert clinical strings as HTML.
- Clear search restores original diagnosis display order and normal text weight.
- Keep shared `EmrEmptyState` for no history/no results and existing loading, permission/error and retry handling.

## Ownership and Verification

- UI: `ChartDiagnosisHistoryItem` with feature-local CSS; `ChartInlineHistoryPanel` owns toolbar/search/state presentation.
- Shared primitives: existing Badge, Button, Tooltip, EmptyState, Input and Select. No shared primitive/token behavior changes.
- Data: existing chart history projection and permission boundaries.
- Acceptance: zero/one/many/long names, actual width fit, hover entry/exit, hidden-count accuracy, tooltip transfer, matched-name promotion/emphasis, keyboard/touch action access, same-day rows, empty/error states and saved-draft/history guards.
- Work and release evidence: [CHART-PR-028](../../../../work/chart/CHART-PR-028-history-information-hierarchy.md).
