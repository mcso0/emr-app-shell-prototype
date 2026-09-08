---
id: "HOME-OPERATIONS-WORK-STATUS-CONTRACT-V0"
type: Feature Spec
title: "Feature: Home Operations Work Status"
description: "Defines the product, status, work-generation, and API/read-model contract for the Home 원내 현황 operations board."
status: approved
area: product
doc_type: feature
tags: [home, operations, work-status, kanban, workflow]
related_docs:
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/product/features/home/home-v1-ui-spec.md"
  - "docs/engineering/data-model/home-operations-work-status-read-model.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
related_work:
  - "docs/work/home/HOME-PR-011-home-operations-live-work-items.md"
  - "docs/work/home/HOME-PR-012-home-operations-source-to-home-parity.md"
supersedes: []
superseded_by: []
last_updated: 2026-07-05
---

# Feature: Home Operations Work Status

## Goal

`원내 현황` shows the hospital-wide operational work flow for the selected operating day, so staff can see active work, team queues, and attention items without visiting each module first.

## Implementation Status

HOME-PR-011 implements the first live read path for Cheongdam/prepared-clinic Home operations:

- Server read endpoint: `GET /api/workspaces/[workspaceId]/operations/work-items`.
- Additive Supabase RPC: `clair_list_home_operations_work_items`.
- Source coverage: appointments/reception queue, consultation-like queue states, order fulfillment work items, and billing/invoice work candidates.
- Home UI consumes the API for non-legacy workspaces and does not fall back to mock operations data on read failure.
- Inpatient work remains v2.

HOME-PR-012 adds source-to-Home parity verification:

- Regression coverage creates reservation, chart-order fulfillment, and billing source work before reading Home operations.
- Home cards are verified by the same queue-card information contract used by source queues: primary text, secondary text, status label, time label, owner/queue label, drawer summary, and source navigation path.
- The replay path is scoped to deliberate local/demo identity. Cheongdam/prepared-clinic Home operations remain mockless and must not hide read errors as empty work.
- `접수` remains a source-writer gap until the product creation rule is decided; do not invent Home-only reception cards.

## Users

- Primary: hospital owner/manager, front desk, technicians, billing staff, veterinarians.
- Secondary: future restricted or guest users with limited operational visibility.

## Scope

Included:

- Hospital-wide work status board for the selected operating day.
- Work cards from reception, appointments, chart/consultation, lab, imaging, dispensing, treatment, and billing.
- Future inpatient work after a durable inpatient operations source exists.
- `내 업무 보기` shortcut that includes only work directly assigned to the current user.
- Common operational status contract shared by Home cards.
- Source work generation rules for each work type.
- First DB/API read-model direction before implementation.

Out of scope:

- Completing, cancelling, claiming, billing, charting, result confirmation, or messaging directly from Home.
- Real external provider integrations, payment provider side effects, email/KakaoTalk sending, PACS/device integration, or real customer/patient data.
- Final production security/compliance claims.
- Full SLA policy for every work type. Home v0 avoids official `지연` semantics until SLA rules are approved.

## Product Policy

### Operating Date

`오늘` means the selected hospital operating day, not a rolling timestamp window.

MVP rule:

- Use the workspace local date as `selectedOperatingDate`.
- Include same-day work and unfinished carry-over work.
- Defer configurable operating-day start/end time until the hospital supports night shifts or 24-hour operations.

### Default Inclusion

The default board includes:

- Work scheduled for or created on the selected operating day.
- Unfinished work from earlier operating days.
- Work assigned to a person or routed to a team/role queue.
- Attention signals such as urgent, re-request, assignment missing, or long-stay.

The default board excludes:

- Completed work, unless the user expands a completed section or enables `완료 포함`.
- Cancelled work, unless the user expands a cancelled section or enables `취소 포함`.
- Future appointments that are not operationally active for the selected day.
- Pure awareness notifications that do not require action.

### Home Action Boundary

Home is an entry and monitoring surface.

Allowed on Home:

- Keep card bodies noninteractive and open source workflows through card overflow actions.
- Open the exact source work from list rows or their destination overlay. No Home detail drawer.
- Filter, sort, and inspect status.

Not allowed on Home:

- Claim/assign final ownership.
- Complete, cancel, return, bill, pay, chart, or confirm results.
- Send external communications.
- Change source workflow state.

### Card Unit

One operational work item becomes one Home card.

Default rule:

- If one encounter has lab, imaging, dispensing, and billing work, show multiple cards.
- Patient/encounter grouping can be offered as a future alternate view.
- Home cards should keep source workflow identity and route back to the authoritative module.


Current UI and personal-work semantics are defined in [Home Workspace UI Spec](home-v1-ui-spec.md), updated by HOME-PR-014. Source generation remains governed below.

## Common Status Contract

Home status separates **progress state** from **attention signals**.

Progress state answers: where is the work in its lifecycle?

| Home progress state | Meaning | Default visibility | Sort group |
|---|---|---:|---:|
| `waiting` / `대기` | Work exists but has not started. | visible | 3 |
| `in_progress` / `진행중` | Work has started or is actively being handled. | visible | 2 |
| `completed` / `완료` | Work is operationally complete. | collapsed or filter-only | 4 |
| `cancelled` / `취소` | Work should not proceed. | collapsed or filter-only | 5 |

Attention signals answer: why should staff look at this sooner?

| Attention signal | Meaning | Home behavior |
|---|---|---|
| `urgent` / `긴급` | A clinician or source workflow explicitly marked the work urgent. | Highlight and sort above normal work. |
| `re_requested` / `재요청` | The work was returned or requested again for correction/rework. | Highlight and sort near urgent work. |
| `assignment_missing` / `배정 누락` | Neither personal assignee nor team/role queue exists. | Treat as operational warning, not normal unassigned work. |
| `team_queue` / `팀 큐 대기` | No personal assignee, but a responsible team/role queue exists. | Normal team-routed work. |
| `long_stay` / `오래 머묾` | Work has stayed in the same state longer than nearby work or a soft threshold. | Show as attention, but do not call it `지연` yet. |

Do not use official `지연` language in Home v0 unless a work-type-specific SLA or threshold policy is approved.

### Assignment Semantics

| Assignment state | Meaning | Home treatment |
|---|---|---|
| Personal assignment | `assigneeUserId` exists. | Visible to assignee and to hospital-wide board. |
| Team queue | `assigneeUserId` is empty and `teamQueueId` or role queue exists. | Normal queue work; shown in hospital view; excluded from directly assigned personal work. |
| Assignment missing | No personal assignee and no team/role queue. | Warning signal; should be rare and treated as data or routing policy problem. |

`내 업무 보기` includes:

- Personal assignments for the current user.
- Operational reception/reservation assignments containing the current user ID.

Unassigned team work remains in hospital view. `내가 요청한 업무` independently uses requester user ID.

### Default Sort

Within each column or queue-like group, sort by:

1. `urgent`
2. `re_requested`
3. `assignment_missing`
4. `in_progress`
5. `waiting`
6. `completed` when included
7. `cancelled` when included

Within the same bucket, sort older operational work first so stale items surface naturally.

## Work Type Generation Rules

| Work type | Home card creation rule | Operating date rule | Default queue/owner | Completion rule | Source workflow |
|---|---|---|---|---|---|
| Walk-in reception / 외래 접수 | A same-day encounter/reception queue item is created. | Created operating day. | Reception/front-desk queue unless personally assigned. | Encounter leaves active reception/queue state or is cancelled. | Reception |
| Appointment / 예약 | Appointment becomes operational on its scheduled operating day; if checked in today, it becomes today's reception work. | Scheduled operating day, not original booking date. | Reception/front-desk queue. | Checked in, completed, no-show/cancelled, or converted to encounter. | Reception calendar |
| Consultation / 진료 | Reception queue enters consultation-ready or consultation-waiting state. | Encounter operating day plus unfinished carry-over. | Veterinarian or consultation queue. | Consultation starts/completes, assignee changes, or encounter closes/cancels. | Chart |
| Lab / 임상병리 | Chart order confirmation creates a lab fulfillment work item. | Order confirmed operating day plus unfinished carry-over. | Lab team queue unless personally assigned. | Lab work item completed/cancelled/returned. | Lab |
| Imaging / 영상 | Chart order confirmation creates an imaging fulfillment work item. | Order confirmed operating day plus unfinished carry-over. | Imaging team queue unless personally assigned. | Imaging work item completed/cancelled/returned. | Imaging |
| Dispensing / 조제 | Chart order confirmation creates a dispensing fulfillment work item. | Order confirmed operating day plus unfinished carry-over. | Dispensing team queue unless personally assigned. | Dispensing work item completed/cancelled/returned. | Dispensing/treatment |
| Treatment / 처치 | Chart order confirmation creates a treatment fulfillment work item. | Order confirmed operating day plus unfinished carry-over. | Treatment team queue unless personally assigned. | Treatment work item completed/cancelled/returned. | Dispensing/treatment |
| Billing / 수납 | Server creates or refreshes a billing/invoice candidate after `Order 청구` or another approved billing-candidate event. | Candidate created operating day plus unfinished/unpaid carry-over. | Billing/front-desk queue unless personally assigned. | Payment completed, explicit unpaid/deferred handling, cancellation, or invoice closure. | Billing |
| Inpatient / 입원 | Future: inpatient admission or care schedule creates inpatient operational work. | Admission/care operating day plus active inpatient carry-over. | Inpatient team queue unless personally assigned. | Care item completed/cancelled or patient discharged. | Inpatient |

## Board And Side Panel Policy

### Main Board

The main board shows all visible hospital work for the selected operating day.

Recommended columns:

- 접수/예약
- 진료
- 임상병리
- 영상
- 조제/처치
- 수납
- 입원, when included

Top controls:

- Operating date: today, previous/next day, date picker.
- `전체 흐름`
- `내 업무 보기`
- `배정 누락`
- `긴급/재요청`
- `완료 포함`
- `취소 포함`
- Filters for assignee, team/queue, work type, and progress state.

### Side Panel

The side panel is not a second full board. It surfaces attention items users should not have to find manually.

Recommended groups:

- 긴급/재요청
- 배정 누락
- 오래 머문 업무
- 접수 후 오래 대기

`오래 머문 업무` is a soft attention lens. It should not imply official SLA breach until threshold policy exists.

## DB/API Direction

Home should not merge unrelated module fixtures on the client.

Recommended read endpoint:

```text
GET /api/workspaces/[workspaceId]/operations/work-items?date=YYYY-MM-DD&includeCompleted=false&includeCancelled=false&scope=all|mine
```

Response shape:

| Field | Meaning |
|---|---|
| `operatingDate` | Selected workspace operating date. |
| `items` | Normalized operational work items. |
| `summary` | Counts by type, progress state, assignment state, and attention signal. |
| `sourceStatus` | `live`, `partial`, `empty`, `permission_denied`, or `error`. |
| `accessIssues` | Optional per-source read limitations when the result is partial. |

Recommended normalized item shape:

| Field | Meaning |
|---|---|
| `id` | Stable Home item id. |
| `workspaceId` | Workspace scope. |
| `sourceType` | `reception`, `appointment`, `consultation`, `lab`, `imaging`, `dispensing`, `treatment`, `billing`, `inpatient`. |
| `sourceId` | Source table/work item id. |
| `encounterId` | Encounter context when available. |
| `patientId`, `guardianId` | Context ids when user may view them. |
| `title` | Card title. |
| `patientName`, `guardianName` | Display context when permitted. |
| `progressState` | Home common progress state. |
| `attentionSignals` | Array of Home attention signals. |
| `assigneeUserId`, `assigneeName` | Personal assignment when present. |
| `teamQueueId`, `teamQueueLabel` | Team/role queue when present. |
| `requestedAt` | Source request/creation timestamp. |
| `stateEnteredAt` | Timestamp when current source state began. |
| `operatingDate` | Date used for Home inclusion. |
| `sourceHref` | Source workflow URL. |
| `drawerSummary` | Bounded detail text for the Home drawer. |
| `permissionMode` | `full`, `redacted`, or `hidden`. |

Implementation should prefer a server-side aggregate/read model or RPC over client-side multi-fetch aggregation, because permission, workspace scoping, partial failure, and source freshness must be handled consistently.

## Mock And Failure Policy

- Cheongdam/prepared-clinic Home operations must not fall back to mock tasks.
- API empty means no source work exists for the selected operating date and carry-over rules.
- API error must render retryable failure, not `원내 업무가 없습니다`.
- Permission denial must render a permission state or redacted cards based on role policy.
- Partial source failure must not silently hide work; expose `sourceStatus: partial` and a visible warning.

## Implementation Status And Remaining Follow-Up

HOME-PR-011 completed the first implementation pass for:

1. Common Home operations progress states and attention signals.
2. Source query aggregation through an additive RPC/read model.
3. Mockless Cheongdam Home API adoption for main board and side panel.
4. Empty/error/permission-safe UI states where API failure is not rendered as no work.
5. Focused coverage for permission denial, `scope=mine`, additive migration shape, API error UI, empty UI, role/team queue behavior, and drawer/navigation boundaries.

Remaining follow-up:

- `partial` source-read handling when the aggregate is split into independently failure-tolerant source adapters.
- Actual `접수` queue writer and creation rule, if the product decides registration itself should generate a distinct Home card.
- Source-specific `long_stay` thresholds after SLA policy is approved.
- Chart/order urgent-request authoring UI.
- Inpatient operations v2.

## Acceptance Criteria

- Home `원내 현황` shows work from all active source workflows that satisfy the operating-date and carry-over rules.
- `내 업무` separates directly assigned and actor-requested work; team availability is not personal assignment.
- Completed/cancelled work is hidden by default and only shown when expanded or included by filter.
- `배정 누락` is treated as a warning, not normal unassigned work.
- Home does not claim, complete, cancel, bill, or mutate source work.
- Source workflow screen remains authoritative for all state changes.
- API errors and partial reads are not rendered as empty states.

## Resolved Owner Decisions And Follow-Up

- `오늘` is the hospital operating day.
- Completed/cancelled work is hidden by default and appears only through `완료 포함` / `취소 포함`.
- `long_stay` is a soft attention signal, not official `지연`.
- `urgent` is reserved in the contract until chart/order urgent-request creation exists.
- Billing is shown as unit work items in v1.
- Inpatient is v2.
- Future guest/restricted users should see a permission state for `원내 현황` until a redacted-card policy is approved.

## Source Docs

- `docs/product/features/home/home-work-generation-rules-v0.md`
- `docs/product/features/home/home-v1-ui-spec.md`
- `docs/product/domain/order-fulfillment-handoff.md`
- `docs/engineering/data-model/order-fulfillment-handoff-contract.md`


### Personal Work Today-only Follow-up — 2026-09-08

내 업무 has no date navigator. Both assigned and requested tabs query and group work against the current workspace operating day, ignoring any legacy saved personal date. 오늘 할 업무 and 이전 미완료 remain; search, completed inclusion and source navigation are unchanged. 원내 현황 retains its independent selected date and navigator.
