---
id: "NOTIFICATION-PR-017"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Notification v1 visible drawer live API adoption"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-016-v1-live-api-foundation.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-v1-visible-drawer-live-api-adoption-report.html"
---

# Notification v1 Visible Drawer Live API Adoption

## Goal

Connect the visible app-shell top-bar bell and right notification drawer to the v1 live notification API boundary.

## Scope

- Keep the top-bar bell and right drawer as the only primary notification entry point.
- Load drawer rows and badge/count summary from the server notification API.
- Fetch active and archived rows so drawer filters remain complete.
- Send read, read-all, archive, and restore mutations through server routes.
- Use only server-sanitized `sourceRoute` values for notification navigation.
- Replace the v0 browser-local state disclaimer with a v1 API-backed state notice.
- Show loading/error states without silently falling back to local fixture rows.
- Isolate synthetic demo read/archive state by demo browser session while preserving server membership and recipient authorization.

## Out Of Scope

- DB migrations, RLS replay, remote Supabase validation, or production deployment.
- Realtime/SSE delivery, browser push, service worker delivery, Kakao/SMS/email, or provider/device integrations.
- Notification event producers from source workflow mutations.
- Real hospital, patient, guardian, payment, identity, or provider data.
- Final launch/compliance claims.

## Done When

- The visible drawer calls `/api/workspaces/:workspaceId/notifications` for active and archived rows.
- Drawer mutations call read, read-all, archive, and restore routes.
- Top-bar badge reflects server counts.
- Source navigation uses the server DTO route and falls back when the route is null.
- Focused AppShell notification tests assert live API calls and server-backed read/archive persistence.
- Focused server tests cover the expanded safe DTO and hospital-admin review visibility.

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
- `npm run lint` passed with existing warnings only.

## Handoff Notes

This slice adopts the existing synthetic live API in the visible AppShell drawer. It does not claim DB-backed persistence, RLS completeness, realtime delivery, external delivery, or event producer coverage.
