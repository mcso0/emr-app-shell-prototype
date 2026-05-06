# Order Management Catalog

2026-05-06 병원관리의 Order 관리 화면을 placeholder에서 session-only 오더 카탈로그 workspace로 교체했다.

## What Changed

- `/w/clair-demo/orders`는 병원관리 Order 관리 화면으로 열린다.
- 화면 구조는 `대분류 > 세부 분류 > 오더 목록`으로 정리했다.
- 오더 테이블은 검색, 사용여부/청구/업무유형 필터, checkbox bulk selection, 복제 action을 제공한다.
- 단일 오더 행 선택 시 넓은 오른쪽 drawer가 열리고, 원내 Order명, 청구서명, 별칭, 전달여부, 대상, 케어가이드, 원내 지시사항, 메모, 금액, 사용여부를 수정할 수 있다.
- 삭제는 작은 확인 dialog를 거쳐 session-only store에서 제거한다.
- Order 세트는 같은 화면에 섞지 않고 별도 화면/후속 범위로 남겼다.

## Verification

- Passed:
  - `npx playwright test tests/hospital-admin.spec.ts tests/service-catalog.spec.ts --reporter=line`
  - `npx playwright test tests/app-shell.spec.ts --reporter=line`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run docs:check`
- Browser review:
  - Opened `docs/reference/hospital-admin/order-management-wireframe.html` in the in-app browser and checked the three-column catalog plus right drawer/footer.
  - Opened `/w/clair-demo/orders?modulePanel=open` as 병원 관리자 and checked the desktop catalog/table/drawer.
  - Checked a 390px mobile viewport for drawer visibility, sticky footer visibility, and no body-level horizontal overflow.
