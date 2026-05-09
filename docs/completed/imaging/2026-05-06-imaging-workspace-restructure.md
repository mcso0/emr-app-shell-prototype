---
id: "IMAGING-CLOSEOUT-2026-05-06"
status: "done"
area: "imaging"
doc_type: "closeout"
related_work:
  - "docs/work/imaging/IMAGING-PR-001-workspace-restructure.md"
completed: "2026-05-06"
---

# Imaging Workspace Restructure Closeout

## Result

영상검사 화면을 App Shell 슬롯 구조로 재구성했다. 화면은 영상 대기열, 환자 컨텍스트 header, 기본 열림 영상/차트 이력 aside, 중앙 판독 상세 workspace, 우측 종합소견 패널로 구성된다.

## Scope Completed

- 레퍼런스 기반 HTML 와이어프레임 추가.
- 오더별/차트별 영상 대기열, 날짜 네비게이터, 접힘 가능한 상태 그룹 추가.
- 환자 컨텍스트 bar, 영상 이력 aside, Order 상세정보 table, PACS mock action, 판독의견/진단/권고 입력 영역 추가.
- 우측 종합소견 panel에 같은 차트 내 검사/영상 오더, 보호자 공유 코멘트, 미디어 thumbnail, 첨부 파일 list, 저장/취소 footer 추가.
- `담당하기 -> 판독중 -> 판독완료` session-only 상태 action 추가.

## Verification

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npx playwright test tests/lab-imaging.spec.ts --reporter=line` passed (`5 passed`).
- `npx playwright test tests/app-shell.spec.ts --reporter=line` passed (`19 passed`).
- `npx playwright test tests/sales-demo-flow.spec.ts --reporter=line` passed (`2 passed`).
- `npm run docs:check` passed.
- Browser Use visual check opened the HTML wireframe and local 영상검사 workspace; mobile viewport screenshot check confirmed the Order 상세정보 table no longer overlaps text and scrolls horizontally on narrow width.
