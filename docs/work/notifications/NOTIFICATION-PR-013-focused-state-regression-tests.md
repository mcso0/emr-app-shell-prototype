---
id: "NOTIFICATION-PR-013"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-407"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-012-event-ui-surface-qa.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-407-notification-focused-tests-report.html"
---

# Notification v0 Focused State Regression Tests

## Goal

Add focused tests for notification badge, read/archive, dedupe, and localStorage behavior.

## Scope

- Pin badge resolver behavior against read, archived, recipient, and `badge_count` false rows.
- Verify unread reference notifications do not become shell badge counts.
- Verify localStorage helpers use the v0 contract keys.
- Verify malformed or unknown persisted localStorage ids are handled safely.
- Verify read/archive state application does not mutate fixture data.
- Keep existing dedupe/update-bump tests as part of the focused notification suite.

## Out Of Scope

- Remote Supabase/RLS/live validation tests.
- Service worker, push, provider, Kakao/SMS/email delivery tests.
- Notification settings/preference tests.
- Full app regression beyond the notification-focused suite.

## Done When

- Badge regressions from counting all unread rows are covered.
- Read/archive localStorage key and reload behavior are covered.
- Malformed localStorage values do not break the notification center.
- Dedupe update-bump behavior remains protected by focused tests.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-fixtures.spec.ts -g "notification"`
- `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-surfaces.spec.ts tests/notification-toast.spec.ts tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`

## Handoff Notes

The focused suite now covers pure policy helpers and app-shell persistence behavior. It intentionally does not add live provider or remote persistence coverage because v0 remains mock/local-first.
