---
id: "IMAGING-PR-001"
status: "done"
area: "imaging"
priority: "P1"
target_pr: "PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/reference-screen-index.md"
  - "docs/reference/imaging/imaging-workspace-wireframe.html"
dependencies: []
updated: "2026-05-06"
---

# Imaging Workspace Restructure

## Goal

영상검사 화면을 레퍼런스의 대기열, 환자 컨텍스트, 영상/차트 이력, 판독 상세, 종합소견 패널 흐름으로 재구성한다.

## PR Creation Gate

- Goal: 조제/처치형 App Shell 슬롯 구조에 맞춘 영상검사 workspace 개편.
- PR size: one imaging UI PR.
- Scope: imaging side panel date/view/status groups, patient context header, default-open imaging history aside, reading workspace, right panel 종합소견, session-only 판독 상태 action, focused tests, status docs.
- Out of scope: live API/DB persistence, real PACS integration, real file upload, rich text persistence, 조제/처치 changes.
- Done criteria: imaging route shows patient context bar, imaging history aside, order detail workspace, reading/comment fields, attachments, and right panel summary; Kong demo query still prioritizes Kong abdomen study.
- Source docs: current status, reference screen index, imaging wireframe.
- Verification: lint, TypeScript, build, lab/imaging/app-shell/sales demo Playwright, docs check, Browser Use visual check.
- Status/dependencies: in progress; no active dependency.
- Duplicate check: PR5 implemented baseline lab/imaging, and LAB-PR-001 explicitly excluded imaging restructuring.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/lab-imaging.spec.ts tests/app-shell.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- `npm run docs:check`

## Handoff Notes

Implemented. Use existing `components/emr/*` and shadcn/ui components first for follow-up refinements. Treat the chat-provided reference image as workflow and density guidance only because no binary imaging reference asset is stored under `docs/design/assets/reference-screens/imaging/`.
