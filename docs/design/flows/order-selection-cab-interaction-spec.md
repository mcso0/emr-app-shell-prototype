---
id: DESIGN-FLOW-ORDER-SELECTION-CAB-INTERACTION
status: approved
area: design
doc_type: interaction-contract
related_work:
  - CLINICAL-BILLING-PR-017
source_figma_node: "28441:115889"
prototype: order-selection-cab-interactive-prototype.html
last_updated: 2026-09-20
---

# Order Selection CAB Interaction Contract

이 문서는 Plan/Order 테이블의 선택 행 작업(CAB)과 수납 청구 범위를
정의한다. Figma `Frame 427322610`의 세 가지 CAB variant를 기준으로 하며,
실제 제품 구현 시 기존 `Button` 컴포넌트를 재사용한다.

## Scope split

| 영역 | 액션 | 대상 |
| --- | --- | --- |
| 푸터 | `전체 수납 청구` | 현재 진료의 확정·미청구·청구 가능 오더 전체. 선택 상태와 무관 |
| 선택 CAB | `n개 Order 수납 청구` | 체크박스로 선택한 확정·미청구·청구 가능 오더만 |

부분 수납은 선택 CAB에서만 실행한다. 푸터 전체 청구와 선택 부분 청구는
대상과 금액을 확인 화면에서 분명히 구분한다.

## CAB visibility matrix

| 선택 상태 | CAB 액션 | 개수 기준 |
| --- | --- | --- |
| 선택 없음 | CAB 미노출 | - |
| 미확정 후보만 | `n개 Order 확정`, `삭제`, `선택 해제` | 선택된 미확정 오더 수 |
| 확정 오더만 | `n개 Order 수납 청구`, `재요청`, `긴급`, `선택 해제` | 선택된 확정 오더 수 |
| 미확정 + 확정 혼합 | `n개 Order 확정`, `n개 Order 수납 청구`, `선택 해제` | 각 액션 대상 수를 분리 |

혼합 선택에서 수납 청구 개수에는 확정·청구 가능 오더만 포함한다.
미확정 오더는 수납 대상에서 제외한다.

## Action contracts

| 액션 | 실행 전 | 성공 시 | 실패/부분 실패 |
| --- | --- | --- | --- |
| `Order 확정` | 확인 알럿 | 미확정 오더를 확정하고 선택 해제·CAB 닫힘. `n개 오더를 확정했습니다.` | 실패한 오더만 선택 유지 |
| `삭제` | 알럿 본문: `선택한 n개 오더가 현재 Plan에서 제거됩니다.`. 버튼 `취소` / `삭제` | 현재 Plan/Order 테이블에서 후보 로우 제거. 오더 데이터 자체는 삭제하지 않음. 선택 해제·CAB 닫힘 | 실패한 로우만 선택 유지 |
| `선택 해제` | 확인 없음 | 체크박스 선택만 해제. 데이터 변경 없음. CAB 닫힘 | 해당 없음 |
| `n개 Order 수납 청구` | 대상 오더 수·금액 확인 알럿 | 선택된 확정 오더만 수납 청구하고 선택 해제·CAB 닫힘 | 실패한 오더만 선택 유지 |
| `재요청` | 확인 알럿 | 확정 오더를 업무 큐에 다시 요청하고 선택 해제·CAB 닫힘 | 실패한 오더만 선택 유지 |
| `긴급` | 확인 알럿 | 확정 오더를 긴급 상태로 표시하고 좌측 업무 대기열 최상단으로 이동. 선택 해제·CAB 닫힘 | 실패한 오더만 선택 유지 |

부분 처리 결과는 다음 형식의 토스트를 사용한다.

`3개 오더 처리 완료, 1개 오더 처리에 실패했습니다.`

## Feedback rules

- 데이터에 영향을 주는 `확정`, `삭제`, `수납 청구`, `재요청`, `긴급`은 실행 전 확인 알럿을 사용한다.
- `선택 해제`는 단순 선택 상태 변경이므로 별도 확인 알럿을 사용하지 않는다.
- 성공한 액션은 성공 토스트를 보여주고 해당 선택을 해제한다.
- 실패한 오더는 다시 선택 상태로 남겨 재시도할 수 있게 한다.
- 금융 액션인 수납 청구는 확인 화면에 대상과 금액을 반드시 보여준다.

## Visual contract

- CAB: 높이 `42px`, 패딩 `6px 8px`, 버튼 간격 `8px`
- CAB: 배경 `#FFFFFF`, border `#E5E5E5`, radius `14px`
- 버튼: `28px`, 좌우 패딩 `8px`, radius `8px`, Pretendard Medium `12px / 16px`
- count label: Pretendard Medium `12px / 16px`, letter-spacing `2.5%`, `#171717`
- divider: `1px × 24px`, `#E5E5E5`
- 버튼 매핑: primary=`Button default`, outline=`Button outline`, destructive=`Button destructive`, ghost=`Button ghost`, 모두 `size="xs"`
- hover, focus, disabled, loading은 기존 Button 컴포넌트 상태를 사용한다.

## Implementation boundary

- 선택 상태 판정과 액션 문구는 chart feature adapter가 소유한다.
- 공통 CAB host는 위치·접근성·공통 geometry를 제공한다.
- 수납 청구의 실제 권한·금액·idempotency·workspace 검증은 서버 계약을 따른다.
- 이 문서는 UX 계약이며, 실제 오더·청구 데이터의 삭제나 원격 변경을 승인하지 않는다.

## Prototype verification

정적 프로토타입은 다음처럼 별도 HTTP 서버를 띄운 뒤 전용 대상 URL로 실행한다.

```bash
python3 -m http.server 4175 --directory .
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175 \
  npx playwright test tests/order-selection-cab-prototype.spec.ts
```

실제 차트 화면은 `tests/chart.spec.ts`의 Plan/Order·확정·청구 흐름과
변경된 선택 CAB 문구를 함께 검증한다.
