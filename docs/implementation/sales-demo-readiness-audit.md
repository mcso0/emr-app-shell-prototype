# Sales Demo Readiness Audit

Updated: 2026-05-02

이 문서는 Sales Demo Prototype을 구현하기 전에 7분 데모의 골든 경로, 화면별 gap, reference 상태, 후속 PR 범위를 고정한다. 당장의 목표는 production MVP가 아니라 잠재 고객이 접수부터 수납까지 이어지는 하루 외래 흐름을 이해하고 계약을 상상할 수 있게 만드는 것이다.

## Golden Demo Spine

Primary scenario: **김하늘 / 콩이 / 구토 내원**

| Step | Demo beat | Target module | Success signal |
|---|---|---|---|
| 1 | 데모 시작점에서 `콩이 구토 내원` 시나리오를 선택한다. | 홈 | 역할별 quick start와 추천 경로가 한 화면에서 보인다. |
| 2 | 데스크가 보호자/환자 정보를 확인하고 접수 맥락을 설명한다. | 접수/예약 | 김하늘, 콩이, 구토 내원, 담당 수의사, encounter가 같은 카드/상세 맥락으로 보인다. |
| 3 | 수의사가 대기열에서 콩이를 선택하고 SOAP와 오더를 확인한다. | 진료(차트) | SOAP, Assessment, 검사/영상/조제/처치 오더가 같은 encounter로 연결되어 보인다. |
| 4 | 검사 담당자가 CBC 결과를 확인하거나 입력한다. | 검사 | CBC 결과와 장비 수신 내역이 콩이 encounter에 연결되어 보인다. |
| 5 | 영상 담당자가 복부/흉복부 영상 판독을 확인한다. | 영상 | 영상 오더, 판독 내용, 종합소견이 같은 encounter로 보인다. |
| 6 | 조제/처치 업무 큐가 데모 흐름에 포함된다는 점을 설명한다. | 조제/처치 | 기존 화면 디자인은 보존되고, 데모 script에서 연결 업무 큐로 설명 가능하다. |
| 7 | 수납 담당자가 청구 항목을 확인하고 수납 완료 처리한다. | 수납 | 진료/검사/영상/조제/처치 항목과 금액이 같은 encounter 청구로 묶인다. |

## Screen Gap Checklist

| Area | Current readiness | Gap | Follow-up owner |
|---|---|---|---|
| 홈 | Placeholder 중심 | 데모 시작점, 역할별 quick start, reset 안내가 필요하다. | PR9 |
| 접수/예약 | 주요 화면 구현됨 | 데모 scenario query로 콩이를 우선 선택해야 한다. | PR10 |
| 환자/보호자 | drawer 구현됨 | 콩이/김하늘 seed가 필요하다. | PR8 |
| 진료(차트) | queue/SOAP/order 구현됨 | 콩이 encounter를 query로 직접 열 수 있어야 한다. | PR8, PR10 |
| 검사 | 결과 입력/장비 수신 구현됨 | 콩이 CBC result가 필요하고 query 선택이 필요하다. | PR8, PR10 |
| 영상 | 판독/첨부 구현됨 | 콩이 imaging study가 필요하고 query 선택이 필요하다. | PR8, PR10 |
| 조제/처치 | 기존 화면 보존 대상 | 디자인 변경 없이 demo script에서 흐름상 위치를 설명한다. | PR10 verification |
| 수납 | 청구/결제 구현됨 | 콩이 invoice를 query로 직접 열고 payment flow를 검증해야 한다. | PR8, PR10 |

## Reference Asset Status

Reference images are useful, but not blocking for the first sales demo spine. Missing assets must be described as missing rather than used as pixel-level alignment sources.

| Area | Persistent asset status |
|---|---|
| 접수/예약 drawer | Available: `docs/assets/reference-screens/reception/reception-form-drawer.png` |
| 접수 calendar/list | Missing |
| 환자/보호자 drawer | Missing |
| 진료(차트) | Missing |
| 검사/영상 | Missing |
| 수납 | Missing |
| 조제/처치 | Not a PR7 implementation target; preserve current screen |

## Acceptance Criteria

- `kong-vomit` scenario maps to one guardian, patient, appointment, encounter, SOAP note, diagnosis, lab result, imaging study, dispensing/treatment/lab/imaging orders, and invoice.
- `/w/clair-demo/home` can explain the demo path and link into role/module starting points.
- `/w/clair-demo/treatment`, `/lab`, `/imaging`, and `/billing` can honor the demo scenario through URL query params.
- Shell layout query params do not delete scenario params during navigation state sync.
- Existing 코코/두부/나비/하루 fixtures remain available.
- 조제/처치 screen design and behavior are not changed.

## Follow-up PR Boundaries

| PR | Responsibility |
|---|---|
| PR8 Demo Scenario Seed Data | Add scenario registry and linked 김하늘/콩이 mock data. |
| PR9 Guided Demo Entry | Replace home placeholder with demo launcher and role quick starts. |
| PR10 Demo Flow Continuity | Preserve scenario URL params and apply scenario selection in modules. |
| PR11 Sales Polish | Polish text, status, amount, empty states, and CTA hierarchy after the flow works. |
