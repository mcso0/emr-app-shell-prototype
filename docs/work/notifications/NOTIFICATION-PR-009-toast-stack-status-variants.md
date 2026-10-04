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
updated: "2026-10-04"
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

## Toast Placement Follow-up (2026-10-04)

- User-approved scope: move shared result messages and live in-app notification cards to the upper right, verify their rendered position, then commit, push, open a PR, and merge the verified change into `main`.
- Both surfaces start below the shell controls, module toolbar, and right-panel header using `--emr-toast-offset-top`. Shared messages sit 16px below the measured live notification stack.
- Desktop/mobile horizontal offsets, visible limit, queue, delivery preferences, dismiss/archive behavior, and persistence stay unchanged.
- Verify the shared message in the app and the live notification cards with synthetic Storybook fixtures. Require local release preflight, candidate `Release Check`, and Ready PR Preview before merge.
- Production smoke: authenticated reception refresh emits the shared message at the upper right; inspect the new live stack's position without creating remote notification events.
- Rollback baseline: `main` `0701ea78187fc8a5aab8a3c2e6e5d773936c350f`, production deployment `dpl_4iDNk8DL2v7pTrQyY74U4Sbur5br`. Stop on failed checks, incorrect positioning, or an unexpected release diff.
- Local verification passed: secret/docs/UX copy checks, lint (zero errors; five existing script warnings), TypeScript, production build, 23 notification contracts, and four live-delivery Storybook interaction tests.
- Rendered browser evidence: at 1280x720, the live stack starts at y=176 and the shared toaster at y=192; three synthetic live cards occupy y=176..582. At width 560, the shared toaster still uses `data-y-position="top"` and top=192px. Local mock reception reads reported missing workspace access; this is placement evidence, not successful persisted reception reads.
