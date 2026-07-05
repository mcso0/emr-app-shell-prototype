---
id: "NOTIFICATION-PR-022"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Order recheck-requested notification producer wiring"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-order-recheck-requested-producer-wiring-report.html"
---

# Order Recheck-Requested Notification Producer Wiring

## Goal

Wire `order_recheck_requested` to a fixed server boundary so an authorized clinical actor can request recheck/retry/missing input from a user or role queue.

## Scope

- Add a fixed `order-recheck-requests` route under the notification API boundary.
- Emit only `order_recheck_requested`; do not add a generic create-notification route.
- Require an explicit source domain, source entity, source route, requester label, target recipient, order label, and reason.
- Allow only clinical requesters with `chart:update` or the relevant target-domain completion permission.
- Route to an explicit user or approved clinical role queue.
- Keep the notification badge-eligible, actionable, high-priority, and role-active toast eligible.
- Open the source order/result context from the notification row.
- Scope synthetic/dev produced events by demo client session.
- Add focused TDD coverage for route-level emission, target role visibility, desk exclusion, badge count, source route mapping, and non-clinical requester denial.

## Out Of Scope

- Generic public notification creation.
- Durable storage for the recheck request object itself.
- Updating order lifecycle status to `re_requested`.
- Assigned-user lookup from order ownership.
- Inpatient recheck routing until an inpatient permission boundary exists.
- DB-backed notification event persistence or RLS replay.
- Realtime/SSE delivery, external messaging, provider/device integration, or production launch.

## Done When

- A veterinarian can request lab order recheck and emit `order_recheck_requested`.
- A target clinical staff actor can read the emitted notification through the existing notification reader boundary.
- A front-desk actor does not receive the clinical role-queue notification.
- A front-desk actor cannot create the recheck request notification.
- The emitted notification increments badge count and opens the source order context.
- Focused route-level notification tests pass.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/order-recheck-notification-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- targeted notification/order recheck lint
- `git diff --check`

## Verification Result

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/order-recheck-notification-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run docs:check` passed.
- `npx eslint src/app/api/workspaces/'[workspaceId]'/notifications/order-recheck-requests/route.ts tests/order-recheck-notification-server.spec.ts` passed.
- `git diff --check` passed.

## Handoff Notes

This slice intentionally introduces a fixed, narrow route instead of exposing a generic notification create API. It proves the live producer path for explicit recheck requests while leaving durable request persistence and order lifecycle mutation for a later clinical workflow slice.
