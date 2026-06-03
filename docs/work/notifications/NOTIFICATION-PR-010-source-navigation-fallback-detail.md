---
id: "NOTIFICATION-PR-010"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-404"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-009-toast-stack-status-variants.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-404-notification-source-navigation-report.html"
---

# Notification v0 Source Navigation Fallback Detail

## Goal

Connect notification primary actions to current-tab source workflow navigation and show a fallback detail state when the source cannot be opened.

## Scope

- Enable drawer row source action buttons.
- Navigate the current workspace tab to `source.route` when present.
- Mark the notification read before source navigation or fallback display.
- Close the drawer after successful source navigation.
- Show an in-drawer fallback detail panel when the source route is missing or invalid.
- Document that dirty-state confirmation is still owned by DEN-405.

## Out Of Scope

- Dirty-state confirmation guard.
- Server-side permission enforcement.
- Remote Supabase migration/RLS/live validation.
- Provider delivery or external notification channels.
- Full notification search/archive page.

## Done When

- Route-backed fixture actions navigate the current tab.
- `fallback_detail` fixtures do not silently fail.
- Fallback details show source failure reason and notification metadata.
- Notification actions remain source navigation only and do not perform final clinical, billing, or reception actions.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-toast.spec.ts tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`

## Handoff Notes

The navigation handler intentionally does not include dirty-state confirmation yet. DEN-405 owns the confirmation dialog before notification source navigation.
