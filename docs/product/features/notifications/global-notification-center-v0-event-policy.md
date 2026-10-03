---
id: "NOTIFICATIONS-V0-EVENT-POLICY"
status: approved
area: product
doc_type: feature-policy
related_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
related_work:
  - "docs/work/notifications/NOTIFICATION-PR-002-event-matrix-ux-badge-toast-policy.md"
  - "docs/work/notifications/NOTIFICATION-PR-006-v0-event-matrix-fixtures.md"
  - "docs/work/notifications/NOTIFICATION-PR-009-toast-stack-status-variants.md"
  - "docs/work/notifications/NOTIFICATION-PR-012-event-ui-surface-qa.md"
  - "docs/work/notifications/NOTIFICATION-PR-013-focused-state-regression-tests.md"
  - "https://linear.app/deny-93/issue/DEN-396/00-02-finalize-event-matrix-ux-writing-rules-and-badgetoast-policy"
last_updated: "2026-10-03"
---

# Global Notification Center v0 Event Policy

## Purpose

This document finalizes the v0 event matrix, UX writing rules, badge policy, toast policy, and dedupe policy for the global notification center.

Use this after the base contract:

- `docs/product/features/notifications/global-notification-center-v0-contract.md`

## Event Matrix

| Event key | Trigger | Recipient | Requires action | Badge count | Toast policy | Priority | Source target | Row title | Detail |
|---|---|---|---:|---:|---|---|---|---|---|
| `order_urgent_handoff` | Order owner or performer explicitly marks urgent handoff. Do not auto-create from abnormal values alone. | Assigned veterinarian, order owner, or current responsible user. If owner is missing, role queue is drawer-only. | true | true | `immediate` | `urgent` | Order detail or source module queue | `{patient_name} {order_name}을 빠르게 확인해 주세요` | `{requester}가 긴급 전달로 표시했습니다. 원본 오더와 메모를 먼저 확인하세요.` |
| `order_recheck_requested` | Veterinarian, lab/imaging/dispensing/inpatient staff requests recheck, retry, or missing input from a user or role. | Requested user. If no user is specified, requested role queue. | true | true | `role_active` | `high` | Order detail or source module queue | `{patient_name} {order_name} 재확인을 진행해 주세요` | `{requester}가 {reason} 확인을 요청했습니다.` |
| `assigned_order_completed` | An order assigned to the current user or active role changes to completed and has not been reviewed by that recipient. | Order assignee or assigned veterinarian. | true | true | `role_active` | `normal` | Order detail or encounter timeline | `{patient_name} {order_name}이 완료되었습니다` | `담당자 확인 대기 · 완료 결과를 확인하고 다음 업무에 반영하세요.` |
| `clinical_result_completed` | Lab/clinical result queue item is completed and assigned veterinarian review is still pending. | Assigned veterinarian. If unassigned, veterinarian role queue. | true | true | `role_active` | `normal` | Lab result screen | `{patient_name} {test_name} 결과가 도착했습니다` | `담당 수의사 확인 대기 · 결과 화면에서 세부 수치를 확인할 수 있습니다.` |
| `device_result_received` | A lab device sends a result that can be matched to an order or encounter. Matching failure is inline-first for lab staff. | Assigned veterinarian and lab staff. | true | true | `inline_first` when matching failed, otherwise `role_active` | `normal` | Device result detail or lab result screen | `{patient_name} {device_name} 결과가 도착했습니다` | `연동 장비에서 결과를 보냈습니다. 원본 결과와 연결된 오더를 확인하세요.` |
| `imaging_result_completed` | Imaging capture or report is completed and assigned veterinarian review is pending. | Assigned veterinarian and imaging staff. | true | true | `role_active` | `normal` | Imaging result or report screen | `{patient_name} {imaging_name} 판독이 완료되었습니다` | `담당 수의사 확인 대기 · 영상과 판독 소견을 확인하세요.` |
| `waiting_over_30m` | Reception waiting state lasts at least 30 minutes and guardian guidance has not been recorded. | Desk role. Veterinarian/admin are drawer-only or flow summary by default. | true | true | `role_active` for desk, otherwise `drawer_only` | `normal` | Reception waiting queue | `{patient_name} 보호자에게 대기 시간을 안내해 주세요` | `접수 후 30분이 지났습니다. 예상 대기 시간을 안내하거나 접수 상태를 조정해야 합니다.` |
| `dispensing_treatment_completed` | Dispensing/treatment queue item is completed and reflected in veterinarian review or billing-ready flow. If review is required, create a separate action event. | Assigned veterinarian, dispensing/treatment staff, billing role. | false | false | `source_context_only` or `drawer_only` | `reference` | Dispensing/treatment detail or encounter timeline | `{patient_name} {order_name}이 완료되었습니다` | `조제/처치 상태가 완료로 변경되어 다음 업무에 반영되었습니다.` |
| `billing_waiting_ready` | Clinical, lab, imaging, dispensing, and treatment orders are ready to be reviewed as billing candidates. Billing amount verification/blocking is excluded. | Billing role and desk role. | false | false | `source_context_only` or `drawer_only` | `reference` | Billing candidate screen | `{patient_name} 수납 준비가 완료되었습니다` | `완료된 오더가 수납 후보에 반영되었습니다. 보호자 안내를 준비할 수 있습니다.` |
| `inpatient_care_delayed` | Inpatient care, medication, or vital check order is past its scheduled time and has no completed or held record. | Inpatient staff and assigned veterinarian. | true | true | `role_active` | `high` | Inpatient care board or chart | `{patient_name} {care_name} 예정 시간이 지났습니다` | `입원 오더의 예정 시간이 지났습니다. 담당자가 수행 상태를 확인해야 합니다.` |

## Surface Policy

| Surface | Use when | Do not use for |
|---|---|---|
| Drawer row | Any v0 notification that should remain reviewable after the moment passes | Audit retention or final clinical/billing action |
| Toast | The current user or active role should notice the event immediately | Reference-only updates, broad notices, or another role's low-priority queue |
| Inline alert | The current source workflow must explain a recoverable problem or blocked state | Temporary awareness-only updates |
| Drawer-only | The event is useful context but does not require immediate action from the current user | Urgent direct requests to the current recipient |

Rules:

- Drawer rows include both badge-count and drawer-only notifications.
- The shell badge counts only unread rows with `badge_count === true`.
- Toasts do not replace drawer persistence.
- Inline alerts should remain inside the source workflow until the user understands or resolves the source problem.

Implementation QA status as of 2026-06-03:

- Every v0 event key has a synthetic fixture.
- Drawer visibility is required for every fixture.
- `drawer_only` events are suppressed from toast.
- `inline_first` matching-failure events prefer inline alert/fallback recovery over toast.
- `role_active` toasts are gated by current recipient ownership.
- `source_context_only` toasts are gated by current source workflow proximity.
- Source action labels are tested to remain navigation/detail actions, not final workflow completion actions.

## Badge Policy

Use this resolver:

```ts
unread && badge_count === true
```

`badge_count` should be true only when:

- the recipient is the current user or active role, and
- the event can cause same-day workflow delay or missed follow-up if ignored, and
- the event is not merely reference/status sharing.

Do not:

- count all unread notifications,
- infer badge count from priority color,
- count archived rows in the default badge,
- count drawer-only/reference notifications.

## Toast Policy

Show at most 3 toasts at the same time.

Queue behavior:

- The fourth and later toasts wait in an internal queue.
- When a visible toast dismisses, show the next queued toast.
- New urgent or recheck toasts may be placed at the top of the visible stack.
- A toast with an existing `dedupe_key` updates/bump the existing toast instead of appending.

Lifetime:

- Normal toasts may auto-dismiss.
- Urgent/recheck toasts may remain longer.
- Exact duration is an implementation setting, but queue release must happen after dismissal.

Actions:

- Primary action always opens the source workflow in the current tab.
- Secondary toast action is `나중에 보기`.
- Drawer row secondary action is `보관`.
- Toast actions must not perform final clinical, billing, or reception workflow actions.

## UX Writing Rules

### Work Type Badge

Use 1-2 words for the domain only.

Allowed examples:

- `접수`
- `진료`
- `검사`
- `영상`
- `조제`
- `수납`
- `입원`

Do not put patient name, urgency, status, or priority in the work type badge.

### Title

Use this order:

```text
{target} + {event} + {needed user action}
```

If the user needs to act, use a polite command form.

Examples:

- `{patient_name} {order_name}을 빠르게 확인해 주세요`
- `{patient_name} {order_name} 재확인을 진행해 주세요`
- `{patient_name} 보호자에게 대기 시간을 안내해 주세요`

### Detail

One short sentence or phrase group should explain:

- why the notification exists,
- who or what caused it,
- where the user should verify details.

Do not:

- replace clinical judgment,
- state a diagnosis,
- instruct payment, chart completion, medication, or treatment finalization inside the notification.

### Action Labels

Primary action labels must be source navigation labels:

- `오더 열기`
- `오더 화면 열기`
- `검사 결과 열기`
- `장비 결과 열기`
- `영상 결과 열기`
- `대기열 열기`
- `조제 내역 열기`
- `수납 후보 열기`
- `입원 처치표 열기`

Secondary labels:

- Toast: `나중에 보기`
- Drawer row: `보관`
- Optional drawer state action: `읽음 처리`

Do not use action labels that imply final workflow completion, such as `처치 완료`, `수납 확정`, `진료 완료`, or `결제 완료`.

### Time

Use relative time:

- `방금`
- `2분 전`
- `1시간 전`

## Dedupe And Update/Bump

Use the `dedupe_key` from the v0 contract.

Unread repeated events with the same patient, same order when applicable, and same event key must update/bump the existing notification.

Update/bump may change:

- `updated_at`,
- relative time,
- detail preview,
- `bump_count` or occurrence count,
- metadata needed to explain the latest state.

Do not append another row for the same unread event.

Persisted reception waiting alerts are the threshold exception: for the same
workspace, normalized event scope, and queue-entry dedupe key, the first eligible
poll creates a `high` alert at 30 minutes; the first poll at or beyond 60 minutes
promotes it to `urgent` once. Repeated polls and late `high` requests return
`unchanged`. All per-user read/archive state survives both repeats and escalation.
The notification text retains the elapsed minutes observed at creation or
escalation; it is not a live elapsed-time counter. Cancel/restore keeps the same
queue entry and acknowledgement; a new entry has an independent dedupe key.
This database contract is prepared locally in
`docs/work/notifications/NOTIFICATION-PR-028-waiting-threshold-idempotency.md`;
release requires the additive function migration.

Read or archived repeated events should be handled by the implementation issue that owns state behavior. The product expectation is that repeated operational signals do not create noisy duplicate rows.

## Excluded Event Classes

The v0 matrix does not include:

- live push delivery,
- service worker notifications,
- provider/device real delivery,
- Kakao, SMS, or email,
- remote Supabase migration, RLS, or live validation,
- notification publisher/admin system,
- free mention/comment notification system,
- billing amount verification or blocking alerts,
- security policy alerts,
- final clinical, billing, or reception action execution inside a notification.

## Acceptance Checks

- Every v0 event has trigger, recipient, `requires_action`, `badge_count`, `toast_policy`, source target, title, and detail.
- Badge cannot be interpreted as total unread.
- Drawer-only/reference events are explicitly excluded from the shell badge.
- Toast max-3 and queue behavior are testable.
- Dedupe/update-bump is defined for repeated order events.
- Copy does not direct the user to complete clinical, billing, or reception final actions inside the notification.
