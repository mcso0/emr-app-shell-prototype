---
id: "NOTIFICATION-PR-003"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-397"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-001-v0-contract-fixture-schema.md"
  - "docs/work/notifications/NOTIFICATION-PR-002-event-matrix-ux-badge-toast-policy.md"
updated: "2026-06-02"
completed_report: "docs/completed/design/2026-06-02-den-397-notification-drawer-foundation-report.html"
---

# Notification v0 Shell Drawer Foundation

## Goal

Build the global notification bell badge and right-side drawer shell for notification center v0.

## Scope

- Add the global notification bell entry to the shell topbar.
- Route the bell through an app-level drawer open state so the current workspace context stays mounted.
- Add a badge resolver boundary that counts `unread && badge_count === true`, not total unread.
- Add a right drawer shell with header, unread/badge summary, filter/action area, and v0-scoped row actions.
- Keep row actions limited to source navigation, read, archive, and all-read affordances.

## Out Of Scope

- Live push, service worker, provider/device delivery.
- Kakao, SMS, or email notifications.
- Remote Supabase migration, RLS, or live validation.
- Notification settings page or full-page center.
- Working source deep-link navigation and dirty-state guard.
- Persisted read/archive state and role-queue localStorage behavior.
- Toast queue implementation.
- Final clinical, billing, reception, or dispensing actions from inside a notification.

## Done When

- The shell bell opens and closes the right notification drawer.
- The drawer does not navigate away from or unmount the current workspace route.
- The topbar badge displays the resolver result for badge-count notifications.
- Drawer header, unread count, filters, and scoped action affordances are visible.
- Desktop and narrow viewport smoke checks pass.
- DEN-397 is moved to Human Review in Linear with completion notes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3109 npx playwright test tests/app-shell.spec.ts -g "global notification"`
- In-app browser smoke at `http://127.0.0.1:3109/w/clair-demo/reception?modulePanel=open`

## Handoff Notes

DEN-398 should implement full Linear-style row behavior, filters, and read/archive state. DEN-399 should persist read/archive state to localStorage and add the role-queue local-first disclaimer. DEN-404 should connect source navigation and dirty-state confirmation.

## Completion Notes

- Added mock notification fixtures and badge/unread resolvers in `src/features/notifications/mock-notifications.ts`.
- Added the right drawer shell in `src/features/notifications/global-notification-drawer.tsx`.
- Wired `src/shell/app-shell.tsx` and `src/shell/workspace-tabs-bar.tsx` so the topbar bell opens the drawer.
- Added focused Playwright coverage for desktop badge/drawer behavior and narrow viewport fit.
- Saved browser smoke screenshot at `docs/completed/design/2026-06-02-den-397-notification-drawer-browser.png`.
