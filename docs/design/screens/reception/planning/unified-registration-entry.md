---
id: DESIGN-SCREEN-RECEPTION-PLANNING-UNIFIED-REGISTRATION-ENTRY
status: draft
area: design
doc_type: planning
screen: reception
related_feature: PRODUCT-FEATURE-RECEPTION-APPOINTMENT
created: 2026-05-05
last_updated: 2026-05-05
---

# 접수/예약 통합 등록 진입 기획

## Summary

접수/예약 toolbar의 `환자 등록`, `보호자 등록` 두 진입점을 하나의 `환자/보호자 등록` 버튼으로 단일화한다. 사용자는 먼저 등록 케이스를 선택하고, 시스템은 선택한 케이스에 맞춰 보호자/환자 정보를 draft로 받은 뒤 `등록 정보 확인`에서 최종 commit한다.

Recommended label: `환자/보호자 등록`

Rationale: 이 진입점의 목적은 실제 접수 생성이 아니라 환자와 보호자 master data 등록이다. 접수는 기존 `진료 접수` 버튼 또는 등록 성공 toast의 후속 액션으로만 진행한다.

2026-05-05 implementation decision: registration entry points are unified with a branch-first dialog, while the existing `진료 접수` shortcut remains available for staff who already know the patient to check in.

## Proposed Flow

1. Case selection first
   - `환자/보호자 등록` 버튼을 누르면 `신규 등록` dialog가 열린다.
   - 카드형 radio option으로 `환자/보호자 모두 신규 등록`, `기존 보호자에 신규 환자 등록` 중 하나를 선택한다.
2. Branching
   - 환자/보호자 모두 신규 등록: 보호자 등록 1/2 → 환자 등록 2/2 → 등록 정보 확인 → commit.
   - 기존 보호자에 신규 환자 등록: 기존 보호자 검색/선택 → 환자 등록 → 등록 정보 확인 → commit.
3. Draft and confirmation
   - 최종 확인 전까지 입력값은 component-local draft로만 유지한다.
   - `등록 정보 확인`에서 `등록`을 누를 때만 session store에 보호자/환자를 생성한다.
4. Completion
   - 성공 toast는 `환자 상세 보기`와 `진료 접수` 후속 액션을 제공한다.
   - 등록 완료 후 자동으로 진료 접수로 이동하지 않는다.
5. Cancel behavior
   - 입력값이 있는 상태에서 닫거나 취소하면 이탈 확인 dialog를 보여준다.
   - 확인 전 취소된 draft는 session store에 남기지 않는다.

## Epic 1: 통합 경로 신규 내원 객체 등록 및 접수

User story: 리셉션 직원은 환자/보호자 등록 케이스를 먼저 선택하고, 시스템 가이드에 따라 보호자·환자 정보를 누락 없이 입력한 뒤 최종 확인에서 안전하게 등록한다.

Acceptance criteria:

- 기존 `환자 등록`, `보호자 등록` 버튼을 제거하고 `환자/보호자 등록` 버튼 하나로 통합한다.
- 첫 화면에서 `환자/보호자 모두 신규 등록`, `기존 보호자에 신규 환자 등록` 중 하나를 선택한다.
- 신규 보호자 케이스는 보호자 등록 1/2, 환자 등록 2/2, 등록 정보 확인 순서로 진행한다.
- 기존 보호자 케이스는 기존 보호자 검색/선택, 환자 등록, 등록 정보 확인 순서로 진행한다.
- 각 단계 입력 데이터는 다음 단계로 자동 전달되지만 최종 확인 전까지 store에 commit하지 않는다.
- 보호자 성함/연락처, 동물 이름/종류/품종/나이 같은 필수값이 없으면 다음 단계 진행을 막고 field-level feedback을 표시한다.

## Epic 2: 동물 정보 등록 디테일

Goal: 정확한 환자 데이터를 확보하기 위해 동물 정보 입력 편의성을 높인다.

Acceptance criteria:

- 나이(년, 개월) 입력 시 현재 날짜 기준 생년월일을 역산한다.
- 생년월일 입력 시 현재 나이를 자동 계산해 노출한다.
- 주 품종 입력 시 자동완성 리스트를 제공한다.
- `믹스` 토글 활성화 시 종에 따라 `믹스견` 또는 `믹스묘`를 기본 제안한다. 기타 동물은 직접 입력을 유지한다.
- 마이크로칩 번호 입력 시 중복 여부를 확인한다.
- 동일 보호자 아래 동일 동물명 등록 시 경고 문구를 노출한다.

## Epic 3: 스마트 진료 접수 및 알림

Goal: 기존 환자의 재진 여부와 자주 쓰는 방문 목적, 접수 알림을 빠르게 처리한다.

Acceptance criteria:

- 환자의 완료된 진료가 1건 이상이면 `재진` 체크박스를 자동 활성화한다.
- 방문 목적 입력창 하단에 `예방접종`, `구토/설사` 등 자주 쓰는 목적 chip을 배치한다.
- 목적 chip 클릭 시 방문 목적 입력값에 즉시 반영한다.
- 접수 생성 시 `카카오톡 발송`이 체크되어 있으면 보호자에게 접수 확인 메시지 발송을 시뮬레이션한다.
- 접수 완료 후 대기 리스트와 담당의 timeline에 환자 카드가 즉시 생성된다.

## Implementation Plan

### RECEPTION-PR-004: Unified Registration Entry

- Toolbar에서 `환자 등록`, `보호자 등록` 버튼을 `환자/보호자 등록` 단일 버튼으로 교체한다.
- 통합 등록 dialog의 첫 화면을 카드형 radio 선택 단계로 만든다.
- 선택한 mode에 따라 `신규 보호자 등록 1/2` 또는 `기존 보호자 선택`으로 이동한다.
- 보호자/환자 입력값은 component-local draft로 관리한다.
- `등록 정보 확인`에서만 `addGuardian`, `addPatient`를 호출한다.
- 등록 완료 후 자동 접수로 이동하지 않고 성공 toast action으로 `환자 상세 보기`, `진료 접수`를 제공한다.
- dirty 상태에서 닫기/취소 시 이탈 확인 dialog를 보여준다.
- 나이와 생년월일 양방향 계산 UI를 추가한다.
- 믹스 토글 기본값을 종별로 `믹스견`/`믹스묘`로 제안한다.
- 동일 보호자 아래 동일 동물명 경고를 추가한다.
- 마이크로칩 중복 체크 feedback을 통합 flow 안에서도 일관되게 보여준다.
- 기존 진료 이력 기반 `재진` 자동 체크를 추가한다.
- 방문 목적 chip UI를 진료 접수 방문 목적 하단에 추가한다.
- `카카오톡 발송` 체크가 켜진 접수 생성 시 message send simulation 상태를 남긴다.
- 접수 완료 후 대기 리스트와 day calendar 반영 회귀를 강화한다.

## Decisions

- 최종 확인 전 draft 취소는 session에 아무 것도 남기지 않는다.
- `환자/보호자 등록`과 기존 `진료 접수` 버튼은 둘 다 유지한다.
- 카카오톡 발송은 실제 provider 없이 `MessageDelivery` shape의 session-only simulation 기록만 남긴다.

## Test Plan

- toolbar에 `환자/보호자 등록`과 `진료 접수`가 보이고 `신규 접수/등록`은 보이지 않는다.
- `환자/보호자 모두 신규 등록` branch가 보호자 등록 1/2 → 환자 등록 2/2 → 등록 정보 확인 → 성공 toast로 이어진다.
- `기존 보호자에 신규 환자 등록` branch가 기존 보호자 선택 → 환자 등록 → 등록 정보 확인 → 성공 toast로 이어진다.
- 최종 확인 전 취소 시 보호자/환자가 생성되지 않는다.
- dirty 상태에서 닫기/취소 시 이탈 확인 dialog가 보인다.
- 필수값 누락 시 다음 단계로 이동하지 않는다.
- 동물 나이와 생년월일이 서로 계산된다.
- 동일 보호자 아래 동일 동물명 경고가 보인다.
- 재진 환자는 진료 접수에서 재진 체크가 자동 활성화된다.
- 방문 목적 chip 클릭 시 방문 목적 입력값이 바뀐다.
- 카카오톡 발송 체크 후 접수하면 발송 simulation 상태가 확인된다.
