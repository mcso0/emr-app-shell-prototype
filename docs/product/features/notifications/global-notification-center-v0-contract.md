---
id: "NOTIFICATIONS-V0-CONTRACT"
status: approved
area: product
doc_type: feature-contract
related_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/product/features/home/home-v1-ui-spec.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
related_work:
  - "docs/work/notifications/NOTIFICATION-PR-001-v0-contract-fixture-schema.md"
  - "docs/work/notifications/NOTIFICATION-PR-002-event-matrix-ux-badge-toast-policy.md"
  - "docs/work/notifications/NOTIFICATION-PR-003-shell-drawer-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-004-row-filter-read-archive-states.md"
  - "docs/work/notifications/NOTIFICATION-PR-005-localstorage-role-queue-disclaimer.md"
  - "docs/work/notifications/NOTIFICATION-PR-006-v0-event-matrix-fixtures.md"
  - "docs/work/notifications/NOTIFICATION-PR-007-badge-recipient-action-rules.md"
  - "docs/work/notifications/NOTIFICATION-PR-008-dedupe-update-bump-rules.md"
  - "docs/work/notifications/NOTIFICATION-PR-009-toast-stack-status-variants.md"
  - "docs/work/notifications/NOTIFICATION-PR-010-source-navigation-fallback-detail.md"
  - "docs/work/notifications/NOTIFICATION-PR-011-dirty-state-notification-navigation-guard.md"
  - "docs/work/notifications/NOTIFICATION-PR-012-event-ui-surface-qa.md"
  - "docs/work/notifications/NOTIFICATION-PR-013-focused-state-regression-tests.md"
  - "https://linear.app/deny-93/issue/DEN-395/00-01-align-notification-v0-implementation-contract-and-fixture-schema"
  - "https://linear.app/deny-93/issue/DEN-396/00-02-finalize-event-matrix-ux-writing-rules-and-badgetoast-policy"
last_updated: "2026-07-05"
---

# Global Notification Center v0 Contract

## Purpose

The global notification center is the app-level staff in-app channel for events that a user or active role should know about while working in CLAiR EMR.

v0 uses a right-side drawer opened from the app shell notification button. It lets the user scan notifications, mark them read, archive them, and navigate to the source workflow. It does not replace Home My Work, source module queues, or audit logs.

## Product Boundary

| Area | v0 contract |
|---|---|
| Surface | Right-side drawer from the app shell top-bar notification button; notifications are not a left nav rail item |
| Storage | Synthetic fixtures plus `localStorage` read/archive state |
| Badge count | `unread && badge_count === true` only |
| Primary action | Navigate the current tab to the source workflow |
| Dirty navigation | Confirm before navigation when current workflow has unsaved changes |
| Dedupe | Update/bump the existing unread row for the same patient + order + event |
| Toast stack | Show at most 3 concurrent toasts; queue later toasts |
| Role queue state | Local browser/user state only; no cross-client read/archive sync |

## Implementation Status

As of 2026-06-03, the v0 contract is implemented for the mock/local-first app shell boundary:

| Area | Status |
|---|---|
| Shell drawer | Implemented with badge, right-side drawer, filters, read/archive, restore, and all-read controls |
| Fixtures | Implemented for all 10 v0 event keys with required contract fields |
| Badge rules | Implemented with recipient-aware `badge_count` resolver; unread reference rows do not count |
| Local state | Implemented with `clair.notifications.v0.read` and `clair.notifications.v0.archive` localStorage keys |
| Dedupe/update-bump | Implemented for repeated unread `dedupe_key` rows |
| Toast policy | Implemented as stack/queue/dedupe/status variant rules and card component; live event emission remains out of v0 |
| Source navigation | Implemented for current-tab source routes with fallback detail for missing source |
| Dirty navigation | Implemented with the required confirmation copy before source route navigation |
| Surface QA | Covered by focused tests for drawer, toast, inline-first, drawer-only, and source-context policies |

The implementation remains synthetic and local-first. It does not include live push, service workers, provider delivery, Kakao/SMS/email, remote Supabase migration/RLS/live validation, or cross-client role queue read/archive sync.

## v0 Event Scope

Every v0 fixture and event rule must be able to represent these events:

| Event key | Product event | Default source |
|---|---|---|
| `order_urgent_handoff` | 오더 긴급 전달 | Order detail or source module queue |
| `order_recheck_requested` | 오더 재요청/재확인 요청 | Order detail or source module queue |
| `assigned_order_completed` | 담당 오더 완료 안내 | Order detail or encounter timeline |
| `clinical_result_completed` | 검사/임상 결과 완료 | Lab result screen |
| `device_result_received` | 검사 장비 결과 전달 | Lab result matching screen |
| `imaging_result_completed` | 영상 결과/판독 완료 | Imaging result/report screen |
| `waiting_over_30m` | 대기 30분 초과 | Reception waiting queue |
| `dispensing_treatment_completed` | 조제/처치 완료 | Dispensing/treatment detail or encounter timeline |
| `billing_waiting_ready` | 수납 대기 전환 | Billing candidate screen |
| `inpatient_care_delayed` | 입원 처치/투약 지연 | Inpatient care board or chart |

## Event Rule Fields

Implementation fixtures and resolvers should use these fields. UI copy may be Korean, but field names stay stable.

| Field | Required | Meaning |
|---|---:|---|
| `id` | Yes | Stable notification instance ID |
| `event_key` | Yes | One of the v0 event keys |
| `dedupe_key` | Yes | Stable key for same patient + order + event update/bump |
| `title` | Yes | User-facing notification title |
| `preview` | Yes | Short user-facing summary |
| `domain` | Yes | `reception`, `chart`, `lab`, `imaging`, `dispensing_treatment`, `billing`, or `inpatient` |
| `priority` | Yes | `urgent`, `high`, `normal`, or `reference` |
| `requires_action` | Yes | Whether the recipient must act or confirm in the source workflow |
| `badge_count` | Yes | Whether unread state contributes to the shell badge |
| `toast_policy` | Yes | `immediate`, `role_active`, `source_context_only`, `drawer_only`, or `inline_first` |
| `recipient` | Yes | Direct user, active role, or role queue target |
| `source` | Yes | Source workflow route contract and fallback metadata |
| `created_at` | Yes | Initial event timestamp |
| `updated_at` | Yes | Last update/bump timestamp |
| `read_state_key` | Yes | Local read state key |
| `archive_state_key` | Yes | Local archive state key |

Optional fields:

| Field | Meaning |
|---|---|
| `patient_context` | Synthetic patient/guardian/encounter display context |
| `order_context` | Synthetic order name, category, status, or performer context |
| `requester` | User or role that requested urgent handoff/recheck |
| `badge_reason` | Short internal explanation for why `badge_count` is true |
| `fallback_reason` | Reason shown when source navigation cannot open the target |
| `bump_count` | Count of repeated updates for the same dedupe key |

## Fixture Shape

Use synthetic demo data only.

Detailed event matrix, UX writing, badge, toast, and dedupe policy lives in:

- `docs/product/features/notifications/global-notification-center-v0-event-policy.md`

```ts
type NotificationFixture = {
  id: string;
  event_key:
    | "order_urgent_handoff"
    | "order_recheck_requested"
    | "assigned_order_completed"
    | "clinical_result_completed"
    | "device_result_received"
    | "imaging_result_completed"
    | "waiting_over_30m"
    | "dispensing_treatment_completed"
    | "billing_waiting_ready"
    | "inpatient_care_delayed";
  dedupe_key: string;
  title: string;
  preview: string;
  domain:
    | "reception"
    | "chart"
    | "lab"
    | "imaging"
    | "dispensing_treatment"
    | "billing"
    | "inpatient";
  priority: "urgent" | "high" | "normal" | "reference";
  requires_action: boolean;
  badge_count: boolean;
  toast_policy:
    | "immediate"
    | "role_active"
    | "source_context_only"
    | "drawer_only"
    | "inline_first";
  recipient: {
    kind: "user" | "active_role" | "role_queue";
    id: string;
    label: string;
  };
  source: {
    kind:
      | "order"
      | "lab_result"
      | "imaging_result"
      | "reception_queue"
      | "dispensing_treatment"
      | "billing_candidate"
      | "inpatient_care"
      | "fallback_detail";
    route?: string;
    entity_id?: string;
    fallback_reason?: "missing_source" | "closed_encounter" | "permission_unavailable";
  };
  patient_context?: {
    patient_name: string;
    guardian_name?: string;
    encounter_label?: string;
  };
  order_context?: {
    order_name: string;
    order_id?: string;
  };
  requester?: {
    label: string;
    role?: string;
  };
  badge_reason?: string;
  created_at: string;
  updated_at: string;
  read_state_key: string;
  archive_state_key: string;
  bump_count?: number;
};
```

Example:

```ts
{
  id: "notif-demo-cbc-result-001",
  event_key: "clinical_result_completed",
  dedupe_key: "patient-kong-order-cbc-clinical_result_completed",
  title: "콩이 CBC 결과가 도착했습니다",
  preview: "담당 수의사 확인 대기 · 결과 화면에서 세부 수치를 확인할 수 있습니다.",
  domain: "lab",
  priority: "high",
  requires_action: true,
  badge_count: true,
  toast_policy: "role_active",
  recipient: {
    kind: "active_role",
    id: "vet",
    label: "담당 수의사"
  },
  source: {
    kind: "lab_result",
    route: "/w/clair-demo/lab-imaging?tab=lab&result=cbc-kong",
    entity_id: "lab-result-cbc-kong"
  },
  patient_context: {
    patient_name: "콩이",
    guardian_name: "김하늘 보호자"
  },
  order_context: {
    order_name: "CBC",
    order_id: "order-demo-cbc-kong"
  },
  badge_reason: "담당 수의사가 확인하지 않으면 후속 진료 판단이 지연될 수 있음",
  created_at: "2026-06-02T09:40:00+09:00",
  updated_at: "2026-06-02T09:40:00+09:00",
  read_state_key: "clair.notifications.v0.read",
  archive_state_key: "clair.notifications.v0.archive"
}
```

## Badge Policy

The shell badge count is:

```ts
unread && badge_count === true
```

Rules:

- Do not count all unread notifications.
- Do not infer badge inclusion from severity color or priority label alone.
- `requires_action` and recipient matching should inform event rules, but the resolver must count only `badge_count === true`.
- Read notifications do not count.
- Archived notifications do not count in the default badge.
- Drawer-only/reference notifications may be unread without contributing to the badge.

## Read And Archive Policy

Read/archive state is local-first in v0:

- Store read IDs in `localStorage` under `clair.notifications.v0.read`.
- Store archived IDs in `localStorage` under `clair.notifications.v0.archive`.
- Treat read as acknowledged/seen, not workflow completion.
- Treat archive as list cleanup, not audit deletion.
- When fixtures change, ignore unknown local IDs and keep the UI stable.

Role queue limitation:

> v0 역할 큐 알림의 읽음/보관 상태는 현재 브라우저에만 저장됩니다. 다른 사용자나 다른 브라우저와 동기화되지 않습니다.

## Source Navigation Policy

Primary notification action opens the source workflow in the current tab.

Before navigation, if the current workflow has dirty state, show this confirmation:

```text
작업 중인 내용이 저장되지 않을 수 있습니다. 이동하시겠습니까?
```

Fallback rules:

- If source entity is missing, show notification detail fallback with `missing_source`.
- If encounter/source is closed, show fallback with closed-state context.
- If the user lacks a supported source path in the current mock boundary, show fallback with `permission_unavailable`.
- Do not silently fail.
- Do not perform final clinical, billing, or reception action inside the notification.

## Dedupe And Update/Bump Policy

For unread notifications with the same `dedupe_key`, update the existing row instead of appending a new row.

The `dedupe_key` must represent:

```text
same patient + same order when applicable + same event_key
```

Update/bump may change:

- `updated_at`
- `preview`
- relative time display
- `bump_count`
- event metadata that helps the user understand the latest state

Different patient, order, or event keys remain separate notifications.

## Toast Policy

Toast display is separate from drawer persistence:

| Policy | Behavior |
|---|---|
| `immediate` | Show a toast as soon as the event enters the current user context |
| `role_active` | Show a toast only when the current active role matches the event recipient |
| `source_context_only` | Show a toast only when the user is already near the source context |
| `drawer_only` | Add to drawer only; no toast |
| `inline_first` | Prefer inline alert in the source workflow; drawer may still record the event |

Toast stack rules:

- Show at most 3 toasts at once.
- Queue later toasts until a visible toast dismisses.
- New urgent/recheck toasts may appear at the top of the visible stack.
- Same `dedupe_key` updates/bump the existing toast instead of appending another toast.
- Toast primary action uses the same source navigation and dirty-state guard as drawer rows.

## Out Of Scope

- Live push and service worker notifications.
- Provider/device real event delivery.
- Kakao, SMS, and email notifications.
- Remote Supabase migration, RLS, or live validation.
- Notification publishing/admin system.
- Free mention/comment notification system.
- Final clinical, billing, or reception actions inside the notification.
- Cross-browser or cross-user role queue read/archive sync.

## Acceptance Checks

- All v0 events can be represented by the fixture shape.
- Badge calculation is documented as `unread && badge_count === true`.
- `requires_action`, `badge_count`, and `toast_policy` are explicit event rule fields.
- Local read/archive and role queue non-sync limitations are clear.
- Source missing and permission-unavailable fallbacks are defined.
- Dedupe/update-bump prevents repeated order event row spam.
- Toast max-3 queue policy is defined.
