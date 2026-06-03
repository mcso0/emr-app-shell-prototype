---
id: "NOTIFICATION-PR-005"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-399"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-004-row-filter-read-archive-states.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-399-notification-localstorage-disclaimer-report.html"
---

# Notification v0 LocalStorage Role Queue Disclaimer

## Goal

Persist global notification read/archive state in the v0 local-first boundary and make the role queue non-sync limitation visible in the drawer.

## Scope

- Read `localStorage` state from `clair.notifications.v0.read` and `clair.notifications.v0.archive`.
- Store only notification ID arrays for read/archive state.
- Hydrate persisted state after mount to avoid server/hydration access to `window.localStorage`.
- Ignore stale unknown notification IDs when fixtures change.
- Fall back to fixture defaults when a stored value is missing, malformed, or not an array.
- Keep archive as list cleanup and read as acknowledgement only.
- Add the role queue local-state disclaimer to the drawer.

## Out Of Scope

- Live push, service worker, provider delivery, Kakao/SMS/email, remote Supabase migration/RLS/live validation.
- Client-to-client or user-to-user synchronization for role queue read/archive state.
- Source deep-link navigation, fallback detail behavior, or dirty-state confirmation guard.
- Toast queue implementation.
- Final clinical, billing, reception, or dispensing actions from inside notifications.

## Done When

- Read/archive state survives page reload in the same browser profile.
- The two contract keys store ID arrays only.
- Corrupted storage values and stale IDs do not break the drawer.
- The drawer visibly states that role queue read/archive state is saved only in the current browser and is not synchronized.
- Badge count remains based on `unread && !archived && badge_count === true`.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3109 npx playwright test tests/app-shell.spec.ts -g "global notification"`
- `npm run docs:check`
- Playwright Chromium screenshot smoke at `http://127.0.0.1:3110/w/clair-demo/reception?modulePanel=open`

## Handoff Notes

DEN-399 intentionally keeps notification persistence local-only. The stored data is UX state, not permission state, audit state, workflow completion, or a cross-user role queue sync mechanism. DEN-404 and DEN-405 own source navigation and dirty-state confirmation.

## Completion Notes

- Added localStorage read/write helpers with the v0 contract keys.
- Added mount-time hydration and post-hydration persistence in `AppShell`.
- Added drawer disclaimer copy for role queue local-first behavior.
- Added focused Playwright coverage for reload persistence, key contents, corrupted values, unknown IDs, and disclaimer visibility.
