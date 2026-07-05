---
id: "NOTIFICATION-PR-018"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Notification v1 event producer foundation"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-017-v1-visible-drawer-live-api-adoption.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-017-v1-visible-drawer-live-api-adoption.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-v1-event-producer-foundation-report.html"
---

# Notification v1 Event Producer Foundation

## Goal

Add the first server-side internal notification producer foundation so approved source workflow mutations can emit safe in-app notifications without exposing a generic client create route.

## Scope

- Add a local/dev synthetic notification event store.
- Add an internal `emitLiveNotificationEvent` helper for source workflow server code.
- Upsert repeated live events by `dedupeKey` instead of appending duplicate rows.
- Reopen per-user read/archive state when a new bumped event arrives.
- Keep workspace and recipient filtering in the existing live list/mutation boundary.
- Keep safe DTO mapping and source-route workspace safety in the reader.
- Add focused TDD coverage for event creation, dedupe bump, read-state reopen, safe DTO shape, and recipient visibility.

## Out Of Scope

- Generic public/client notification create API.
- DB migration, RLS replay, remote Supabase validation, or production deployment.
- Realtime/SSE delivery, browser push, service worker delivery, Kakao/SMS/email, or provider/device integrations.
- Wiring every source workflow mutation to the producer.
- Real hospital, patient, guardian, payment, identity, or provider data.

## Done When

- Server notification core exposes a bounded internal producer helper and event store.
- Produced notifications are visible through `readLiveNotifications` with existing membership/recipient/source-route checks.
- Repeated events with the same dedupe key bump the existing row and do not duplicate the feed.
- A bumped event clears stale read/archive state so the new signal is unread again.
- Focused server tests pass.

## Verification

- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts -g "global notification"`
- `npm run docs:check`
- `npm run lint`

## Verification Result

- `npx tsc --noEmit` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts -g "global notification"` passed.
- `npm run docs:check` passed.
- `npx eslint src/features/notifications/server-notifications-core.ts src/features/notifications/server-notifications-route.ts src/features/notifications/live-notifications-client.ts src/features/notifications/global-notification-drawer.tsx src/shell/app-shell.tsx tests/notification-live-api-server.spec.ts tests/app-shell.spec.ts` passed.
- `git diff --check` passed.
- `npm run lint` failed on an unrelated current worktree change in `src/shell/global-command-palette.tsx` (`react-hooks/set-state-in-effect` at line 293). Notification touched-file lint passed.

## Handoff Notes

This slice creates the internal event producer foundation only. A later slice should wire selected source workflow mutations such as waiting-over-30m reception signals, clinical result completion, explicit recheck requests, and billing-ready events to this helper.
