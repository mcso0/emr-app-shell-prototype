---
id: CHART-CLOSEOUT-2026-05-05-SOAP-ORDER-SCROLL-BOUNDARY
status: completed
area: chart
work_item: CHART-PR-002
completed_at: 2026-05-05
---

# SOAP Order Scroll Boundary Closeout

## Result

진료(차트) 화면에서 SOAP가 늘어나도 처방/오더 영역이 화면 아래로 밀려 사라지지 않도록 스크롤 경계를 분리했다.

## Notes

- 차트 본문은 SOAP/진단 상단 영역과 처방/오더 하단 영역이 남은 높이를 나눠 쓰도록 변경했다.
- SOAP와 진단명 패널은 각각 내부 스크롤을 가진다.
- 처방/오더 패널은 하단 영역 안에서 자체 table scroll과 기존 order footer를 유지한다.
- 좁은 viewport에서 차트 이력/우측 패널이 함께 열려도 SOAP, 진단, 오더 컨트롤이 겹치지 않도록 최소 높이와 grid column 최소폭을 조정했다.
- 차트 정보와 SOAP/진단 영역 사이, SOAP/진단 영역과 처방/오더 영역 사이에 divider를 추가했다.
- SOAP/진단 영역과 처방/오더 영역 사이 divider는 grabber로 변경해 상하 영역 높이를 조절할 수 있게 했고, 양쪽 영역에 최소 높이를 둔다.
- Grabber는 pointer id를 추적하고 pointerup/cancel/blur 종료 경로를 처리해, 포인터 포커스가 끊겨도 계속 resize 상태로 남지 않는다.
- 처방/오더 본문은 그룹 카드 나열 대신 그룹명을 컬럼으로 가진 compact table로 변경했다.
- compact table 맨 앞에 개별 오더 선택 checkbox와 전체 선택 checkbox를 추가했고, 하단 선택 오더 합계가 선택 상태를 반영한다.
- 오더 checkbox는 기본 미선택 상태로 시작한다.
- 진료 기록, 진단명, 처방/오더 헤더는 한 줄에 유지하되 보조 설명은 더 작고 옅은 subtitle로 표시한다.
- 처방/오더 action footer의 파란 배경과 primary border를 제거하고 흰 배경, 아주 낮은 그림자, 상단 구분선으로 정리했다.
- 헤더 보조 설명은 gray-400으로 통일했고, order action footer 그림자 레벨을 낮췄다.
- 진단명 검색 field와 검색 버튼 높이를 맞췄고, SOAP 카드의 자동저장 상태는 버튼형 badge 대신 비상호작용 text로 표시한다.
- 차트이력 aside item은 공통 `EmrListItem` 패턴을 재사용하도록 변경해 임의 sky 색상 선택 배경을 제거했다.
- 처방/오더 title row와 filter tab 사이 divider를 제거했다.
- 문서 정보바와 차트 본문 divider 사이에 상단 여백을 추가했다.
- `LineTabs`는 기존 크기를 `lg`로 보존하고, 더 작은 `default` size를 추가해 차트 오더 탭에 적용했다.
- 진료 기록 toolbar의 `첨부`/`SOAP 추가` 버튼 높이를 인접 toolbar action과 맞췄고, 처방/오더 table workspace 배경은 gray-50으로 구분했다.
- SOAP 첨부 자료 footer의 별도 배경을 제거했고, compact order table은 header만 gray-50, body는 common white로 정리했다.
- compact order table의 마지막 행으로 ghost 스타일 `+ Order 추가하기` quick action을 추가해 상단 title action까지 이동하지 않아도 오더 추가 흐름으로 진입할 수 있게 했다.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- Manual Playwright viewport check after adding four SOAP sections, screenshot saved at `test-results/chart-soap-order-scroll-boundary.png`.
- Manual Playwright viewport check for divider and compact order table, screenshot saved at `test-results/chart-comments-compact-orders.png`.
- Manual Playwright viewport check for order checkboxes, one-line headers, and uncolored footer, screenshot saved at `test-results/chart-comments-order-checkbox-footer.png`.
- Manual Playwright viewport check for muted subtitles, divider spacing, and compact LineTabs, screenshot saved at `test-results/chart-comments-subtitle-tabs-spacing.png`.
- Playwright regression for keyboard-adjusting the grab divider between SOAP/diagnosis and order areas.
- Playwright regression for stopping grab resize when pointer focus is lost.
- Manual Playwright viewport check for gray-400 subtitles, lighter footer shadow, aligned diagnosis search controls, and non-button SOAP autosave text, screenshot saved at `test-results/chart-comments-polish-subtitle-footer-search-soap.png`.
- Manual Playwright viewport check for chart history aside item color and shared list item reuse, screenshot saved at `test-results/chart-history-aside-reused-list-item.png`.
- Manual Playwright viewport check for default-unselected order checkboxes and no title-to-tabs divider, screenshot saved at `test-results/chart-order-default-unselected-tabs-no-title-divider.png`.
- Manual Playwright viewport check for aligned chart toolbar buttons, gray-50 order table workspace, and low-shadow line-separated order footer, screenshot saved at `output/playwright/chart-order-footer-table-polish.png`.
- Manual Playwright viewport check for no SOAP attachment footer fill and gray-50/common order table color split, screenshot saved at `output/playwright/chart-soap-attachment-order-table-colors.png`.
- Manual Playwright viewport check for the final-row ghost `+ Order 추가하기` action inside the compact order table, screenshot saved at `output/playwright/chart-order-add-final-row.png`.
