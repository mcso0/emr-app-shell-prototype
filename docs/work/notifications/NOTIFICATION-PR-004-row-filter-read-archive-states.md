---
id: "NOTIFICATION-PR-004"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-398"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-003-shell-drawer-foundation.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-398-notification-row-filter-read-archive-report.html"
---

# Notification v0 Row Filter Read Archive States

## Goal

Implement Linear-style notification rows, filters, and session-local read/archive state behavior in the global notification drawer.

## Scope

- Make drawer row actions interactive for read, archive, and restore.
- Add read/unread visual state to rows.
- Add active filters for default active list, unread rows, important rows, and archived rows.
- Keep archived rows out of the default list and visible in the archive filter.
- Keep badge counting tied to `unread && !archived && badge_count === true`.
- Align current fixture fields with the v0 notification contract shape enough for row-state work.

## Out Of Scope

- `localStorage` persistence for read/archive state.
- Role queue local-first disclaimer UI.
- Source deep-link navigation and fallback detail behavior.
- Dirty-state confirmation guard.
- Toast stack behavior.
- Live push, provider delivery, Kakao/SMS/email, remote Supabase migration/RLS/live validation.
- Final clinical, billing, reception, or dispensing actions from inside notifications.

## Done When

- Unread and read rows are visually distinct.
- Read action removes a row from the badge count without archiving it.
- Archive action removes a row from the default list and shows it in the archive filter.
- Restore action returns a row from archive to the default list.
- All-read clears badge-count rows without archiving rows.
- Focused tests cover read, archive, restore, all-read, and narrow viewport fit.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3109 npx playwright test tests/app-shell.spec.ts -g "global notification"`
- Playwright screenshot smoke at `http://127.0.0.1:3110/w/clair-demo/reception?modulePanel=open`

## Handoff Notes

DEN-399 owns `localStorage` persistence and the role-queue local-first disclaimer. DEN-404 owns enabled source navigation and fallback detail state. DEN-398 intentionally keeps source action buttons disabled so notification rows do not imply final workflow actions or incomplete navigation support.

## Completion Notes

- Added session-local read/archive/restore/all-read state in the app shell.
- Added `안 읽음` filter and kept `전체`, `중요`, and `보관` filters active.
- Added contract-aligned fixture fields for current representative rows.
- Updated focused Playwright coverage for read/archive/restore/all-read behavior.
- Saved browser smoke screenshot at `docs/completed/design/2026-06-03-den-398-notification-row-state-browser.png`.
