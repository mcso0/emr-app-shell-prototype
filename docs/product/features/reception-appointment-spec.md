---
id: PRODUCT-FEATURE-RECEPTION-APPOINTMENT
status: draft
area: product
doc_type: feature
related_work:
  - "docs/work/reception/RECEPTION-PR-001-walk-in-checkin.md"
  - "docs/work/reception/RECEPTION-QA-PR-009-command-new-reception-flow.md"
supersedes: []
superseded_by: []
last_updated: 2026-07-22
---

# Reception / Appointment Feature Spec

## Purpose

접수/예약 화면은 데스크 직원이 오늘의 현장 방문과 예약 내원을 한 화면에서 확인하고, 접수 시점에 encounter를 생성하거나 진료 대기 상태로 연결하는 Product MVP 핵심 업무 화면이다.

현재 구현된 Sales Demo Prototype 흐름을 제품 MVP 수준으로 보강하되, 당장 live DB/API persistence를 구현하지는 않는다. 다만 스펙은 이후 DB/API 전환을 염두에 둔 상태 모델과 데이터 경계를 기준으로 작성한다.

## Planning Decisions

- Product target: Product MVP 보강.
- Primary priority: 접수 처리와 진료 대기열 연결.
- Workflow priority order:
  1. 현장 접수
  2. 예약 환자 접수 처리
  3. 하루 캘린더와 대기열 운영 전체 흐름
  4. 예약 생성/변경/취소
  5. 노쇼/지연/상태 관리
- State model must account for 예약확정, 접수완료, 노쇼, 취소, 진료대기, 수의사 지정, 수의사 미지정.
- Engineering direction: current implementation may remain mock/session-only, but product planning should be compatible with later DB/API persistence.
- Schedule board meaning: 스케줄 영역은 선택한 환자 카드의 상세나 필터 결과가 아니라, 선택된 출근 수의사들의 병원 내 접수/예약 스케줄을 일/주/월 단위로 보여주는 운영 공간이다.

## Primary Users

- 데스크 직원: 예약 확인, 보호자/환자 검색, 현장 접수, 예약 접수 처리, 예약 변경/취소, 노쇼 처리.
- 수의사: 본인 또는 미지정 대기 환자 확인, 다음 진료 대상 선택.
- 간호/테크: 진료 대기 흐름과 후속 오더 대기 맥락 확인.
- 병원 관리자: 접수/예약 운영 상태와 담당 수의사 배정 기준 확인.

## MVP Scope

### Included

- 오늘 예약과 현장 접수 환자를 같은 업무 화면에서 확인한다.
- 예약이 없어도 보호자/환자를 선택해 현장 접수할 수 있다.
- 전역 command palette의 `신규 진료 접수` action은 현재 workspace module 위에서 현장 접수 drawer를 열 수 있어야 하며, 단순히 접수/예약 화면으로 이동하는 것으로 대체하지 않는다.
- 예약 환자를 도착 시 접수 처리하고 진료 대기열로 연결한다.
- 접수 처리 시 encounter 생성 또는 기존 appointment와 encounter 연결 기준을 명확히 한다.
- 담당 수의사가 지정된 대기와 미지정 대기를 구분한다.
- 대기열은 환자, 보호자, 담당 수의사, 접수 시각, 방문 목적, 상태를 보여준다.
- 예약 생성/변경/취소와 노쇼 처리는 MVP 기능 범위에 포함하되, 접수/대기열 연결보다 후순위로 다룬다.
- 상태 변경은 나중에 audit log와 연결될 수 있도록 변경자, 변경 시각, 변경 사유의 필요 여부를 정의한다.

### Out Of Scope For This Planning Slice

- live Supabase project validation.
- DB migration, RLS policy, server-side permission enforcement implementation.
- KakaoTalk or external message provider integration.
- automated scheduling optimization.
- 입원 화면 또는 full 병원관리 화면.
- 조제/처치 화면 디자인 변경.

## Core Objects

### Appointment

예약 전 단계의 내원 예정 정보다.

- appointment id
- patient id
- guardian id
- scheduled start/end time
- visit purpose
- department
- assigned veterinarian id, optional
- status
- memo
- created/updated metadata

### Encounter

실제 내원 또는 진료 업무의 기준 단위다. 현장 접수 또는 예약 접수 처리 시 생성되거나 appointment와 연결된다.

- encounter id
- patient id
- guardian id
- appointment id, optional
- checked-in time
- visit purpose
- assigned veterinarian id, optional
- queue status
- department
- reception memo
- created/updated metadata

### Queue Row

접수/예약 화면과 진료 대기 화면에서 공유되는 운영용 표시 단위다.

- patient name
- guardian name
- reception type: 현장 접수 또는 예약 접수
- assigned veterinarian label: 지정 또는 미지정
- checked-in or scheduled time
- visit purpose
- current status
- next action

### Schedule Board

병원 내 접수/예약 운영 스케줄을 보여주는 표시 단위다.

- 기본 선택 대상은 오늘 출근일인 수의사 전체다.
- 수의사 선택 옵션은 스케줄에 표시할 수의사 lane 또는 calendar scope를 바꾸는 control이다.
- 좌측 진료 대기열/환자 카드의 선택 여부는 스케줄 영역을 필터링하거나 연결하지 않는다.
- 데스크 직원은 스케줄 영역에서 수의사별 예약/접수 현황과 빈 시간대를 확인한 뒤, 현장 접수 환자를 적절한 시간대 또는 담당 수의사로 배정한다.
- 스케줄 운영 toolbar는 schedule controls 뒤에 divider를 두고, 업무 action을 `환자 등록`, `보호자 등록`, primary `접수`, `더보기` 순서로 제공한다.
- Day view empty time slots can create session-only reception tasks by click or drag. The interaction must snap to exact 15-minute boundaries only: `HH:00`, `HH:15`, `HH:30`, and `HH:45`. The creation surface is the CLAiR right drawer, not a calendar popover.
- Effective break periods are warning-only creation time, not blocked time. Walk-in reception and reservations that overlap a break require explicit confirmation before mutation, while closed days, treatment-hour boundaries, elapsed time, and occupied slots remain unavailable. Day view distinguishes breaks with a labeled hatched band that does not intercept calendar interaction.

## State Model

### Appointment Status

| Status | Meaning | Primary action |
|---|---|---|
| 예약확정 | 예약이 생성되었고 아직 접수되지 않음 | 접수 처리, 변경, 취소 |
| 접수완료 | 예약 환자가 도착해 encounter로 연결됨 | 진료 대기열 확인 |
| 노쇼 | 예약 시간이 지났고 내원하지 않음 | 이력 확인, 재예약 |
| 취소 | 보호자 또는 병원 사유로 예약 취소됨 | 이력 확인 |

### Encounter / Queue Status

| Status | Meaning | Primary action |
|---|---|---|
| 진료대기 | 접수 완료 후 진료를 기다림 | 담당 수의사 지정, 차트 진입 |
| 진료중 | 수의사가 진료를 시작함 | 차트 작성 |
| 수납대기 | 진료와 주요 오더가 끝나 수납 대기 | 수납 화면 연결 |
| 완료 | 수납 또는 내원 종료 처리됨 | 이력 확인 |
| 취소 | 접수 후 취소됨 | 취소 이력 확인 |

### Veterinarian Assignment

- 수의사 지정: 특정 수의사에게 배정된 예약 또는 대기.
- 수의사 미지정: 아직 담당 수의사가 없으며 데스크나 진료팀이 배정해야 하는 대기.
- MVP에서는 미지정 상태를 허용한다.
- 미지정 상태의 환자도 접수와 대기열 등록은 가능해야 한다.

## Core Workflows

### 1. 현장 접수

1. 데스크 직원이 보호자 또는 환자를 검색한다.
2. 기존 환자를 선택하거나 신규 환자 등록 흐름으로 이동한다.
3. 방문 목적, 진료과, 담당 수의사, 메모를 입력한다.
4. 담당 수의사는 선택 사항이며 미지정 상태로도 저장할 수 있다.
5. 접수 저장 시 appointment 없이 encounter가 생성된다.
6. 생성된 encounter는 진료대기 상태로 대기열에 표시된다.
7. 생성된 encounter는 자동 선택되고 우측 `접수 상세`에서 바로 확인할 수 있다.

### 1-A. 전역 신규 진료 접수

1. 직원이 어느 workspace module에서든 global command palette를 연다.
2. `신규 진료 접수` action을 선택한다.
3. 현재 module을 유지한 채 CLAiR right drawer가 열리고, 현장 접수 form이 표시된다.
4. 직원은 기존 현장 접수와 같은 입력값으로 보호자/동물, 방문 목적, 진료과, 담당 수의사, 소요 시간, 메모, 체중을 입력한다.
5. `생성`을 누르면 walk-in encounter와 reception queue row가 생성된다.
6. 생성 완료 후 화면은 자동으로 접수/예약 화면으로 강제 이동하지 않는다.
7. 생성한 encounter가 자동 선택된 `접수 상세`를 즉시 표시하고, 성공 toast는 이동 action 없이 완료만 알린다.

### 2. 예약 환자 접수 처리

1. 데스크 직원이 오늘 예약 목록 또는 캘린더에서 예약 건을 선택한다.
2. 보호자/환자, 예약 시간, 방문 목적, 담당 수의사를 확인한다.
3. 필요하면 담당 수의사 또는 방문 목적을 보정한다.
4. 접수 처리 시 appointment status는 접수완료가 된다.
5. encounter가 생성되고 appointment id와 연결된다.
6. 환자는 진료대기 상태로 대기열에 표시된다.

### 3. 하루 캘린더와 대기열 운영

1. 데스크 직원은 캘린더에서 오늘의 예약 밀도와 시간대별 배정을 확인한다.
2. 스케줄의 수의사 선택 옵션은 오늘 출근 수의사를 기본값으로 하며, 선택된 수의사들의 일/주/월 스케줄만 조정한다.
3. 좌측 대기열에서 이미 접수된 환자와 아직 예약 상태인 환자를 구분한다.
4. 좌측 환자 카드 선택은 환자 상세/접수 맥락 선택이며, 스케줄 board의 표시 범위와 직접 연결하지 않는다.
5. 데스크 직원은 스케줄의 빈 시간대와 수의사별 부하를 보고 현장 접수 환자를 배정한다.
6. 접수 완료된 환자는 진료 화면에서 같은 encounter 맥락으로 이어진다.
7. 데스크 직원은 빈 시간대를 클릭해 15분 기본 접수 task를 만들거나, 빈 시간대를 드래그해 선택한 시간 범위의 접수 task를 만든다. 모든 시간은 15분 경계로만 생성된다.

### 4. 예약 생성/변경/취소

1. 예약 생성은 환자/보호자, 예약 시간, 방문 목적, 담당 수의사, 메모를 입력한다.
2. 생성된 예약은 자동 선택한 `예약 상세`로 표시하며, 미래 날짜 예약이면 해당 날짜의 캘린더로 이동한다.
3. 예약 변경은 시간, 담당 수의사, 방문 목적, 메모를 수정할 수 있다.
4. 예약 취소는 취소 사유를 선택 또는 입력할 수 있다.
5. 취소된 예약은 오늘 운영 목록에서는 낮은 우선순위로 표시하고 이력에서는 유지한다.

### 5. 노쇼/지연/상태 관리

1. 예약 시간이 지났지만 접수되지 않은 예약은 노쇼 후보가 된다.
2. MVP에서는 자동 노쇼 확정 대신 수동 노쇼 처리를 기본값으로 둔다.
3. 노쇼 처리 시 appointment status는 노쇼가 된다.
4. 노쇼 이력은 보호자/환자 이력에서 확인할 수 있어야 한다.

## Product Acceptance Criteria

1. 데스크 직원은 예약 없이 온 환자를 현장 접수하고 진료대기 상태로 올릴 수 있다.
2. 데스크 직원은 예약확정 상태의 예약을 접수완료로 바꾸고 encounter를 생성할 수 있다.
3. 접수 완료된 예약 환자와 현장 접수 환자는 같은 대기열에서 확인된다.
4. 담당 수의사 지정/미지정 상태가 대기열에서 구분된다.
5. 수의사는 대기열에서 본인 담당 또는 미지정 환자를 확인하고 진료 화면으로 이어갈 수 있다.
6. 예약 변경, 취소, 노쇼는 접수/대기열 연결보다 후순위지만 MVP 상태 모델 안에 포함된다.
7. 상태 변경은 이후 audit log와 DB/API persistence로 연결 가능한 이벤트 정보를 남길 수 있어야 한다.
8. 전역 `신규 진료 접수` action은 현재 화면을 떠나지 않고 현장 접수 drawer를 열며, 생성 완료 후에는 생성 encounter를 선택한 접수/예약 상세 상태를 즉시 표시한다.

## Data And API Planning Notes

- Product planning should distinguish appointment creation from encounter creation.
- Check-in is the boundary where an appointment becomes operational care work.
- Walk-in check-in creates an encounter without a prior appointment.
- Appointment check-in creates an encounter linked to the appointment.
- The UI may use mock/session-only state until persistence work is explicitly scoped.
- Later API boundaries should provide reads for today appointments, effective encounters, queue rows, and patient/guardian search.
- Later write boundaries should cover create appointment, update appointment, cancel appointment, mark no-show, check-in appointment, create walk-in encounter, assign veterinarian, and update queue status.
- Session-only calendar task creation may carry a planned start time in frontend state before persistence work exists. Persisting this time live requires a separate schema/API contract such as `scheduledStartAt` or `plannedStartAt`.
- Global command entry must reuse the same walk-in creation API and store application path as the reception toolbar `접수하기` drawer. Do not create a local-only command shortcut that bypasses `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters`.
- Create success should select the generated encounter or appointment and show its detail immediately; the toast is confirmation feedback, not a second navigation step.
- Same-day duplicate reception warnings, unsaved drawer dirty guards, and persistent notification follow-ups are useful exceptions but remain outside this implementation slice unless a later work item scopes them.

## Source Documents

- `docs/engineering/current-status.md`
- `docs/product/features/legacy-mvp-feature-spec.md`
- `docs/product/user-flows/emr-saas-userflow.md`
- `docs/work/legacy-mvp-implementation-backlog.md`
- `docs/design/reference-screen-index.md`
