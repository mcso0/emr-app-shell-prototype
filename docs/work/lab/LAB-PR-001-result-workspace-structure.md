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

Implemented. Preserve 영상검사 behavior. Treat equipment receipt actions as UI placeholders only. The lab receipt panel separates current-order linked results from all hospital equipment results and shows a confirm dialog before mock result paste. The result table now uses a compact normal-range bar instead of previous/equipment/memo columns, and lab attachments include add control plus PDF/image examples.
