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

## Reception And Appointment Definitions

예약은 미래 또는 예정된 내원 약속이다. 아직 환자가 병원에 온 것은 아니고, 특정 날짜/시간에 방문하기로 계획된 상태다.

접수는 환자가 실제로 병원에 도착해서 오늘 진료 업무로 들어온 상태다. 접수되는 순간 예약은 운영 업무로 전환되고, 환자는 대기열이나 진료 흐름에 들어간다.

One-line definition:

> 예약은 진료를 받기로 한 약속이고, 접수는 환자가 실제로 병원에 도착해 진료 업무가 시작되는 시점이다.

Examples:

- 보호자가 전화로 `내일 오전 10시에 진료받고 싶어요`라고 하면 예약이다.
- 보호자가 환자와 함께 병원에 도착해서 데스크에서 확인하면 접수다.
- 예약 없이 바로 방문해서 데스크에서 등록하면 현장 접수다.
- 예약한 환자가 도착해서 확인하면 예약 접수 처리다.

| 구분 | 예약 | 접수 |
|---|---|---|
| 의미 | 예정된 방문 약속 | 실제 내원 후 운영 시작 |
| 시간 | 미래 또는 오늘의 예정 시간 | 도착 이후 현재 업무 |
| 핵심 객체 | Appointment | Encounter / Queue |
| 주요 상태 | 예약확정, 변경, 취소, 노쇼 | 진료대기, 진료중, 수납대기, 완료 |
| 주 사용자 | 데스크, 보호자 응대 | 데스크, 수의사, 진료팀 |
| 결과 | 예약 목록과 캘린더에 표시 | 대기열과 진료 흐름에 진입 |

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
- automatic reminder delivery and waitlist auto-assignment.
- production implementation of drag/drop or resize-based appointment mutation unless separately scoped. Product planning still defines that calendar interactions should exist.

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

- 기본 목적은 오늘 일자의 병원 접수, 예약, 대기 상태를 시간표로 확인하는 것이다.
- 기본 선택 대상은 선택 날짜 출근일인 수의사 전체다.
- 수의사 선택 옵션은 view 전환과 무관한 전역 캘린더 필터다.
- 좌측 진료 대기열/환자 카드의 선택 여부는 스케줄 영역을 필터링하거나 연결하지 않는다.
- 데스크 직원은 스케줄 영역에서 수의사별 예약/접수 현황과 빈 시간대를 확인한 뒤, 현장 접수 환자를 적절한 시간대 또는 담당 수의사로 배정한다.
- 스케줄 운영 toolbar는 calendar controls와 업무 action을 분리해 보여준다.
- Header-level primary entry points are `진료 접수` and `예약 등록`.
- Calendar empty slots can start reception or reservation creation by click or drag. The interaction must snap to exact 15-minute boundaries only: `HH:00`, `HH:15`, `HH:30`, and `HH:45`. The creation surface is the CLAiR right drawer, not a calendar popover.

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
12. Day, week, and month views all support calendar-based reservation and reception entry points in product planning. Implementation may phase this by view, but the product behavior should be planned as editable calendar surfaces.

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

## Calendar Planning V1

The calendar exists inside the 접수/예약 screen. Its primary job is to let staff review the selected date's hospital reception, appointment, and schedule state, then create or adjust reservations and receptions from that time-based context.

### Calendar Purpose

- The calendar is the time-based operating surface for reception and appointment work.
- The side panel is the list surface for the selected date's 접수 and 예약 records.
- The calendar and side panel share date scope, but selecting a side-panel row does not filter calendar lanes.
- The calendar should make today's operational state easy to see while also supporting future appointment planning.

### Header Entry Points

The calendar header provides two explicit entry points:

- `진료 접수`: starts a reception flow.
- `예약 등록`: starts an appointment creation flow.

Rules:

- `진료 접수` creates or prepares an encounter-oriented reception flow.
- `예약 등록` creates an appointment and does not create an encounter until check-in.
- Both entry points use the same core patient/guardian, department, veterinarian, time, duration, purpose, and memo inputs where applicable.
- The current implementation may use different modal/drawer surfaces, but product planning treats their input model as aligned.

### Empty Slot Behavior

Clicking or dragging an empty calendar slot creates a time-scoped draft.

Rules:

- Time selection snaps to 15-minute boundaries.
- Click defaults to the smallest allowed slot duration.
- Drag creates an explicit range such as `10:00-12:00`.
- If the selected slot starts at the current time or overlaps the current time on today's date, the default intent is 접수.
- If the selected slot starts after the current time or on a future date, the default intent is 예약.
- The user can still choose between 접수 and 예약 when the intent is ambiguous.
- Past-date slots, including earlier slots on today, do not create new 접수 or 예약 directly; they should guide users to history or rebooking.

### View Behavior

| View | Product role | Editing behavior |
| --- | --- | --- |
| Day | Main operational view for today's reception and appointment state. | Create 접수 or 예약 from slots, select cards, process check-in, update appointment via detail. |
| Week | Weekly schedule planning view. | Create or update reservations from weekly time slots; selecting a day/time should not force a day-view redirect. |
| Month | Monthly schedule planning and density view. | Create appointments from date cells and inspect counts/previews; detailed time selection can open a focused reservation surface. |

Rules:

- Day, week, and month are all planning-capable calendar views.
- Implementation can phase advanced interactions, but the product spec should not define week/month as read-only.
- Drag-to-reschedule and resize-to-change-duration are future interaction enhancements, not required for the first implementation pass.
- Reservation detail remains the safer place for final mutation confirmation.

### Veterinarian Filter

The veterinarian filter is a global calendar filter independent of view.

| View | Veterinarian filter behavior |
| --- | --- |
| Day | Shows selected veterinarian lanes. Multiple selected veterinarians render multiple lanes. `미지정` can appear as a compact separate lane or option. |
| Week | Shows only schedules for selected veterinarians inside the weekly grid; it does not split the grid into veterinarian lanes. |
| Month | Aggregates counts and previews for selected veterinarians across the month. |

Rules:

- Switching between `일`, `주`, and `월` must preserve selected veterinarian filters.
- If no veterinarian is selected, default to all veterinarians.
- `미지정` is a separate filter option or toggle.
- The filter summary should remain visible, such as `이수지 외 1명` or `수의사 2명 선택`.
- Empty states should explain filter impact: `선택한 수의사의 일정이 없습니다.`

### Unassigned Lane

- `미지정` should be visible without consuming too much space.
- Day view can show `미지정` as a compact lane or grouped section.
- Week/month should include unassigned appointments when `미지정` is selected or when all veterinarians are shown.
- `미지정` must not look like missing data.

### Calendar Card Content

Calendar cards should show only the information needed for scanning.

Minimum content:

- patient name
- guardian name
- visit purpose
- status badge
- assigned veterinarian or `미지정`
- start time and duration when space allows

Priority:

1. patient name
2. appointment/reception status
3. time
4. visit purpose
5. guardian and veterinarian context

### Status Card Treatment

| Status | Meaning | Card treatment |
| --- | --- | --- |
| 예약확정 | Planned appointment; patient has not arrived. | `예약` badge, neutral card, veterinarian accent bar. |
| 지연 | Appointment is late or delayed. | `지연` badge, more noticeable emphasis than 예약확정. |
| 접수완료 / 진료대기 | Patient arrived and is in operational queue. | `접수완료` or `대기` badge, active-operation treatment. |
| 진료중 | Veterinarian started care. | `진료중` badge, active clinical treatment. |
| 노쇼 | Appointment did not arrive. | `노쇼` badge, lower priority and muted appearance. |
| 취소 | Appointment was cancelled. | `취소` badge, muted or faded appearance. |

Rules:

- Do not rely on color alone. Use badge labels.
- Use a thin accent bar for veterinarian or assignment context.
- Cancelled and no-show cards should not visually compete with active operational work.
- Delayed cards should be more noticeable than normal appointments, but not confused with emergency triage.

### Calendar Card Actions

- Selecting a card opens appointment or encounter detail.
- 예약확정 card detail offers `접수 처리`.
- 접수완료 or 진료대기 card detail links to encounter or chart context.
- 취소 and 노쇼 cards offer history and rebooking rather than check-in.
- Direct drag-based time changes are planned as future interaction support; detail-based editing remains the reliable path.

### Date State Rules

| Date state | Calendar behavior | Allowed actions |
| --- | --- | --- |
| Today | Shows operational reception and appointment state. | 진료 접수, 예약 등록, 접수 처리, 예약 변경/취소, 지연/노쇼 |
| Future | Shows planned appointments and available slots. | 예약 등록, 예약 변경, 예약 취소 |
| Past | Shows historical appointment and reception records. | 이력 보기, 재예약 |

Rules:

- Today is the default date.
- A non-today date must show a clear date label and `오늘로 돌아가기`.
- Future dates should not imply a live waiting queue.
- Past dates should not allow normal check-in or direct mutation-heavy actions.

### Blocked Time

Blocked time includes lunch, closed hours, veterinarian unavailable time, and hospital closure.

Rules:

- Blocked slots are visibly inactive.
- Clicking a blocked slot should explain the reason, such as `예약할 수 없는 시간입니다.`
- Staff may need an override path later, but it is not part of the default planning baseline.

### Mobile Calendar

- Mobile uses day view as the main usable calendar surface.
- Veterinarian selection should be controlled through a compact selector/filter, not many side-by-side lanes.
- Week/month on mobile should prioritize navigation, counts, and date selection before dense editing.
- Selecting a card opens a full-height sheet.
- Creating from a slot opens the same appointment/reception form model as desktop.

## Exception Handling V1

This section defines reception/appointment exception behavior before implementation gap review. The main principle is to preserve appointment and encounter history instead of overwriting past operational records.

### Exception Handling Principles

1. 예약과 접수는 섞지 않는다. 예약 변경은 Appointment 변경이고, 실제 도착 이후 문제는 Encounter / Queue 기준으로 처리한다.
2. 중복 가능성은 완전 차단보다 warning and reason-based override를 기본값으로 둔다. 병원 현장에는 예외가 많기 때문이다.
3. 과거 기록은 덮어쓰지 않는다. 노쇼 후 도착, 과거 예약 접수, 접수 후 취소 같은 케이스는 이력을 유지하고 새 접수, 재예약, encounter 취소로 처리한다.
4. 수의사 미지정은 정상 운영 상태다. 빈 값이 아니라 별도 group/filter/lane으로 관리한다.
5. 실패와 충돌은 중복 생성 방지가 핵심이다. 재시도 전에 최신 상태를 먼저 재조회한다.

### Exception Case Table

| Exception case | Recommended handling |
| --- | --- |
| 보호자가 예약 시간보다 일찍 도착 | 접수 가능. 기존 예약 시간은 유지하고 실제 접수 시각은 별도 기록한다. 대기열은 접수 시각 기준으로 표시한다. |
| 보호자가 예약 시간보다 늦게 도착 | `지연` 상태로 표시한다. 진료 가능하면 접수 처리하고, 어렵다면 예약 시간 변경 또는 재예약으로 유도한다. |
| 환자 검색 결과 오늘 예약이 이미 있음 | 기본은 기존 예약을 접수 처리하도록 유도한다. 별도 현장 접수가 필요하면 중복 경고 후 사유를 입력받는다. |
| 한 보호자가 여러 환자를 데려옴 | 보호자는 공유하되 환자별로 개별 접수/예약을 만든다. Encounter는 환자별로 분리한다. |
| 같은 시간대에 여러 환자 동시 예약 | 허용한다. 같은 보호자와 같은 시간대면 grouped reservation처럼 묶어 보여줄 수 있으나, appointment/encounter는 환자별로 유지한다. |
| 담당 수의사가 갑자기 unavailable | 해당 수의사 일정에 warning을 표시하고, 다른 수의사 재배정 또는 `미지정` 전환을 제공한다. |
| 점심시간 또는 진료 종료 직전 접수 요청 | 기본은 warning이다. 병원 운영 정책상 가능하면 override reason을 받고 진행한다. |
| 예약 변경 중 다른 사용자가 먼저 수정 | 저장 시 conflict 안내를 보여준다. 최신 정보를 다시 불러온 뒤 다시 수정하게 한다. |
| 접수 처리 중 network/API 실패 | 접수 실패 안내를 보여주고, 재시도 전 appointment/encounter 상태를 재조회한다. 중복 encounter 생성을 막는다. |
| 환자/보호자 정보가 불완전 | 필수 정보 부족 경고를 보여준다. 최소 필수 정보 입력 후 접수 가능하게 하고, 나머지는 추후 보완으로 둔다. |
| 접수 후 바로 취소 | appointment 취소가 아니라 encounter 취소로 처리한다. 취소 사유는 필수다. |
| 노쇼 처리 후 보호자가 뒤늦게 도착 | 기존 노쇼는 이력으로 유지한다. 당일 진료가 가능하면 새 현장 접수로 생성하고, 아니면 재예약을 만든다. |
| 미지정 예약/접수를 누가 가져갈지 불명확 | 데스크 또는 수의사가 담당의를 지정할 수 있다. 미지정 queue/lane은 별도 group으로 계속 보인다. |
| 과거 예약을 실수로 오늘 접수하려는 경우 | 직접 접수를 차단한다. `재예약` 또는 `오늘 현장 접수로 새로 생성`을 유도한다. |

### Required UX Feedback

- Duplicate warning copy should name the existing record: `오늘 예약이 있습니다. 이 예약을 접수 처리할까요?`
- Separate walk-in override should require a short reason.
- Conflict copy should be polite and operational: `예약 정보가 다른 사용자에 의해 변경되었습니다. 최신 정보를 다시 불러온 뒤 수정해 주세요.`
- API failure copy should not imply success: `접수 처리에 실패했습니다. 상태를 다시 확인해 주세요.`
- Past-record guardrail should explain the safer path: `지난 예약은 바로 접수할 수 없습니다. 재예약하거나 오늘 현장 접수로 새로 생성해 주세요.`

## Reservation Detail Planning V1

This section is the product baseline for 예약 생성, 변경, 취소, 지연, 노쇼 handling. It does not compare against the current implementation; implementation gap review is deferred until other major feature plans are drafted.

### Reservation Creation

예약 생성은 planned visit을 만드는 action이다. It must not create an encounter until the patient is actually checked in.

Required fields:

- patient and guardian context
- reservation date
- reservation start time
- estimated duration
- visit purpose
- department

Optional fields:

- assigned veterinarian
- reception or reservation memo
- internal caution note reference

Rules:

- 담당 수의사는 미지정으로 둘 수 있다.
- 예약 시간은 hospital operating hours and veterinarian availability를 우선 참고하되, MVP에서는 hard automation 대신 warning 중심으로 둔다.
- 같은 환자의 같은 날짜 active appointment or active encounter가 있으면 중복 경고를 보여준다.
- 중복 경고 후에도 저장이 필요하면 override reason을 받는다.
- 예약 생성 후 status는 예약확정이다.
- 예약 생성 success state는 side panel and calendar에서 같은 날짜 기준으로 바로 확인되어야 한다.

### Reservation Update

예약 변경은 보호자 요청, 병원 사정, 담당 수의사 변경, 진료 목적 변경을 반영하는 action이다.

Editable fields:

- reservation date
- reservation start time
- estimated duration
- assigned veterinarian
- visit purpose
- department
- memo

Rules:

- 예약확정 and 지연 states can be updated.
- 접수완료 appointment는 appointment 자체가 아니라 linked encounter 운영 상태를 기준으로 다룬다.
- 노쇼 or 취소 상태의 appointment는 바로 수정하지 않고 재예약 action을 통해 새 appointment를 만든다.
- 날짜나 시간이 바뀌면 calendar and side panel date scope must move the appointment to the new selected date.
- 변경 전후 값, 변경자, 변경 시각은 audit-ready event data로 남길 수 있어야 한다.

### Cancellation

예약 취소는 planned visit을 더 이상 운영하지 않는 action이다.

Rules:

- 취소는 데스크 직원과 수의사가 수행할 수 있다.
- 취소 사유는 필수다.
- 취소된 예약은 기본 운영 목록에서 낮은 우선순위로 보인다.
- 환자/보호자 이력에서는 취소 이력이 유지되어야 한다.
- 취소된 예약은 접수 처리 action을 노출하지 않는다.
- 취소 후 같은 건을 되살리는 대신 재예약을 권장한다.

Recommended cancellation reason options:

- 보호자 요청
- 보호자 일정 변경
- 병원 사정
- 담당 수의사 일정 변경
- 중복 예약 정리
- 기타

### Delay

지연은 예약은 유지하지만 원래 예정 시간보다 내원 또는 진료 시작이 늦어지는 상태다.

Rules:

- 지연은 데스크 직원과 수의사가 표시할 수 있다.
- 지연 사유는 선택 입력으로 둔다.
- 지연 상태에서는 시간 변경, 접수 처리, 노쇼, 취소가 가능하다.
- 보호자가 늦게 도착했지만 당일 진료를 유지하면 지연 또는 시간 변경으로 처리한다.
- 보호자가 날짜를 미루면 예약 변경으로 처리한다.
- 지연 상태는 오늘 운영 화면에서 예약확정보다 눈에 띄되, 진료대기와 혼동되지 않아야 한다.

### No-show

노쇼는 예약 시간이 지났고 환자/보호자가 내원하지 않은 상태다.

Rules:

- MVP에서는 자동 노쇼 확정이 아니라 수동 노쇼 처리를 기본값으로 둔다.
- 노쇼는 데스크 직원과 수의사가 처리할 수 있다.
- 노쇼 사유 또는 메모는 필수다.
- 노쇼 상태에서는 접수 처리 action을 노출하지 않는다.
- 노쇼 후 다시 방문 일정을 잡으려면 재예약 action으로 새 appointment를 만든다.
- 노쇼 이력은 환자/보호자 이력에 남아야 한다.

Recommended no-show reason options:

- 연락 안 됨
- 보호자 취소 의사 확인
- 보호자 일정 착오
- 병원 일정 변경 후 미내원
- 기타

### Date-scope UX

The selected calendar date is the source of truth for the side-panel list.

| Selected date | Side panel behavior | Primary actions |
| --- | --- | --- |
| Today | Shows today's `전체`, `대기`, and `예약` records as the operational workspace. | 현장 접수, 예약 생성, 예약 접수 처리, 지연/노쇼/취소 |
| Past date | Shows that date's appointment and reception history. It should not read as today's live queue. | 이력 보기, 재예약, 제한된 메모 확인 |
| Future date | Shows planned appointments for that date. Reception queue is empty unless records already exist. | 예약 생성, 예약 변경, 예약 취소 |

UX requirements:

- Show the selected date near the side-panel list title.
- Show `오늘로 돌아가기` when selected date is not today.
- Avoid labels like `오늘 대기` when the selected date is not today.
- Future dates should emphasize 예약확정 and not imply current waiting queue activity.
- Past dates should preserve history and avoid mutation-heavy actions except 재예약.

### Appointment Detail Surface

Appointment detail should expose one primary action based on status:

| Status | Primary action | Secondary actions |
| --- | --- | --- |
| 예약확정 | 접수 처리 | 예약 변경, 지연 표시, 취소, 노쇼 |
| 지연 | 접수 처리 | 시간 변경, 취소, 노쇼 |
| 접수완료 | 진료/차트 보기 | linked encounter 보기 |
| 노쇼 | 재예약 | 이력 보기 |
| 취소 | 재예약 | 이력 보기 |

The detail surface must make appointment and encounter different:

- 예약 상세 is about planned visit information.
- 접수 처리 creates or links the encounter.
- 접수완료 이후에는 encounter detail becomes the operational source.

### Reservation Detail Screen Structure

예약 상세 화면은 appointment를 확인하고 필요한 운영 action을 수행하는 surface다. Desktop에서는 우측 Detail Drawer를 기본으로 하고, mobile에서는 full-height sheet로 동작한다.

Recommended information hierarchy:

1. Status header
2. Patient and guardian summary
3. Reservation schedule and assignment
4. Visit purpose and memo
5. Linked encounter or reception state
6. Change history and audit-ready events
7. Sticky action footer

#### 1. Status Header

The top area answers what this reservation is and what can be done now.

Show:

- appointment status badge: 예약확정, 지연, 접수완료, 노쇼, 취소
- reservation date and start time
- estimated duration
- assigned veterinarian label or `담당의 미지정`
- one primary action based on status

Rules:

- The primary action should be visually stronger than secondary actions.
- Use `접수 처리` only when the appointment can still become an encounter.
- If selected date is not today, show the selected date context near the header so the user does not mistake it for today's live queue.

#### 2. Patient And Guardian Summary

This section lets reception staff confirm that they are handling the right patient and guardian before changing or checking in the appointment.

Show:

- patient name
- species, breed, sex/neuter state, age when available
- guardian name
- guardian phone
- patient caution summary when available
- link to patient or guardian detail

Rules:

- Patient name has the highest visual priority in this section.
- Guardian phone is shown for operational confirmation, not as a primary title.
- Detailed patient/guardian editing belongs to customer management. Reservation detail can link out or open the relevant profile surface.

#### 3. Reservation Schedule And Assignment

This section shows the planned visit slot.

Show:

- reservation date
- start time
- estimated duration
- department
- assigned veterinarian
- created source when useful: desk-created, phone-created, imported, or internal

Editable in `예약확정` or `지연`:

- date
- start time
- duration
- department
- assigned veterinarian

Rules:

- Date/time changes must clearly show where the appointment will move.
- If the new time conflicts with another active appointment, show a warning and require an override reason to continue.
- If the assigned veterinarian is unavailable, warn but do not hard-block in MVP.

#### 4. Visit Purpose And Memo

This section explains why the patient is coming in.

Show:

- visit purpose
- reservation memo
- internal reception memo
- last related visit summary when available

Editable in `예약확정` or `지연`:

- visit purpose
- reservation memo
- internal reception memo

Rules:

- Clinical diagnosis, SOAP, or final medical judgment does not belong in reservation detail.
- Internal memo should be visibly staff-only when that distinction exists.

#### 5. Linked Encounter Or Reception State

This section appears when the appointment has been checked in or otherwise linked to operational care work.

Show when `접수완료`:

- linked encounter id or display label
- checked-in time
- queue status
- current assigned veterinarian
- link to chart or encounter detail

Rules:

- After check-in, the encounter becomes the operational source for care workflow.
- Appointment edits should be limited after check-in; operational changes belong to encounter or queue handling.

#### 6. Change History

This section is compact by default and expandable.

Show:

- created time and actor
- latest update time and actor
- cancellation/no-show/delay reason when applicable
- important changes such as time change, veterinarian reassignment, duplicate override

Rules:

- History is not the primary work area, but it must be available for accountability.
- Long audit details can be deferred to admin/audit surfaces later.

#### 7. Sticky Action Footer

Actions should stay reachable without forcing staff to scroll to the top.

Primary action by status:

- 예약확정: `접수 처리`
- 지연: `접수 처리`
- 접수완료: `진료/차트 보기`
- 노쇼: `재예약`
- 취소: `재예약`

Secondary actions:

- 예약 변경
- 지연 표시
- 노쇼 처리
- 예약 취소
- 이력 보기

Rules:

- Destructive or irreversible actions such as 취소 and 노쇼 require confirmation and a reason.
- Do not show disabled action clutter when an action is impossible; hide it or move it to an explanatory unavailable state.
- On mobile, footer actions collapse into one primary button plus a secondary actions menu.

### Reservation Detail Modes

| Mode | Purpose | Entry | Exit |
| --- | --- | --- | --- |
| View | Confirm appointment and choose an action. | Appointment card, calendar card, search result | Close drawer/sheet |
| Edit | Change schedule, assignment, purpose, or memo. | `예약 변경` | Save, cancel, or dirty-state confirmation |
| Check-in confirmation | Confirm appointment before creating encounter. | `접수 처리` | Check in, cancel |
| Cancel confirmation | Capture cancellation reason. | `예약 취소` | Confirm cancellation, cancel |
| No-show confirmation | Capture no-show reason or memo. | `노쇼 처리` | Confirm no-show, cancel |
| Rebook | Create a new appointment from cancelled/no-show history. | `재예약` | Save new appointment, cancel |

Mode rules:

- Edit mode should preserve the read-only summary context so staff know which patient/guardian they are editing.
- Dirty edit state must warn before closing.
- Check-in confirmation should show any duplicate active encounter warning before creating the encounter.
- Rebook creates a new appointment and keeps the old no-show/cancelled appointment as history.

### Mobile Behavior

- Reservation detail opens as a full-height sheet.
- Header and footer remain sticky.
- Patient/guardian summary appears above editable schedule fields.
- Secondary actions collapse behind a menu.
- Long history is collapsed by default.
- Form labels remain visible; do not rely on placeholder-only fields.

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
13. `진료 접수`와 `예약 등록`은 calendar header의 명확한 entry point로 제공된다.
14. Calendar empty slot click/drag는 선택 시간에 따라 접수 또는 예약 의도를 기본값으로 제안한다.
15. Day, week, and month views preserve veterinarian filter state across view changes.
16. Week and month views are planning-capable calendar views, though advanced direct mutations can be phased in later.
17. Calendar cards distinguish 예약확정, 지연, 접수완료/진료대기, 진료중, 노쇼, 취소 with labels and visual priority, not color alone.
18. 상태 변경은 이후 audit log와 DB/API persistence로 연결 가능한 이벤트 정보를 남길 수 있어야 한다.

## Data And API Planning Notes

- Product planning should distinguish appointment creation from encounter creation.
- Check-in is the boundary where an appointment becomes operational care work.
- Walk-in check-in creates an encounter without a prior appointment.
- Appointment check-in creates an encounter linked to the appointment.
- Appointment creation, update, cancellation, delay, and no-show are first-class reception/appointment API concepts, not backlog-only concepts.
- Queue and appointment reads must accept a date scope. Today is the default, but the UI must be able to request past and future dates.
- Calendar reads should accept veterinarian filter scope and include unassigned records when requested.
- Calendar card payloads should distinguish appointment status from encounter/queue status.
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
