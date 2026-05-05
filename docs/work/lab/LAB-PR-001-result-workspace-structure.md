---
id: "LAB-PR-001"
status: "done"
area: "lab"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/reference-screen-index.md"
  - "docs/reference/lab/lab-result-workspace-wireframe.html"
dependencies: []
updated: "2026-05-05"
---

# Lab Result Workspace Structure

## Goal

임상병리검사 화면을 조제/처치와 같은 shell 구조로 재구성해 검사 대기열, 환자 인포바, 검사이력, 결과지, 장비 수신내역을 한 화면 작업 흐름으로 정리한다.

## PR Creation Gate

- Goal: 조제/처치형 임상병리검사 workspace 구조.
- PR size: one lab UI PR, 영상검사 제외.
- Scope: lab module shell slots, patient context bar, default-open lab history aside, lab result document layout, result comment section, attachment controls, equipment receipt right panel, focused tests, status docs.
- Out of scope: live API/DB persistence, PDF generation, printing integration, equipment auto-match/merge, imaging screen restructuring, 조제/처치 changes.
- Done criteria: lab route shows patient context bar, lab history aside, result document, result input table, and receipt right panel; sales demo lab query still prioritizes Kong CBC.
- Source docs: current status, reference screen index, lab wireframe.
- Verification: lint, TypeScript, lab/imaging Playwright, app-shell and sales demo flow Playwright.
- Status/dependencies: done; no active dependency.
- Duplicate check: existing PR5 implemented lab/imaging baseline, not 조제/처치형 lab workspace structure.

## Verification

- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npx playwright test tests/lab-imaging.spec.ts --reporter=line` (`5 passed`)
- `npx playwright test tests/app-shell.spec.ts --reporter=line` (`18 passed`)
- `npx playwright test tests/sales-demo-flow.spec.ts --reporter=line` (`2 passed`)
- `npm run docs:check` (passed)

## Handoff Notes

Implemented. Preserve 영상검사 behavior. Treat equipment receipt actions as UI placeholders only. The lab receipt panel focuses the current-order linked result and shows a confirm dialog before mock result paste. The result table now reuses the shared `EmrOrderGroupSection` shell, follows the dispensing/treatment table density, removes the separate hematology subgroup row, and uses a compact value-positioned normal-range chart plus color-coded judgment badges instead of previous/equipment/memo columns. Lab attachments include add control plus PDF/image examples.

2026-05-05 follow-up: the lab side panel title is `임상병리검사`, reuses the shared `EmrDateNavigator` date picker pattern below the title, and the queue can switch between `오더별` and `차트별`. `오더별` preserves the existing card list; `차트별` groups lab result work items by encounter so a patient chart with multiple clinical pathology orders appears as one chart card with order count, status, abnormal count, and latest time.

2026-05-05 follow-up: the lab receipt right panel now reuses the shared `EmrDateNavigator` date picker pattern and list header actions from the order queue side panel without extra dividers. Receipt cards behave as Figma-aligned accordions and show a compact result preview table before mock paste actions. The receipt filter shortcut group was removed.

2026-05-05 follow-up: lab queue status groups now match the dispensing/treatment side panel collapse control and motion. The equipment receipt list header label is `검사 결과`, and receipt preview accordions animate open/closed with the same motion pattern.

2026-05-05 follow-up: the lab result paste confirmation now reuses the shared `EmrConfirmDialogContent` small confirm modal pattern extracted from the reception registration cancel confirmation.

2026-05-05 follow-up: extracted the side-panel status group header, accent bar, count, chevron rotation, and height/opacity collapse motion into shared `EmrSidePanelCollapsibleGroup`. The dispensing/treatment `EmrOrderQueueSidePanel` and lab order queue status groups now use the same scaffold while keeping their domain-specific card rows.

2026-05-05 follow-up: lab result inputs now derive the row judgment and normal-range marker from the current typed value, so editing a result immediately updates the color-coded badge and animates the marker to the matching position.

2026-05-05 follow-up: lab result judgment rows now show the assigned staff next to the judgment badge. The result document header also mirrors the dispensing/treatment local assignment flow: `담당하기` assigns the current lab staff and changes the action to `검사중`, with completion/cancel options in the split dropdown.

2026-05-05 follow-up: the lab 검사이력 content aside history groups now use the same height/opacity/y collapse motion and chevron rotation timing as the dispensing/treatment content-side history groups.

2026-05-05 follow-up: collapsed lab equipment receipt cards now use balanced vertical padding while preserving the tighter expanded-header spacing above the preview content.

2026-05-05 follow-up: lab/imaging short date-time display now uses `yy.mm.dd hh:mm` formatting across request, history, receipt, and imaging detail timestamps.
