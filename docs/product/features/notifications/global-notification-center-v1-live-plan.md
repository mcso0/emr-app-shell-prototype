---
id: "NOTIFICATIONS-V1-LIVE-PLAN"
status: draft
area: product
doc_type: feature-plan
type: Product Requirement
title: Global Notification Center v1 Live Plan
description: Draft product and implementation plan for moving staff in-app notifications from v0 local fixtures to a workspace-scoped live notification boundary.
tags:
  - notifications
  - app-shell
  - workspace-scope
  - api-boundary
  - product-mvp
related_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/product/features/home/home-v1-ui-spec.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/engineering/architecture/mock-live-boundary-map.md"
  - "docs/engineering/auth-security/auth-login/live-mvp-audit-event-matrix.md"
related_work:
  - "docs/work/notifications/NOTIFICATION-PR-016-v1-live-api-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-017-v1-visible-drawer-live-api-adoption.md"
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-019-reception-waiting-over-30m-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-020-billing-waiting-ready-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-021-clinical-result-completed-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-022-order-recheck-requested-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-023-db-event-persistence-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-024-db-backed-route-adoption.md"
  - "docs/work/notifications/NOTIFICATION-PR-025-producer-db-persistence-adoption.md"
  - "docs/work/notifications/NOTIFICATION-PR-026-remaining-producer-db-persistence-adoption.md"
last_updated: "2026-07-06"
---

# Global Notification Center v1 Live Plan

## Purpose

Global notifications are the staff-facing in-app channel for operational changes that a user or active role should notice while working in CLAiR EMR.

v1 moves the current v0 notification center from synthetic fixtures plus browser-local state toward a workspace-scoped live notification boundary. It keeps the v0 interaction model: a small top-bar bell opens a right-side drawer, and notification actions route the user to the source workflow.

## Product Decisions

| Decision | v1 direction |
|---|---|
| Primary entry point | Keep the app-shell top-bar bell button as the only primary notification entry point. |
| Nav rail | Do not show notifications as a left nav rail item. Notifications are not a primary workspace module. |
| Home boundary | Do not turn Home into a notification wall. Home may link to actionable work, but notification rows live in the global drawer. |
| Drawer role | The drawer is a triage and review surface, not a final workflow action surface. |
| Badge meaning | Badge means unread actionable notifications for the current user or active role, not total unread rows. |
| Toast meaning | Toasts are interruption-worthy signals only; drawer rows remain the durable in-app review surface. |

## Scope

In scope for v1:

- top-bar bell badge and right-side drawer as the primary surface
- workspace-scoped live notification list API
- server-side recipient and workspace filtering
- read, read-all, archive, restore, and source navigation
- dedupe/update-bump behavior for repeated operational signals
- runtime toast and inline-alert integration for approved event classes
- synthetic/demo-data validation and focused security/denial tests

Out of scope for v1:

- browser/OS push notifications
- service worker delivery
- KakaoTalk, SMS, email, or guardian-facing messaging
- external provider/device delivery guarantees
- admin announcement publishing system
- free mention/comment notification system
- full historical notification page with advanced search
- production launch, real hospital data, or real external-user notification delivery

## Users And Jobs

| User or role | Job |
|---|---|
| Desk / reception | Notice waiting delays, check-in changes, and billing-ready handoff signals without leaving the current module. |
| Veterinarian | Notice result completion, recheck requests, urgent handoffs, and assigned order completion that may affect same-day care. |
| Lab / imaging / treatment staff | Notice recheck requests, source matching failures, and urgent handoffs routed to their active role. |
| Billing staff | Notice billing-ready reference signals and payment-adjacent blockers when a source workflow requires attention. |
| Hospital admin | Review only notifications they are authorized to see; audit/security review remains a separate surface. |

## Surface Specification

### Top-Bar Bell

- Located in the app shell top bar.
- Shows a compact badge only when `badge_count` resolves to at least one current actionable notification.
- Accessible label includes the actionable count, for example `알림 센터 열기, 중요 알림 3개`.
- The left nav rail does not include a notification item.

### Right Drawer

The drawer keeps the existing v0 structure:

- title: `알림`
- count summary: important/actionable count plus unread count
- filters: `전체`, `안 읽음`, `중요`, `보관`
- row actions: open source, mark read, archive, restore
- utility action: mark all read
- fallback detail when the source cannot be opened

Future filters can add domain, priority, or date range after live rows prove useful. Do not add them before there is enough data volume.

### Row Anatomy

Each row should answer four questions in one scan:

| Row part | Purpose |
|---|---|
| Work type badge | Shows the source domain, such as `접수`, `검사`, `영상`, `수납`, or `입원`. |
| Title | Names the patient/source object and the required user attention. |
| Detail | Explains why the notification exists and where to verify it. |
| Metadata | Shows source label, recipient label, and relative time. |
| Primary action | Opens the source workflow only. |
| Secondary action | Marks read, archives, or restores the row. |

Rows must not expose final workflow actions. The notification center can route to work, but source modules own work completion.

### Toasts

- Use the existing max-3 visible toast stack and queue behavior.
- Show toasts only for current recipient-owned notifications whose `toast_policy` allows transient interruption.
- Toast primary action opens the source workflow.
- Toast secondary action dismisses or defers; it must not perform clinical, billing, reception, or treatment completion.

### Inline Alerts

Use inline alerts inside source workflows for recoverable source-local problems, such as device result matching failures. Inline alerts do not replace the drawer row.

## UX Flows

### Flow 1: Scan And Open Source

1. User sees the top-bar bell badge.
2. User opens the drawer.
3. Drawer defaults to non-archived notifications sorted by latest `updated_at`.
4. User scans work type, title, source, recipient, and time.
5. User chooses the source action.
6. The current tab navigates to the source workflow.
7. The notification is marked read for that user before or at source navigation.

Done state:

- Source opens in the same workspace.
- Drawer count and badge update after read state changes.
- If the source is already open in another workspace tab, the existing duplicate-tab guard may route the user to the existing tab.

### Flow 2: Read Without Acting

1. User opens the drawer.
2. User reviews a notification but does not need to open the source now.
3. User selects `읽음 처리`.
4. Row remains visible in `전체`; it leaves `안 읽음`.
5. Badge count decreases only if the row was badge eligible.

### Flow 3: Archive And Restore

1. User archives a notification after it is no longer useful.
2. Row leaves default `전체` and appears under `보관`.
3. User can restore it from `보관`.
4. Restored row returns to `전체` with its existing read state.

### Flow 4: Read All

1. User opens a noisy drawer after catching up through source workflows.
2. User selects `전체 읽음`.
3. All currently visible non-archived notifications are marked read for that user.
4. Badge clears when no actionable unread notifications remain.
5. Archived rows are not changed.

### Flow 5: Source Fallback

1. User opens a notification whose source route is unavailable.
2. Server returns `sourceRoute: null` with a fallback reason.
3. Drawer shows fallback detail.
4. User can still read/archive the notification.
5. No cross-workspace route or hidden source payload is exposed.

### Flow 6: Toast To Drawer Continuity

1. A high-attention event is emitted for the current user or active role.
2. Toast appears only if the notification policy allows interruption.
3. The same notification is present in the drawer.
4. User can open source from toast or dismiss toast and review it later in the drawer.

## Event Scope

Phase 1 live candidates:

| Event key | Live trigger | Recipient | Badge | Toast | Notes |
|---|---|---|---:|---:|---|
| `waiting_over_30m` | Reception waiting state reaches 30 minutes and no guardian guidance record exists. | Desk role | Yes | Role-active | Start here because it is operational and low clinical risk. |
| `order_recheck_requested` | Staff explicitly requests recheck/retry/missing input from a user or role. | Requested user or role queue | Yes | Role-active | First live wiring uses a fixed recheck-request route; requires explicit requester and reason. |
| `clinical_result_completed` | Lab result is completed and assigned veterinarian review is pending. | Assigned veterinarian or vet role queue | Yes | Role-active | First live wiring starts from lab result-entry save; display payload must stay minimal and omit raw result values. |
| `billing_waiting_ready` | Completed orders are reflected as billing candidates. | Billing/desk role | No by default | Drawer-only | Reference signal; first live wiring starts from fulfillment completion and vet-reviewed billing sync. |

Keep all v0 event keys in the product matrix, but do not wire every event live in the first v1 implementation pass.

## Data Model Draft

This is a product/API draft, not an approved migration spec.

### `notification_events`

One row represents the latest reviewable notification signal.

| Field | Meaning |
|---|---|
| `id` | Stable notification id. |
| `workspace_id` | Required workspace boundary. |
| `event_key` | Approved notification event key. |
| `dedupe_key` | Stable key for same patient/order/event update-bump. |
| `domain` | Source domain such as reception, chart, lab, imaging, dispensing_treatment, billing, or inpatient. |
| `priority` | urgent, high, normal, or reference. |
| `requires_action` | Whether recipient action or review is required in the source workflow. |
| `badge_count` | Whether unread state may contribute to the top-bar badge after recipient filtering. |
| `toast_policy` | immediate, role_active, source_context_only, drawer_only, or inline_first. |
| `recipient_kind` | direct_user, active_role, or role_queue. |
| `recipient_user_id` | Direct user target when applicable. |
| `recipient_role_id` | Canonical role target when applicable. |
| `source_kind` | order, lab_result, imaging_result, reception_queue, dispensing_treatment, billing_candidate, inpatient_care, or fallback_detail. |
| `source_entity_id` | Source entity id used for authorization and navigation. |
| `source_route` | Server-generated safe source route or null when fallback detail is required. |
| `actor_user_id` | Server-verified actor that caused the event, if applicable. |
| `display_payload` | Minimal safe display payload for title/detail rendering. |
| `created_at` | Initial event timestamp. |
| `updated_at` | Latest update-bump timestamp. |
| `expires_at` | Optional cleanup or stale-row boundary. |

### `notification_user_states`

One row stores per-user interaction state. Role queue state is still materialized per viewing user unless a later claim/ownership model is approved.

| Field | Meaning |
|---|---|
| `workspace_id` | Required workspace boundary. |
| `notification_id` | Notification event id. |
| `user_id` | Viewing user. |
| `read_at` | Null means unread for this user. |
| `archived_at` | Null means active in default drawer filters. |
| `dismissed_toast_at` | Optional transient surface state. |
| `last_opened_source_at` | Optional source navigation telemetry. |

## API Draft

All routes must enforce workspace membership and notification recipient authorization on the server.

| Route | Method | Purpose |
|---|---|---|
| `/api/workspaces/:workspaceId/notifications` | GET | List current user's visible notifications with cursor pagination and optional filter. |
| `/api/workspaces/:workspaceId/notifications/counts` | GET | Return badge, unread, important, and archived counts for the current user. |
| `/api/workspaces/:workspaceId/notifications/:notificationId/read` | POST | Mark one visible notification read for the current user. |
| `/api/workspaces/:workspaceId/notifications/read-all` | POST | Mark all currently visible notifications read for the current user. |
| `/api/workspaces/:workspaceId/notifications/:notificationId/archive` | POST | Archive one visible notification for the current user. |
| `/api/workspaces/:workspaceId/notifications/:notificationId/restore` | POST | Restore one visible archived notification for the current user. |

Notification creation should start as an internal server helper used after approved workflow mutations. Do not expose a generic client-side create-notification route in v1.

### Query Parameters

`GET /api/workspaces/:workspaceId/notifications`

| Parameter | Values | Default | Meaning |
|---|---|---|---|
| `filter` | `all`, `unread`, `important`, `archived` | `all` | Server-side row filter matching the drawer filter. |
| `limit` | 1-50 | 20 | Maximum rows returned. |
| `cursor` | opaque string | none | Pagination cursor for older rows. |

Invalid filter or limit values return a 400 response. A missing or invalid session returns 401. A valid session without workspace membership or recipient visibility returns 403 or an empty authorized list depending on the failure.

### List Response Shape

```ts
type NotificationListResponse = {
  workspaceId: string;
  notifications: Array<{
    id: string;
    eventKey: string;
    dedupeKey: string;
    domain: string;
    priority: "urgent" | "high" | "normal" | "reference";
    requiresAction: boolean;
    badgeCount: boolean;
    toastPolicy: string;
    title: string;
    preview: string;
    detail: string;
    workTypeLabel: string;
    sourceLabel: string;
    sourceActionLabel: string;
    sourceKind: string;
    sourceEntityId: string | null;
    sourceRoute: string | null;
    recipientKind: "user" | "active_role" | "role_queue";
    recipientId: string;
    recipientLabel: string;
    fallbackReason?: "missing_source" | "closed_encounter" | "permission_unavailable";
    issuedAtLabel: string;
    createdAt: string;
    updatedAt: string;
    bumpCount?: number;
    readAt: string | null;
    archivedAt: string | null;
  }>;
  counts: {
    badge: number;
    unread: number;
    important: number;
    archived: number;
  };
  nextCursor: string | null;
  enforcedBy: "live-notification-reader";
};
```

## Security And Privacy Rules

- Client-only role matching is not authorization.
- Every list and mutation route must verify workspace membership.
- Role targeting must use canonical role/permission sources, not job-position display metadata.
- Source entity workspace must match the notification workspace before returning a route.
- Notification display payload must not include full SOAP notes, raw lab payloads, full guardian contact data, payment details, or provider secrets.
- If a user can see a notification but cannot open the source anymore, show fallback detail instead of leaking source data or routing across boundaries.
- Audit events and notifications are related but separate. Do not use audit retention as the user-facing notification store.

## Exception Cases

| Case | Expected behavior |
|---|---|
| Empty feed | Drawer shows empty state with no badge. |
| API loading | Keep bell usable; drawer shows loading rows or compact loading state. |
| API failure | Drawer shows retryable failure; do not silently show stale local fixtures as live truth. |
| Permission denied | Show permission state and suppress source route. |
| Source missing | Mark read if the user opened it, then show fallback detail. |
| Source closed | Show closed encounter/source fallback detail. |
| Cross-workspace source mismatch | Deny on server and return no route. |
| Repeated unread event | Update/bump the existing row by `dedupe_key`. |
| Repeated read or archived event | Reopen as a new unread signal only when the source workflow truly emitted a new event. |
| Dirty current workflow | Confirm before notification source navigation. |
| Notification creation fails after source mutation | Source mutation remains authoritative; log/observe notification creation failure for retry or triage. |

## Implementation Plan

1. Entry point cleanup and docs alignment
   - Remove nav-rail notification entry.
   - Keep the top-bar bell as the primary entry point.
   - Add this v1 planning draft and link it from notification docs.

2. Live contract and type adapter
   - Split fixture shape from API DTO shape.
   - Preserve v0 fixture tests while adding v1 DTO contract tests.
   - Keep patient/order/source context out of the API response unless it is explicitly part of the safe display payload.

3. Server read/state API
   - Implement list/count/read/archive/restore routes against local/dev synthetic data first.
   - Add server-side workspace, membership, recipient, and source entity checks.
   - Store read/archive state per user in a local/dev server store before any DB migration is approved.

4. Event producers
   - Start with `waiting_over_30m`, `order_recheck_requested`, `clinical_result_completed`, and `billing_waiting_ready`.
   - Emit notifications only after the source workflow mutation succeeds.

5. Runtime surfaces
   - Connect live list/counts to the bell and drawer.
   - Connect approved live events to toast and inline-alert policy.
   - Keep fallback detail and dirty-navigation guard.

6. Verification and hardening
   - Add API denial tests for cross-workspace and inactive membership cases.
   - Add recipient-role and job-position separation tests.
   - Add source entity mismatch tests.
   - Add privacy redaction tests.
   - Run focused Playwright coverage for drawer, badge, read/archive, source navigation, toast, and inline fallback.

## Acceptance Criteria

- Nav rail has no notification entry.
- Top-bar bell opens the notification drawer and remains the single primary entry point.
- Badge count means current recipient-owned actionable unread count.
- Live API does not leak cross-workspace or unauthorized recipient notifications.
- Read/archive state is server-backed for the current user.
- Notification actions navigate to source workflows only.
- The AppShell drawer uses the live API once the visible adoption slice is accepted; v0 fixture helpers remain only for fixture policy and regression coverage.

## First Implementation Slice

The first implementation slice should prove the server boundary without changing the visible drawer data source yet.

Deliverables:

- `GET /api/workspaces/:workspaceId/notifications`
- `GET /api/workspaces/:workspaceId/notifications/counts`
- `POST /api/workspaces/:workspaceId/notifications/:notificationId/read`
- `POST /api/workspaces/:workspaceId/notifications/read-all`
- `POST /api/workspaces/:workspaceId/notifications/:notificationId/archive`
- `POST /api/workspaces/:workspaceId/notifications/:notificationId/restore`
- focused tests for membership denial, recipient filtering, source-route workspace safety, read/archive state, and DTO privacy

Non-goals:

- replacing the visible drawer with the live API
- DB migrations or RLS replay
- realtime delivery
- external delivery channels

## Second Implementation Slice

The second implementation slice adopts the live API in the visible AppShell notification drawer.

Implemented deliverables:

- AppShell fetches active and archived notification rows from `/api/workspaces/:workspaceId/notifications`.
- Top-bar badge and drawer count summary use server counts.
- Read, read-all, archive, and restore actions call server mutation routes.
- Drawer source navigation uses only server-sanitized `sourceRoute`; null routes show fallback detail.
- The drawer shows v1 API-backed state copy, loading state, and retryable error state instead of silently falling back to local fixtures.
- Synthetic demo read/archive state is scoped by demo browser session for E2E isolation while workspace membership and recipient filtering still use server actor identity.
- Focused Playwright coverage asserts API calls and server-backed read/archive persistence in the visible drawer.

Still out of scope after this slice:

- DB-backed notification persistence and RLS replay.
- Realtime delivery or polling cadence decisions beyond current on-load/refetch behavior.
- Live event producers from reception, chart, lab, billing, or operations mutations.
- External channels or real customer-facing notifications.

## Third Implementation Slice

The third implementation slice adds the internal server producer foundation that source workflow mutations can call after the source mutation succeeds.

Implemented deliverables:

- Local/dev synthetic notification event store.
- Internal `emitLiveNotificationEvent` helper; no generic client-side create route.
- Dedupe-key upsert behavior for repeated live event signals.
- Bumped events clear stale per-user read/archive state so the new signal becomes unread again.
- Produced notifications flow through the same live reader, membership filter, recipient filter, safe DTO mapping, and source-route safety checks as fixture-backed notifications.
- Focused TDD coverage for event creation, dedupe bump, safe display DTO, and read-state reopen.

Still out of scope after this slice:

- Wiring every source workflow mutation to the producer helper.
- DB-backed notification event persistence and RLS replay.
- Realtime/SSE or polling cadence changes.
- External notification delivery channels.

## Fourth Implementation Slice

The fourth implementation slice wires the first real source workflow/read-model signal to the producer: reception queue waiting-over-30m notifications.

Implemented deliverables:

- Reception queue read model evaluates consultation queue rows that are still waiting at least 30 minutes.
- The reception queue route enables the waiting-over-30m producer path explicitly.
- Emitted notifications target the desk role queue, are badge eligible, and open the source reception queue context.
- The event uses a deterministic 30-minute threshold timestamp so repeated queue reads do not continuously bump the same notification or reopen read state.
- Focused TDD coverage proves front-desk visibility through the notification reader and repeated-read no-op behavior.

Still out of scope after this slice:

- Background scheduler ownership for waiting alerts.
- Clinical result, explicit recheck request, and billing-ready producer wiring.
- DB-backed notification persistence and RLS replay.
- Realtime delivery or external channels.

## Fifth Implementation Slice

The fifth implementation slice wires the next low-risk live source signal to the producer: `billing_waiting_ready` notifications after billing candidates are created from fulfillment completion or vet-reviewed lab/imaging billing sync.

Implemented deliverables:

- Fulfillment completion emits `billing_waiting_ready` after downstream billing candidate sync succeeds.
- Vet-reviewed lab/imaging billing sync emits `billing_waiting_ready` after the review gate creates billing candidates.
- The fulfillment work-item update route and chart result-review billing route enable the producer explicitly.
- Emitted notifications target the billing role queue, are drawer-only, remain non-badge, and open the source billing candidate context.
- Display payload stays minimal: patient/order labels when available, billing candidate id, source route, and no amount, payment, guardian contact, or provider data.
- Source-domain view permissions gate notification visibility before source routes are returned.
- Synthetic/dev produced events can be scoped by demo client session so route-level producer tests do not leak generated rows into unrelated drawer count tests; scoped bumps clear read/archive state only for the matching client session, and fixture rows remain workspace-scoped.
- Vet-reviewed billing candidate generation emits audit events before notification emission.
- Focused TDD coverage proves route-level notification visibility, drawer-only/non-badge behavior, role and source-permission filtering, scoped state isolation, audit emission, and vet-review handoff behavior.

Still out of scope after this slice:

- Standalone billing invoice-candidate PATCH notification emission.
- Clinical result completion and explicit recheck request producer wiring.
- DB-backed notification persistence and RLS replay.
- Realtime delivery, external channels, payment-provider side effects, or production launch.

## Sixth Implementation Slice

The sixth implementation slice wires the first clinical source signal to the producer: `clinical_result_completed` notifications after lab result-entry save succeeds.

Implemented deliverables:

- The lab result-entry save route emits `clinical_result_completed` after the source save succeeds.
- Emitted notifications target the veterinarian role queue, are badge eligible, are actionable, and open the source lab result context.
- Display payload stays minimal: generic clinical review copy, result/order identifiers, source route, and no raw lab values.
- Source-domain view permissions gate notification visibility before source routes are returned.
- Synthetic/dev produced events are scoped by demo client session when the route is called through demo-header mock mode.
- Focused TDD coverage proves route-level emission, veterinarian visibility, front-desk exclusion, badge count behavior, source route mapping, and raw-value omission.

Still out of scope after this slice:

- Imaging result completion producer wiring.
- Explicit recheck request producer wiring.
- Assigned veterinarian user-level routing beyond the current veterinarian role queue.
- Clinical interpretation, abnormal-value summaries, or raw lab values in notification title/detail.
- DB-backed notification persistence and RLS replay.
- Realtime delivery, external channels, provider/device/PACS integrations, or production launch.

## Seventh Implementation Slice

The seventh implementation slice wires explicit recheck requests to the producer through a fixed server route: `order_recheck_requested` notifications after an authorized clinical requester submits a target role/user, source order context, and reason.

Implemented deliverables:

- A fixed notification API route emits only `order_recheck_requested`; no generic create-notification route is exposed.
- The route validates source domain, source kind, source entity, workspace-local source route, target recipient, order label, requester label, and reason.
- Requester permission is enforced server-side: `chart:update` or the relevant target-domain completion permission is required.
- Emitted notifications target an explicit user or approved clinical role queue, are high priority, badge eligible, actionable, and role-active toast eligible.
- Source-domain view permissions continue to gate notification visibility before source routes are returned.
- Synthetic/dev produced events are scoped by demo client session.
- Focused TDD coverage proves route-level emission, target role visibility, desk exclusion, badge count behavior, source route mapping, and non-clinical requester denial.

Still out of scope after this slice:

- Durable storage for the recheck request object itself.
- Updating source order lifecycle status to `re_requested`.
- Assigned-user lookup from order ownership.
- Inpatient recheck routing until an inpatient permission boundary exists.
- DB-backed notification persistence and RLS replay.
- Realtime delivery, external channels, provider/device/PACS integrations, or production launch.

## Eighth Implementation Slice

The eighth implementation slice adds the local/dev/test DB persistence foundation for live notification events and per-user read/archive state. It does not yet replace the visible route's in-memory event/state stores.

Implemented deliverables:

- Additive `notification_events` table for workspace-scoped live event rows.
- Additive `notification_user_states` table for per-user read/archive state.
- RLS policies require active workspace membership for table select/write access.
- Fixed RPCs exist for event upsert, event list, and user-state upsert:
  - `clair_emit_notification_event`
  - `clair_list_notification_events`
  - `clair_upsert_notification_user_state`
- A TypeScript Supabase persistence gateway calls the fixed RPCs and maps stable error categories without leaking raw DB details.
- Focused TDD coverage proves migration structure, RLS/member checks, RPC names, gateway calls, and error mapping.

Still out of scope after this slice:

- Wiring visible notification routes to the DB gateway.
- Replacing the in-memory live notification event/state stores.
- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Realtime/SSE delivery and polling cadence changes.
- External channels or provider/device/PACS integrations.

## Ninth Implementation Slice

The ninth implementation slice adopts the DB persistence gateway in notification routes for Supabase-session actors while preserving demo-header mock-mode memory stores.

Implemented deliverables:

- Supabase-session notification route actors receive a notification persistence gateway.
- Notification list/count routes read persisted notification events and persisted user read/archive state for Supabase-session actors.
- Read/archive/restore/read-all mutation routes write persisted user state for Supabase-session actors.
- Demo-header mock-mode remains on the existing scoped in-memory event/state stores.
- Existing DTO mapping, recipient filtering, source-domain permission filtering, badge counts, and safe source-route behavior are reused through the live notification core.
- Focused TDD coverage proves persisted event read, persisted user-state read, persisted read mutation, fixed RPC calls, and route adoption.

Still out of scope after this slice:

- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Replacing demo-header mock-mode memory stores.
- Producer-side DB adoption for Supabase mutations.
- Realtime/SSE delivery and polling cadence changes.
- External channels or provider/device/PACS integrations.

## Tenth Implementation Slice

The tenth implementation slice adopts the DB persistence gateway in selected producer routes for Supabase-session mutations while preserving demo-header mock-mode memory stores.

Implemented deliverables:

- The fixed `order_recheck_requested` route emits through `notificationPersistenceGateway` when the actor is a Supabase-session actor.
- The lab result-entry save route emits `clinical_result_completed` through `notificationPersistenceGateway` after Supabase result save succeeds.
- Demo-header mock-mode keeps using the existing scoped in-memory producer path.
- Notification creation failures after an already-successful lab result mutation do not roll back the source mutation; the response reports zero emitted notifications and a bounded emission issue category for that event class.
- The notification persistence migration removes direct authenticated table grants, requires RPC actor/auth.uid alignment, filters list RPC output by recipient/domain visibility, restricts user-state mutation to visible notifications for the current actor, and clears read/archive state when a DB-backed event bump occurs.
- The fixed recheck route rejects unavailable direct-user recipients before emitting.
- Focused TDD coverage proves producer route DB adoption without requiring remote Supabase migration execution.

Still out of scope after this slice:

- Reception waiting-over-30m and billing waiting-ready producer DB adoption.
- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Realtime/SSE delivery and polling cadence changes.
- External channels or provider/device/PACS integrations.

## Eleventh Implementation Slice

The eleventh implementation slice adopts the DB persistence gateway in the remaining approved phase-1 producer paths.

Implemented deliverables:

- The reception queue read route emits `waiting_over_30m` through `notificationPersistenceGateway` for Supabase-session actors.
- Fulfillment completion emits `billing_waiting_ready` through `notificationPersistenceGateway` after billing candidate sync succeeds.
- Vet-reviewed lab/imaging billing sync emits `billing_waiting_ready` through `notificationPersistenceGateway` after billing candidate sync and audit emission succeed.
- Demo-header mock-mode keeps using the existing scoped in-memory producer path.
- Notification creation failures after an already-successful source read or mutation do not roll back the source result; successful emission counts remain bounded to events persisted or emitted successfully.
- Focused TDD coverage proves static route adoption, runtime core persistence-gateway emission, and notification persistence failure isolation for reception, fulfillment completion, and vet-reviewed billing sync without requiring remote Supabase migration execution.

Still out of scope after this slice:

- Background scheduler ownership for waiting alerts.
- Standalone billing invoice-candidate PATCH notification emission.
- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Realtime/SSE delivery and polling cadence changes.
- External channels or provider/device/PACS integrations.

## Open Questions

- Should role queue read/archive be per-user only in v1, or should later PRs support shared team queue acknowledgement?
- Should notification list polling be enough for MVP, or should server-sent events be introduced after live API stability?
- Should the reception queue read-model `waiting_over_30m` evaluator move to a scheduler/background job before production-demo launch?
- Should later clinical notifications add patient/order labels, or should v1 keep only generic review copy until source-screen context is stronger?
- Should standalone/manual billing candidate re-syncs notify staff, or should `billing_waiting_ready` stay limited to source workflow handoffs?
- Should explicit recheck requests become durable workflow records before changing source order lifecycle state to `re_requested`?
