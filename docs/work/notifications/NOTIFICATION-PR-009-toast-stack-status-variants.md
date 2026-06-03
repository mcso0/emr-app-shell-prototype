---
id: "NOTIFICATION-PR-009"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-403"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-008-dedupe-update-bump-rules.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-403-notification-toast-stack-report.html"
---

# Notification v0 Toast Stack Status Variants

## Goal

Add the v0 toast stack policy and status variant model without expanding into service worker push, OS notifications, or live provider delivery.

## Scope

- Limit the global Sonner toaster to three visible toasts.
- Add notification-specific toast stack state helpers with visible max 3 plus queued overflow.
- Promote queued toasts after a visible toast is dismissed.
- Update/bump visible or queued toasts with the same dedupe key instead of appending.
- Add status variants for urgent, high, warning, info, and success.
- Add a notification toast card component that uses status icon, work type badge, relative time, and source navigation action.

## Out Of Scope

- Service worker push notification.
- OS/browser notification permission flow.
- Kakao/SMS/email.
- Live provider/device delivery.
- Remote Supabase migration/RLS/live validation.
- Event stream emission into the toast stack.

## Done When

- Visible toast state does not exceed three.
- Queue promotion and dedupe bump behavior are tested.
- Status variants are deterministic from notification priority/source/event state.
- Toast action labels stay source navigation only and do not perform final workflow actions.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-toast.spec.ts tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`

## Handoff Notes

DEN-403 provides the toast stack model and reusable toast card, but live event emission remains out of scope. DEN-404 owns source navigation wiring, including fallback behavior.
