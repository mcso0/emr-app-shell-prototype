---
id: "NOTIFICATION-PR-019"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Reception waiting-over-30m notification producer wiring"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-reception-waiting-over-30m-producer-wiring-report.html"
---

# Reception Waiting-Over-30m Notification Producer Wiring

## Goal

Wire the first real source workflow/read-model signal to the notification producer: reception queue waiting-over-30m alerts for the desk role.

## Scope

- Evaluate `waiting_over_30m` from the reception queue read model when explicit notification producer wiring is enabled.
- Emit a live notification for consultation queue rows that are still waiting at least 30 minutes.
- Route the notification to the desk role queue with badge eligibility.
- Use the existing live notification event store, read/archive state store, recipient filter, and safe source-route mapping.
- Use a deterministic threshold timestamp so repeated queue reads do not continuously bump the same alert or reopen read state.
- Enable this producer in the reception queue route.
- Add focused TDD coverage proving emitted notification visibility and repeated-read no-op behavior.

## Out Of Scope

- Background scheduler ownership for waiting alerts.
- DB-backed notification event persistence or RLS replay.
- Realtime/SSE delivery or polling cadence changes.
- Other event producers such as clinical result completion, explicit recheck request, or billing-ready signals.
- External notification channels and real customer-facing notifications.

## Done When

- `readReceptionQueue` can emit a `waiting_over_30m` notification through the producer dependency.
- The reception queue route enables the producer.
- A front desk actor can read the emitted notification through the existing notification reader boundary.
- Re-reading the same threshold event after marking it read does not reopen the notification.
- Focused reception and notification server tests pass.

## Verification

- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/reception-queue-read-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts -g "global notification"`
- `npm run docs:check`
- targeted notification/reception lint

## Verification Result

- `npx tsc --noEmit` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/reception-queue-read-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts -g "global notification"` passed.
- `npm run docs:check` passed.
- `npx eslint src/features/reception/server-reception-queue-read-core.ts src/app/api/workspaces/'[workspaceId]'/reception/queue/route.ts src/features/notifications/server-notifications-core.ts tests/reception-queue-read-server.spec.ts tests/notification-live-api-server.spec.ts` passed.
- `git diff --check` passed.

## Handoff Notes

This is the first source workflow/read-model producer wiring. It intentionally uses the reception queue read model as the evaluator until a background scheduler is approved. Repeated reads of the same 30-minute threshold are stable and do not keep reopening read notifications.
