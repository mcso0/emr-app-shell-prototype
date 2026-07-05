---
id: "NOTIFICATION-PR-024"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Notification DB-backed route adoption"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-023-db-event-persistence-foundation.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-023-db-event-persistence-foundation.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-db-backed-route-adoption-report.html"
---

# Notification DB-Backed Route Adoption

## Goal

Use the notification DB persistence gateway for Supabase-session notification list/count/read/archive/restore/read-all routes while preserving the existing demo-header mock-mode memory store.

## Scope

- Attach a notification persistence gateway to Supabase-session notification route actors.
- Read persisted notification events and persisted user read/archive state for Supabase-session actors.
- Persist read/archive/restore/read-all state through the notification user-state RPC.
- Keep demo-header mock mode on the existing scoped in-memory event/state stores.
- Preserve the existing notification DTO, recipient filtering, source permission filtering, counts, and safe source-route mapping.
- Add focused TDD coverage for persisted event read, persisted user-state read, persisted read mutation, gateway RPC calls, and route adoption.

## Out Of Scope

- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Replacing demo-header mock-mode memory stores.
- Producer writes directly to DB in demo-header mock mode.
- Realtime/SSE delivery or polling cadence changes.
- External email, KakaoTalk, SMS, provider/device/PACS integrations.
- Real hospital/customer/patient/guardian/payment/identity data.

## Done When

- Supabase-session notification actors receive a notification persistence gateway.
- Notification list/count routes use persisted event/state helpers for Supabase-session actors.
- Read/archive/restore/read-all mutation routes write persisted user state for Supabase-session actors.
- Demo-header mock-mode route behavior continues through the existing live notification core.
- Focused persistence and live notification API tests pass.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-persistence-contract.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts`
- `npx tsc --noEmit --pretty false`
- targeted notification route/persistence lint
- `npm run docs:check`
- `git diff --check`

## Verification Result

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-persistence-contract.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npx eslint src/features/notifications/server-notification-persistence.ts src/features/notifications/server-notifications-route.ts src/app/api/workspaces/'[workspaceId]'/notifications/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/counts/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/'[notificationId]'/read/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/'[notificationId]'/archive/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/'[notificationId]'/restore/route.ts src/app/api/workspaces/'[workspaceId]'/notifications/read-all/route.ts tests/notification-persistence-contract.spec.ts` passed.
- `npm run docs:check` passed.
- `git diff --check` passed.

## Handoff Notes

This slice makes the Supabase-session route path DB-backed. It does not apply migrations remotely and does not change demo-header mock-mode event/state storage. Producer-side DB adoption for Supabase mutations is still a follow-up.
