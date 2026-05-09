# Chart Safety MVP UX

2026-05-07 진료(차트) workspace에 MVP 안전 UX 보강을 적용했다.

## What Changed

- 환자 컨텍스트 바에서 차트번호를 먼저 보여주고, 환자명과 보호자명을 한 묶음으로 확인할 수 있게 했다.
- 차트 정보 카드의 환자 정보에도 보호자명을 포함하고, 차트 상태는 `자동저장됨 · HH:MM`처럼 마지막 저장 시각을 보여준다.
- SOAP toolbar의 `저장`을 `초안 저장`으로 바꾸고, SOAP 카드 상태에도 자동저장 시각을 표시한다.
- `Order 청구`와 `Order 확정`은 선택 오더가 없으면 비활성화된다.
- 오더 청구/확정 확인 dialog는 환자명, 보호자명, 차트번호, 선택 오더 수, 선택 금액, 재요청 포함 여부를 다시 보여준다.
- `차트 작성완료` 확인 dialog는 환자명, 보호자명, 차트번호, 진단명 수, 오더 수, 차트 상태를 다시 보여준다.
- 모든 확인 action은 prototype 안전 범위에 맞춰 mock 데이터를 변경하지 않는다.

## Verification

- Passed:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`
  - `npm run docs:check`
- Browser review:
  - Reloaded `/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed` in the in-app browser and confirmed the chart completion dialog opens with patient/chart context.
  - Checked that the order confirmation dialog appears after selecting an order and that no new browser console errors were emitted after the dialog markup fix.

## Notes

- Chart reference binary image is still not stored under `docs/design/assets/reference-screens/chart/`, so this work does not claim pixel-level alignment.
- Repeated order recommendation, SOAP/Plan parsing, real order status transition, audit logging, and persistence remain out of scope.
