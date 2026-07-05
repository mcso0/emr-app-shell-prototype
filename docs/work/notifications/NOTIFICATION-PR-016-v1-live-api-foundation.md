---
id: "NOTIFICATION-PR-016"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Notification v1 live API foundation"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-015-human-review-readiness-pass.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-v1-live-api-foundation-report.html"
---

# Notification v1 Live API Foundation

## Goal

Define the first live notification implementation slice and add a server-side synthetic API boundary for staff in-app notifications.

## Scope

- Keep the top-bar bell and right drawer as the primary notification surface.
- Keep notifications out of the left nav rail.
- Add the v1 product, UX flow, data/API, exception, and implementation plan.
- Add local/dev synthetic server notification list/count/read/archive/restore behavior.
- Add focused tests for workspace membership, recipient filtering, safe DTO shape, source-route safety, and read/archive state.

## Out Of Scope

- Replacing the visible drawer data source with the live API.
- DB migrations, RLS replay, or remote Supabase validation.
- Browser/OS push, service worker delivery, Kakao/SMS/email, or external provider delivery.
- Real hospital, patient, guardian, payment, identity, or provider data.
- Production deployment or real external-user launch.

## Done When

- Source docs describe detailed product behavior, UX flows, API shape, exception cases, and implementation slices.
- Nav rail notification entry is removed while the top-bar bell remains.
- Server notification API routes exist for list, counts, read, read-all, archive, and restore.
- Focused notification live API tests pass.
- Existing notification drawer tests still pass.
- `docs:check`, lint, and TypeScript verification pass.

## Verification

- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3334 npx playwright test tests/notification-live-api-server.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3333 npx playwright test tests/app-shell.spec.ts -g "global notification"`

## Handoff Notes

This PR slice proves the live notification API boundary with synthetic/demo data only. The visible drawer can adopt this API in a later slice after API state and fallback semantics are accepted.

## Verification Result

- `npm run docs:check` passed.
- `npm run lint` passed with existing warnings only.
- `npx tsc --noEmit` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3334 npx playwright test tests/notification-live-api-server.spec.ts` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3334 npx playwright test tests/app-shell.spec.ts -g "global notification"` passed.
