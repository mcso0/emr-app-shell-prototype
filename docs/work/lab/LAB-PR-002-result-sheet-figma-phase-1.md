---
id: "LAB-PR-002"
status: "human_review"
area: "lab"
priority: "P1"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/work/lab/LAB-PR-001-result-workspace-structure.md"
  - "Figma nodes 28532:130886 and 28532:132710"
dependencies: []
updated: "2026-09-27"
---

# Lab Result Sheet Figma Phase 1

## Goal

Apply the approved result table and primary result input layout to the existing 임상병리검사 screen while preserving its live result save, profile evaluation, and retest contracts.

## Scope

- Six result columns: 항목, 결과값, 단위, 정상범위, 판정, 담당자.
- One primary input per row. Keep coded choices sourced from the frozen result profile. Put numeric qualifier, instrument no-result state, and device flag in the row's additional-info popover.
- Keep numeric normal-range visualization only when a valid range and judged numeric value exist. Keep the existing result save and atomic retest flows.
- Show 수정이력 and 차트에 복사하기 as disabled until their product behavior is defined.

## Out Of Scope

- 검사 소견 and 첨부 UI, interactions, storage, upload, delete, and viewer changes. These are a separate next phase; preserve the current screen sections for now.
- API, schema, permission, shared-component, or new dependency changes.
- Data migration and API changes.

## Done Criteria And Verification

- Existing lab result entry renders six headers and one primary value control per row.
- Frozen numeric profile values, qualifier save/reload, and retest still work.
- The additional-info popover supports keyboard Escape and restores focus.
- TypeScript, focused lint, and lab Playwright checks pass.

Local candidate verification: `npm run security:secrets`, `npm run docs:check`, `npm run ux-copy:check`, `npm run lint` (0 errors; 5 warnings in unrelated scripts), `npx tsc --noEmit --pretty false`, `npm run build`, `git diff --check`, and two focused Chromium checks for the result sheet and CBC persisted result/retest passed. The change is limited to the result table and its existing save/retest interactions. Exact remote Release Check and Preview evidence belong to the phase 1 pull request.

## Handoff

Phase 2 starts with a separate 소견/첨부 scope and its persistence, authorization, upload/delete, loading, scroll fade, and viewer contracts. Do not treat this phase 1 UI as approval for those changes.
