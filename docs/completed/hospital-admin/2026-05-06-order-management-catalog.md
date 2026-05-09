# Order Management Catalog

2026-05-06 병원관리의 Order 관리 화면을 placeholder에서 session-only 오더 카탈로그 workspace로 교체했다.

## What Changed

- `/w/clair-demo/orders`는 병원관리 Order 관리 화면으로 열린다.
- 왼쪽 module panel은 고객관리와 같은 텍스트 계층 메뉴를 재사용한다. `Order 관리`가 왼쪽에서 펼쳐지고, 그 하위의 대분류/세부 분류 leaf를 선택하면 본문 header가 해당 leaf(`임상병리 검사`, `처방`, `영상검사` 등)로 바뀐다.
- side panel header는 조제/처치와 같은 `EmrSubpanelTitle` 접기 버튼 + 타이틀 규칙을 사용한다. 조제/처치의 오더 유형 탭그룹은 병원관리에 사용하지 않는다.
- 별도 content aside는 제거했고, 본문 header 탭은 선택된 leaf 내부의 다음 단계 타입(`원내 혈액 검사`, `임상 미생물 검사` 등)에만 사용한다.
- 오더 테이블은 검색, 사용여부/청구/업무유형 필터, checkbox bulk selection, 복제 action을 제공한다.
- 단일 오더 행 선택 시 넓은 오른쪽 drawer가 열리고, 원내 Order명, 청구서명, 별칭, 전달여부, 대상, 케어가이드, 원내 지시사항, 메모, 금액, 사용여부를 수정할 수 있다.
- 삭제는 작은 확인 dialog를 거쳐 session-only store에서 제거한다.
- Order 세트는 같은 화면에 섞지 않고 별도 화면/후속 범위로 남겼다.

## Verification

- Passed:
  - `npx playwright test tests/hospital-admin.spec.ts tests/customer.spec.ts tests/app-shell.spec.ts --reporter=line`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run docs:check`
- Browser review:
  - Opened `docs/reference/hospital-admin/order-management-wireframe.html` in the in-app browser and checked the 고객관리형 side panel hierarchy.
