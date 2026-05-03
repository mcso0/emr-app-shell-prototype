# Demo Sales Strategy

Updated: 2026-05-02

이 문서는 잠재 고객에게 보여줄 Sales Demo Prototype의 목적, 대상, 핵심 시나리오, 구현 우선순위를 정리한다. 제품 MVP 문서는 장기 제품 범위와 도메인 구조의 기준으로 유지하되, 당장의 작업 우선순위는 이 데모 전략을 따른다.

## Purpose

잠재 고객이 데모를 직접 보거나 사용하면서 “우리 병원 하루 업무가 이 서비스 안에서 돌아갈 수 있겠다”라고 느끼게 만드는 것이 목적이다.

데모의 1차 성공 기준은 기능 수가 아니라 계약 전환 가능성이다. 동물병원 원장, 개원 예정 수의사, 병원 운영 의사결정자가 핵심 외래 업무 흐름을 한 번에 이해하고 도입을 상상할 수 있어야 한다.

## Target Users

- 동물병원 원장
- 개원을 앞둔 수의사
- 병원 운영을 총괄하는 실장/관리자
- 데스크, 수의사, 간호사, 수납 담당자의 협업 흐름을 함께 보는 구매 의사결정자

## Core Demo Promise

접수부터 수납까지 병원의 하루 외래 업무가 하나의 환자 흐름으로 이어진다.

데모에서 가장 강하게 보여줘야 할 메시지:

> 이 서비스는 차트를 쓰는 도구만이 아니라, 접수부터 진료, 검사/영상, 조제/처치, 수납까지 병원의 외래 업무를 하나의 encounter 흐름으로 묶어준다.

## Recommended Demo Scenario

7분 안에 설명할 수 있는 대표 외래 케이스 하나를 중심으로 만든다.

예시:

- 보호자 김하늘이 강아지 콩이를 데리고 구토 증상으로 내원한다.
- 데스크가 예약 또는 현장 접수로 encounter를 만든다.
- 수의사가 대기열에서 콩이를 선택하고 과거 이력과 보호자/환자 정보를 확인한다.
- SOAP 차트를 작성하고 필요한 검사/영상/처방/조제 오더를 확인한다.
- 검사 또는 영상 담당자가 결과를 입력하고 수의사가 상태를 확인한다.
- 조제/처치 진행 상태가 연결된 업무 큐에서 보인다.
- 수납 담당자가 encounter에 연결된 청구 항목을 확인하고 수납 완료 처리한다.
- 환자 이력에 오늘 업무 흐름이 남는 것처럼 보여준다.

## Demo Data Principles

- 실제 병원에서 볼 법한 보호자명, 환자명, 품종, 증상, 검사명, 처방명, 금액을 사용한다.
- 데모 케이스는 3개 정도로 충분하다.
- 첫 방문 환자: 신규 등록 -> 접수 -> 진료
- 재진 환자: 과거 이력 확인 -> 오늘 차트 작성
- 검사 포함 환자: 오더 -> 결과 입력 -> 수납 완료
- 새로고침 후 persistence를 전제로 설명하지 않는다. 현재 프로토타입은 session-only이다.

## Build Priorities

1. 데모 전용 시작점 또는 guided flow를 만든다.
2. 대표 환자/보호자/encounter seed data를 세일즈 데모용으로 다듬는다.
3. 접수/예약, 환자/보호자 드로어, 진료 차트, 검사/영상, 조제/처치, 수납의 흐름 연결감을 높인다.
4. 화면별 정보 우선순위, 밀도, 상태 표현, 금액 표시, 빈 상태 문구를 데모 품질로 정렬한다.
5. 역할 선택 mock은 데모 관점에서 “원장님/수의사/데스크/수납 담당자 관점”을 빠르게 보여주는 데 사용한다.

## Recommended Work Sequence

2026-05-02 기준 아래 sequence는 Sales Demo Spine과 Wave 2 integration으로 완료되었다. 다음 작업은 `docs/archive/sales-demo/sales-demo-wave2-closeout.md`의 Sales Demo Closeout & Rehearsal을 따른다.

| Step | Status | Name | Goal |
|---|---|---|---|
| PR7 | Completed | Sales Demo Readiness & Screen Alignment | reference 상태, 데모 경로, 후속 PR 경계를 정리한다. |
| PR8 | Completed | Demo Scenario Seed Data | 세일즈 미팅에서 사용할 대표 환자/보호자/encounter 데이터를 정리한다. |
| PR9 | Completed | Guided Demo Entry | 역할별 데모 시작점과 추천 흐름 시작점을 제공한다. |
| PR10 | Completed | Demo Flow Continuity | 화면 간 선택 상태와 업무 진행감이 자연스럽게 이어지게 한다. |
| PR11 / Wave 2 | Completed for demo scope | Sales Polish | 원장님 관점의 문구, 상태, 금액, 이력, 빈 화면을 다듬는다. |

## Out Of Scope For Immediate Demo

- 실제 backend, DB, auth, 권한 enforcement
- 실제 KakaoTalk, Excel, PACS, 장비 수신, 결제 연동
- 입원 전체 화면
- 병원관리 전체 화면
- 전체 통계/운영 분석 대시보드
- 모든 처방/수가/오더 관리 화면
- production-grade audit log UI

이 항목들은 제품 MVP 또는 Post-MVP 범위로 설명할 수 있지만, 계약 전환용 데모의 첫 번째 완성 조건으로 삼지 않는다.

## Relationship To MVP Docs

기존 MVP 문서는 삭제하거나 일괄 rename하지 않는다. MVP 문서는 제품으로 확장하기 위한 기능 범위, 도메인 모델, 구현 백로그의 기준으로 남긴다.

다만 현재 작업 목표는 Sales Demo Prototype이다. 새 작업자는 `mvp-current-status.md`를 먼저 읽은 뒤 이 문서를 함께 확인하고, 구현 우선순위를 정할 때 데모 전환 목적을 우선한다.
