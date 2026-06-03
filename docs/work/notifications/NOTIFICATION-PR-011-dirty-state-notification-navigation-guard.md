---
id: "NOTIFICATION-PR-011"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-405"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-010-source-navigation-fallback-detail.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-405-notification-dirty-navigation-guard-report.html"
---

# Notification v0 Dirty State Navigation Guard

## Goal

Guard notification source navigation when the current workspace has unsaved work.

## Scope

- Add a shell-level dirty flag for notification source navigation.
- Show the exact confirmation copy before route-backed notification navigation when the dirty flag is active.
- Keep the drawer open and leave the current route unchanged when the user cancels.
- Continue current-tab source navigation when the user confirms.
- Keep fallback detail behavior unblocked when a notification has no source route.
- Add focused Playwright coverage for cancel and confirm paths.

## Out Of Scope

- Replacing every feature-local dirty-state implementation.
- Autosave, draft persistence, or form recovery.
- New-tab navigation behavior.
- Remote Supabase migration/RLS/live validation.
- Provider delivery or external notification channels.
- Performing final clinical, billing, or reception actions inside notifications.

## Done When

- Dirty route-backed notification source actions show `작업 중인 내용이 저장되지 않을 수 있습니다. 이동하시겠습니까?`.
- Cancel keeps the user on the current workflow and leaves the drawer visible.
- Confirm navigates the current tab to the notification source route.
- Clean navigation does not show the confirmation dialog.
- Source fallback details remain available without prompting.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-toast.spec.ts tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`

## Handoff Notes

The shell now exposes a minimal dirty flag for notification navigation. Feature modules that own unsaved work should set `setNotificationNavigationDirty(true)` while their dirty state is active. The non-production browser bridge is only for Playwright coverage.
