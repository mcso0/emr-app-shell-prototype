---
id: "NOTIFICATION-PR-020"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Billing waiting-ready notification producer wiring"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-019-reception-waiting-over-30m-producer-wiring.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-billing-waiting-ready-producer-wiring-report.html"
---

# Billing Waiting-Ready Notification Producer Wiring

## Goal

Wire the next phase-1 live source signal to the notification producer: `billing_waiting_ready` notifications after fulfillment or veterinarian review creates billing candidates.

## Scope

- Emit `billing_waiting_ready` only after billing candidate sync succeeds from fulfillment completion or vet-reviewed lab/imaging billing sync.
- Route the notification to the billing role queue.
- Keep the event drawer-only, reference-priority, non-badge, and non-actionable by default.
- Use the existing live notification event store, read/archive state store, recipient filter, and safe source-route mapping.
- Require source-domain view permission before a role-queue notification row is returned.
- Use minimal display payload: patient label when available, order label, candidate id, encounter route, and no amount/payment/contact details.
- Scope synthetic/dev produced events by demo client session when a route request provides `x-clair-demo-client-session-id`, while keeping user read/archive state scoped per user plus client session.
- Keep scoped event bump state-clearing inside the same demo client session.
- Emit audit events when vet-reviewed lab/imaging billing sync creates billing candidates.
- Enable the producer in fulfillment work-item update and chart result-review billing routes.
- Add focused TDD coverage for core producer emission, route-level notification visibility, role filtering, and vet-review handoff.

## Out Of Scope

- Generic public create-notification route.
- Direct notification emission from standalone billing invoice-candidate PATCH.
- `clinical_result_completed` producer wiring.
- `order_recheck_requested` producer wiring.
- DB-backed notification event persistence or RLS replay.
- Realtime/SSE delivery or polling cadence changes.
- Payment-provider, receipt, refund, settlement, KakaoTalk, SMS, email, or other external side effects.

## Done When

- Fulfillment completion that creates billing candidates can emit `billing_waiting_ready`.
- Vet-reviewed lab/imaging billing sync can emit `billing_waiting_ready`.
- The fulfillment work-item update route enables this producer.
- The chart result-review billing route enables this producer.
- A front-desk/billing actor can read the emitted notification through the existing notification reader boundary.
- Technician-only actors do not receive the billing role queue notification.
- The notification is drawer-only and does not increment the shell badge count.
- Source-domain permissions are enforced before returning the notification row/source route.
- Synthetic scoped events do not clear read/archive state for another demo client session.
- Vet-reviewed billing candidate generation emits audit events before notification emission.
- Focused fulfillment and notification server tests pass.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/fulfillment-work-item-server.spec.ts -g "billing-ready notification|holds lab and imaging|fulfillment work item routes"`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/fulfillment-work-item-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- targeted notification/fulfillment lint
- `git diff --check`

## Verification Result

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/fulfillment-work-item-server.spec.ts -g "billing-ready notification|holds lab and imaging|fulfillment work item routes"` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/fulfillment-work-item-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/reception-queue-read-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts -g "global notification"` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run docs:check` passed.
- `npx eslint src/features/notifications/server-notifications-core.ts src/features/notifications/server-notifications-route.ts src/app/api/workspaces/'[workspaceId]'/notifications/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/counts/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/'[notificationId]'/read/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/'[notificationId]'/archive/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/'[notificationId]'/restore/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/read-all/route.ts src/features/fulfillment/server-fulfillment-work-item-core.ts src/app/api/workspaces/'[workspaceId]'/fulfillment/work-items/'[workItemId]'/route.ts src/app/api/workspaces/'[workspaceId]'/chart/result-review-billing/route.ts src/features/reception/server-reception-queue-read-core.ts src/app/api/workspaces/'[workspaceId]'/reception/queue/route.ts tests/fulfillment-work-item-server.spec.ts tests/notification-live-api-server.spec.ts tests/reception-queue-read-server.spec.ts tests/app-shell.spec.ts` passed.
- `git diff --check` passed.

## Handoff Notes

This slice intentionally uses the existing fulfillment completion and vet-review billing sync paths as the source of truth. It does not claim that every billing candidate sync entry point now emits notifications. Direct billing invoice-candidate PATCH remains out of scope until a later producer policy defines whether manual re-syncs should notify staff.

The live notification event store now supports synthetic/demo event scoping by client session. This prevents route-level producer tests from leaking generated rows into unrelated AppShell drawer count tests while preserving unscoped fixture rows and workspace-wide event behavior when no event scope is provided.

Security review findings addressed in this slice: source-domain view permissions now gate notification visibility, scoped event bumps clear only matching demo-client state, and vet-reviewed billing candidate generation emits an audit event before the drawer notification.
