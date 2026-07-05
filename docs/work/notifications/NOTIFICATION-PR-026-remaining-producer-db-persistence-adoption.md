---
id: "NOTIFICATION-PR-026"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Notification remaining producer DB persistence adoption"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-019-reception-waiting-over-30m-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-020-billing-waiting-ready-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-023-db-event-persistence-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-024-db-backed-route-adoption.md"
  - "docs/work/notifications/NOTIFICATION-PR-025-producer-db-persistence-adoption.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-023-db-event-persistence-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-024-db-backed-route-adoption.md"
  - "docs/work/notifications/NOTIFICATION-PR-025-producer-db-persistence-adoption.md"
completed_report: "docs/completed/engineering/2026-07-06-notification-remaining-producer-db-persistence-adoption-report.html"
updated: "2026-07-06"
---

# Notification Remaining Producer DB Persistence Adoption

## Goal

Use the notification DB persistence gateway for the remaining approved phase-1 producer paths: reception waiting-over-30m alerts and billing waiting-ready handoff alerts, while preserving demo-header mock-mode in-memory producer behavior.

## Scope

- Add focused producer contract coverage for reception and billing producer DB persistence adoption.
- Route `waiting_over_30m` emission through the notification persistence gateway when the reception queue route runs with a Supabase session.
- Route `billing_waiting_ready` emission through the notification persistence gateway after fulfillment completion or vet-reviewed billing sync creates billing candidates in a Supabase session.
- Keep demo-header mock-mode producer events scoped to the existing in-memory event store and demo client session.
- Preserve existing event copy, recipient targeting, badge/toast policy, source route mapping, source-domain visibility, and privacy rules.
- Keep source reads/mutations authoritative if notification creation fails after the source read/mutation has already succeeded.

## Out Of Scope

- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Replacing demo-header mock-mode memory stores.
- Background scheduler ownership for reception waiting alerts.
- Standalone billing invoice-candidate PATCH notification emission.
- Realtime/SSE delivery, polling cadence changes, external delivery channels, or provider/device/PACS integrations.
- Real hospital/customer/patient/guardian/payment/identity data.

## Done When

- Supabase-session reception queue read can write `waiting_over_30m` through `notificationPersistenceGateway`.
- Supabase-session fulfillment completion can write `billing_waiting_ready` through `notificationPersistenceGateway`.
- Supabase-session chart result-review billing sync can write `billing_waiting_ready` through `notificationPersistenceGateway`.
- Demo-header mock-mode route tests continue to prove in-memory scoped event visibility.
- Focused persistence contract tests prove route/core adoption.
- Typecheck, targeted lint, focused Playwright tests, docs check, and whitespace diff check pass.

## Verification

- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-persistence-contract.spec.ts tests/reception-queue-read-server.spec.ts tests/fulfillment-work-item-server.spec.ts tests/notification-live-api-server.spec.ts` with 48 tests.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts -g "global notification"` with 8 tests.
- Passed: `npx tsc --noEmit --pretty false`.
- Passed: targeted notification/reception/fulfillment ESLint for touched route/core/test files.
- Passed: `npm run docs:check`.
- Passed: `git diff --check`.

## Handoff Notes

This slice closes the known phase-1 producer DB adoption gap for existing approved producers in local code/tests. It still does not execute migrations remotely or claim realtime delivery.

Full `tests/app-shell.spec.ts` was not used as the formal verification gate for this slice because unrelated dispensing and compact layout cases failed during a broader exploratory run; the notification-specific app-shell subset above passed.
