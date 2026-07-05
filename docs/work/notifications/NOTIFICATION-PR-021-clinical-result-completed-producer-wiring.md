---
id: "NOTIFICATION-PR-021"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Clinical result-completed notification producer wiring"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
  - "docs/work/notifications/NOTIFICATION-PR-020-billing-waiting-ready-producer-wiring.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-clinical-result-completed-producer-wiring-report.html"
---

# Clinical Result-Completed Notification Producer Wiring

## Goal

Wire `clinical_result_completed` to the live notification producer when a lab result entry save succeeds and veterinarian review is pending.

## Scope

- Emit `clinical_result_completed` after the lab result-entry route successfully saves a result.
- Route the notification to the veterinarian role queue.
- Keep the notification badge-eligible, actionable, and role-active toast eligible.
- Open the source lab result context from the notification row.
- Use the existing live notification event store, read/archive state store, recipient filter, source-domain permission filter, and safe DTO mapping.
- Keep display payload minimal: result id, order id when available, source route, generic clinical review copy, and no raw lab values.
- Scope synthetic/dev produced events by demo client session when the route request is in demo-header mock mode.
- Add focused TDD coverage for route-level emission, veterinarian visibility, front-desk exclusion, badge count, source route, and raw-value omission.

## Out Of Scope

- Imaging result completion producer wiring.
- Explicit order recheck request producer wiring.
- Assigned-veterinarian user-level routing beyond the current veterinarian role queue.
- Clinical interpretation, diagnosis suggestions, abnormal-value summaries, or raw-result payload in the notification.
- DB-backed notification event persistence or RLS replay.
- Realtime/SSE delivery or polling cadence changes.
- Provider/device, PACS, KakaoTalk, SMS, email, or other external side effects.

## Done When

- Saving a lab result entry can emit one `clinical_result_completed` notification.
- A veterinarian actor can read the emitted notification through the existing notification reader boundary.
- A front-desk actor does not receive the clinical notification.
- The emitted notification increments the badge count.
- The source action opens the lab result context for the saved result.
- The notification title/detail do not expose raw lab values.
- Focused route-level notification tests pass.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/lab-result-entry-notification-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/lab-result-entry-persistence-contract.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- targeted notification/lab result-entry lint
- `git diff --check`

## Verification Result

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/lab-result-entry-notification-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-live-api-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/lab-result-entry-persistence-contract.spec.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run docs:check` passed.
- `npx eslint src/app/api/workspaces/'[workspaceId]'/lab-imaging/result-entries/route.ts tests/lab-result-entry-notification-server.spec.ts src/features/notifications/server-notifications-core.ts tests/notification-live-api-server.spec.ts` passed.
- `git diff --check` passed.

## Handoff Notes

This slice uses lab result-entry save as the first live source for `clinical_result_completed`. It intentionally avoids showing abnormal values or result details in the notification payload; staff must open the source lab result screen to review clinical values.
