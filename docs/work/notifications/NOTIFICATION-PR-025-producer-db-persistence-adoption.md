---
id: "NOTIFICATION-PR-025"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Notification producer DB persistence adoption"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-021-clinical-result-completed-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-022-order-recheck-requested-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-023-db-event-persistence-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-024-db-backed-route-adoption.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-023-db-event-persistence-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-024-db-backed-route-adoption.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-producer-db-persistence-adoption-report.html"
---

# Notification Producer DB Persistence Adoption

## Goal

Use the notification DB persistence gateway when approved Supabase-session producer routes emit live notification events, while preserving the existing demo-header mock-mode in-memory producer behavior.

## Scope

- Add focused producer contract coverage for Supabase-session DB persistence adoption.
- Route `order_recheck_requested` emission through the notification persistence gateway when the fixed recheck route runs with a Supabase session.
- Route `clinical_result_completed` emission through the notification persistence gateway after Supabase lab result-entry save succeeds.
- Keep demo-header mock-mode producer events scoped to the existing in-memory event store and demo client session.
- Preserve existing event copy, recipient targeting, badge/toast policy, source route validation, permission checks, and safe clinical-result payload rules.
- Keep source mutations authoritative if notification creation fails after the source mutation has already succeeded.

## Out Of Scope

- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Replacing demo-header mock-mode memory stores.
- Reception waiting-over-30m and billing-waiting-ready producer DB adoption.
- Durable storage for the recheck request object or source order lifecycle mutation.
- Realtime/SSE delivery, polling cadence changes, external delivery channels, or provider/device/PACS integrations.
- Real hospital/customer/patient/guardian/payment/identity data.

## Done When

- Supabase-session `order-recheck-requests` writes the produced notification through `notificationPersistenceGateway`.
- Supabase-session lab result-entry save writes the produced clinical-result notification through `notificationPersistenceGateway`.
- Demo-header mock-mode route tests continue to prove in-memory scoped event visibility.
- Focused persistence contract tests prove producer route adoption.
- Typecheck, targeted lint, focused Playwright tests, docs check, and whitespace diff check pass.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-persistence-contract.spec.ts tests/order-recheck-notification-server.spec.ts tests/lab-result-entry-notification-server.spec.ts tests/notification-live-api-server.spec.ts`
- `npx tsc --noEmit --pretty false`
- targeted notification producer/persistence lint
- `npm run docs:check`
- `git diff --check`

## Verification Result

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-persistence-contract.spec.ts tests/order-recheck-notification-server.spec.ts tests/lab-result-entry-notification-server.spec.ts tests/notification-live-api-server.spec.ts` passed with 22 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/features/notifications/server-notification-persistence.ts src/app/api/workspaces/'[workspaceId]'/notifications/order-recheck-requests/route.ts src/app/api/workspaces/'[workspaceId]'/lab-imaging/result-entries/route.ts tests/notification-persistence-contract.spec.ts tests/order-recheck-notification-server.spec.ts` passed.
- `npm run docs:check` passed.
- `git diff --check` passed.

## Handoff Notes

This slice intentionally adopts DB persistence only for the two producer routes that already have explicit server boundaries. It does not claim full producer persistence until reception waiting-over-30m, billing waiting-ready, and any future producers are adopted in their own slices.

Security-boundary review found direct table/RPC bypass risks in the persistence migration. This slice closes the must-fix items by removing direct authenticated table grants, requiring RPC actor/auth.uid alignment, filtering event-list RPC results by recipient/domain visibility, restricting user-state mutation to the current actor and visible notifications, adding producer emit authorization checks, validating role/direct-user recipients, and exposing lab notification emission failure categories without rolling back the saved lab result.

Remote Supabase migration execution, local DB reset/replay, and production-demo validation were not run in this slice.
