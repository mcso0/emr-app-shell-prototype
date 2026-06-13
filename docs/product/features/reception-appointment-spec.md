---
id: PRODUCT-FEATURE-RECEPTION-APPOINTMENT
status: draft
area: product
doc_type: feature
related_work:
  - "docs/work/reception/RECEPTION-PR-001-walk-in-checkin.md"
supersedes: []
superseded_by: []
last_updated: 2026-06-13
---

# Reception / Appointment Feature Spec

## Purpose

접수/예약 화면은 데스크 직원이 오늘의 현장 방문과 예약 내원을 한 화면에서 확인하고, 접수 시점에 encounter를 생성하거나 진료 대기 상태로 연결하는 Product MVP 핵심 업무 화면이다.

현재 구현된 Sales Demo Prototype 흐름을 제품 MVP 수준으로 보강하되, 당장 live DB/API persistence를 구현하지는 않는다. 다만 스펙은 이후 DB/API 전환을 염두에 둔 상태 모델과 데이터 경계를 기준으로 작성한다.

## Planning Decisions

- Product target: Product MVP 보강.
- Primary priority: 접수/예약 운영 전체. 현장 접수, 예약 생성/변경/취소, 예약 환자 접수 처리는 같은 1차 범위로 기획한다.
- Implementation sequencing may still prioritize the check-in path first, but product planning must not treat 예약 as a later or optional task.
- Workflow priority order:
  1. 현장 접수
  2. 예약 생성/변경/취소
  3. 예약 환자 접수 처리
  4. 선택 날짜 기준 캘린더와 접수/예약 목록 운영
  5. 노쇼/지연/상태 관리
- State model must account for 예약확정, 예약변경, 접수완료, 지연, 노쇼, 취소, 진료대기, 수의사 지정, 수의사 미지정.
- Engineering direction: current implementation may remain mock/session-only, but product planning should be compatible with later DB/API persistence.
- Schedule board meaning: 스케줄 영역은 선택한 환자 카드의 상세나 필터 결과가 아니라, 선택된 출근 수의사들의 병원 내 접수/예약 스케줄을 일/주/월 단위로 보여주는 운영 공간이다.
- Default list mode is `전체`, not `대기`.
- Date scope is shared: the calendar selected date controls the side-panel list. Today is the default date, but if the user moves to a past or future date, the list must show that selected date's appointments and reception records rather than today's list.
- User-facing product copy uses polite operational Korean. Example: `접수 정보를 불러오지 못했습니다.` Do not use casual speech in the service UI.

## Primary Users

- 데스크 직원: 예약 확인, 보호자/환자 검색, 현장 접수, 예약 접수 처리, 예약 변경/취소, 노쇼 처리.
- 수의사: 본인 또는 미지정 대기 환자 확인, 다음 진료 대상 선택.
- 간호/테크: 진료 대기 흐름과 후속 오더 대기 맥락 확인.
- 병원 관리자: 접수/예약 운영 상태와 담당 수의사 배정 기준 확인.

## MVP Scope

### Included

- 오늘 또는 선택한 날짜의 예약과 현장 접수 환자를 같은 업무 화면에서 확인한다.
- 예약이 없어도 보호자/환자를 선택해 현장 접수할 수 있다.
- 예약을 생성하고, 보호자 요청 또는 병원 사정에 따라 일자/시간, 담당 수의사, 방문 목적, 메모를 변경할 수 있다.
- 예약을 취소하거나 노쇼/지연 상태로 관리할 수 있다.
- 예약 환자를 도착 시 접수 처리하고 진료 대기열로 연결한다.
- 접수 처리 시 encounter 생성 또는 기존 appointment와 encounter 연결 기준을 명확히 한다.
- 담당 수의사가 지정된 대기와 미지정 대기를 구분한다.
- 대기열은 환자, 보호자, 담당 수의사, 접수 시각, 방문 목적, 상태를 보여준다.
- 예약 생성/변경/취소와 노쇼/지연 처리는 MVP 기능 범위에 포함한다.
- 상태 변경은 나중에 audit log와 연결될 수 있도록 변경자, 변경 시각, 변경 사유의 필요 여부를 정의한다.

### Out Of Scope For This Planning Slice

- live Supabase project validation.
- DB migration, RLS policy, server-side permission enforcement implementation.
- KakaoTalk or external message provider integration.
- automated scheduling optimization.
- 입원 화면 또는 full 병원관리 화면.
- 조제/처치 화면 디자인 변경.
- Week/month view에서의 고급 편집, drag/drop 재배정, 자동 리마인더, 예약 대기자 자동 배정.

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

## State Model

### Appointment Status

| Status | Meaning | Primary action |
|---|---|---|
| 예약확정 | 예약이 생성되었고 아직 접수되지 않음 | 접수 처리, 변경, 취소 |
| 지연 | 예약 시간이 지났거나 보호자 요청으로 도착/진료 시작이 늦어짐 | 시간 변경, 접수 처리, 노쇼, 취소 |
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
7. 같은 환자의 선택 날짜 active encounter가 이미 있으면 중복 경고를 보여주고, 계속 진행할 때 사유를 받는다.

### 2. 예약 생성/변경/취소

1. 데스크 직원 또는 권한 있는 사용자가 빈 시간대 또는 예약 생성 액션을 선택한다.
2. 환자/보호자, 예약 일자/시간, 방문 목적, 진료과, 담당 수의사, 메모를 입력한다.
3. 담당 수의사는 선택 사항이며 미지정 예약을 허용한다.
4. 저장하면 appointment status는 예약확정이 된다.
5. 예약 변경은 일자/시간, 담당 수의사, 방문 목적, 진료과, 메모를 수정할 수 있다.
6. 보호자가 늦게 오거나 일자를 미룰 때도 예약 변경으로 처리한다.
7. 예약 취소는 취소 사유를 입력해야 한다.
8. 취소된 예약은 운영 목록에서는 낮은 우선순위로 표시하고, 환자/보호자 이력에서는 유지한다.

### 3. 예약 환자 접수 처리

1. 데스크 직원 또는 수의사가 선택 날짜 예약 목록 또는 캘린더에서 예약확정 항목을 선택한다.
2. 보호자/환자, 예약 시간, 방문 목적, 담당 수의사를 확인한다.
3. 필요하면 접수 처리 전에 예약 시간, 담당 수의사, 방문 목적, 진료과, 메모를 보정한다.
4. 접수 처리 시 appointment status는 접수완료가 된다.
5. encounter가 생성되고 appointment id와 연결된다.
6. 환자는 진료대기 상태로 대기열에 표시된다.
7. 이미 접수완료된 예약은 다시 접수 처리할 수 없다.

### 4. 선택 날짜 캘린더와 접수/예약 목록 운영

1. 화면 진입 시 기본 날짜는 오늘이고, 목록 기본 탭은 `전체`다.
2. 데스크 직원은 캘린더에서 선택 날짜의 예약 밀도와 시간대별 배정을 확인한다.
3. 선택 날짜가 바뀌면 사이드 패널의 `전체`, `대기`, `예약` 목록도 같은 날짜 기준으로 바뀐다.
4. 과거 날짜에서는 해당 날짜의 예약/접수 이력을 보여주고, 오늘 대기열처럼 보이지 않게 한다.
5. 미래 날짜에서는 예약 중심으로 보여주고, 실제 진료대기/접수완료 상태는 존재하는 기록만 표시한다.
6. 날짜가 오늘이 아니면 `오늘로 돌아가기` action을 제공한다.
7. 스케줄의 수의사 선택 옵션은 해당 날짜 출근 수의사를 기본값으로 하며, 선택된 수의사들의 일/주/월 스케줄만 조정한다.
8. 좌측 대기열에서 이미 접수된 환자와 아직 예약 상태인 환자를 구분한다.
9. 좌측 환자 카드 선택은 환자 상세/접수 맥락 선택이며, 스케줄 board의 표시 범위와 직접 연결하지 않는다.
10. 데스크 직원은 스케줄의 빈 시간대와 수의사별 부하를 보고 현장 접수 환자를 배정한다.
11. 접수 완료된 환자는 진료 화면에서 같은 encounter 맥락으로 이어진다.
12. Day view의 빈 시간대는 15분 경계로만 신규 접수 또는 예약 생성의 진입점이 될 수 있다. Week/month view는 MVP에서 조회 중심으로 둔다.

### 5. 노쇼/지연/상태 관리

1. 예약 시간이 지났지만 접수되지 않은 예약은 노쇼 후보가 된다.
2. MVP에서는 자동 노쇼 확정 대신 수동 노쇼 처리를 기본값으로 둔다.
3. 노쇼 처리 시 appointment status는 노쇼가 된다.
4. 노쇼 이력은 보호자/환자 이력에서 확인할 수 있어야 한다.
5. 지연은 보호자 연락, 병원 사정, 수의사 지연 등으로 예약 시간이 밀린 상태다.
6. 지연은 시간 변경 또는 접수 처리로 해소되며, 지연 사유는 선택 입력으로 둔다.
7. 노쇼와 취소는 사유 입력을 필수로 둔다.

## Permissions And Audit

- 데스크 직원은 현장 접수, 예약 생성/변경/취소, 예약 환자 접수 처리, 노쇼/지연 처리를 수행할 수 있다.
- 수의사도 예약 환자 접수 처리, 노쇼/지연 처리, 담당 수의사 보정 등 일부 접수 운영 action을 수행할 수 있다.
- 이 권한은 작은 병원에서 수의사와 데스크만으로 운영하는 현실을 반영한다. 병원 규모가 커지면 병원 관리자 역할이 더 권장되지만, 제품은 수의사 역할에도 제한된 운영 보조를 허용한다.
- 취소, 노쇼, 중복 접수 override, 담당 수의사 재배정은 변경자, 변경 시각, 변경 전후 값, 사유를 감사 가능한 이벤트로 남길 수 있어야 한다.
- 환자/보호자 등록의 canonical source는 customer management planning이다. Reception spec은 접수 중 등록 진입점과 접수 후속 액션만 정의한다.

## UX Copy And Error States

- Service UI copy uses polite Korean, not conversational 반말.
- Reception loading failure copy: `접수 정보를 불러오지 못했습니다.`
- Calendar loading failure copy: `예약 일정을 불러오지 못했습니다.`
- Permission or workspace membership details should not be exposed as the primary user-facing message. Detailed causes belong to admin-facing logs, support diagnostics, or developer telemetry.
- KakaoTalk or external notification sending is deferred. MVP may show internal notification intent only if a later notification spec includes it.

## Product Acceptance Criteria

1. 데스크 직원은 예약 없이 온 환자를 현장 접수하고 진료대기 상태로 올릴 수 있다.
2. 데스크 직원은 예약을 생성하고, 예약 일자/시간, 담당 수의사, 방문 목적, 진료과, 메모를 변경할 수 있다.
3. 데스크 직원 또는 수의사는 예약확정 상태의 예약을 접수완료로 바꾸고 encounter를 생성할 수 있다.
4. 접수 완료된 예약 환자와 현장 접수 환자는 같은 대기열에서 확인된다.
5. 기본 목록 탭은 `전체`이며, `대기`와 `예약`으로 필터링할 수 있다.
6. 캘린더 선택 날짜가 바뀌면 사이드 패널 목록도 같은 날짜의 접수/예약 records로 바뀐다.
7. 과거/미래 날짜에서는 오늘 대기열처럼 오인되지 않도록 선택 날짜 label과 `오늘로 돌아가기` action이 제공된다.
8. 담당 수의사 지정/미지정 상태가 대기열과 예약 카드에서 구분된다.
9. 수의사는 대기열에서 본인 담당 또는 미지정 환자를 확인하고 진료 화면으로 이어갈 수 있다.
10. 노쇼와 취소는 데스크 직원과 수의사가 처리할 수 있고, 사유 입력이 필수다.
11. 지연은 데스크 직원과 수의사가 처리할 수 있고, 시간 변경 또는 접수 처리로 해소된다.
12. 같은 환자의 선택 날짜 active encounter가 있으면 중복 경고를 보여주고, override 시 사유를 받는다.
13. 상태 변경은 이후 audit log와 DB/API persistence로 연결 가능한 이벤트 정보를 남길 수 있어야 한다.

## Data And API Planning Notes

- Product planning should distinguish appointment creation from encounter creation.
- Check-in is the boundary where an appointment becomes operational care work.
- Walk-in check-in creates an encounter without a prior appointment.
- Appointment check-in creates an encounter linked to the appointment.
- Appointment creation, update, cancellation, delay, and no-show are first-class reception/appointment API concepts, not backlog-only concepts.
- Queue and appointment reads must accept a date scope. Today is the default, but the UI must be able to request past and future dates.
- The UI may use mock/session-only state until persistence work is explicitly scoped.
- Later API boundaries should provide reads for today appointments, effective encounters, queue rows, and patient/guardian search.
- Later write boundaries should cover create appointment, update appointment, cancel appointment, mark no-show, check-in appointment, create walk-in encounter, assign veterinarian, and update queue status.
- Session-only calendar task creation may carry a planned start time in frontend state before persistence work exists. Persisting this time live requires a separate schema/API contract such as `scheduledStartAt` or `plannedStartAt`.
- KakaoTalk or external provider delivery should not be included in reception MVP API scope unless the notification feature spec explicitly reopens it.

## Source Documents

- `docs/engineering/current-status.md`
- `docs/product/features/legacy-mvp-feature-spec.md`
- `docs/product/user-flows/emr-saas-userflow.md`
- `docs/work/legacy-mvp-implementation-backlog.md`
- `docs/design/reference-screen-index.md`
