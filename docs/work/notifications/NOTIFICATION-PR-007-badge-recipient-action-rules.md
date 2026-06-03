---
id: "NOTIFICATION-PR-007"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-401"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-006-v0-event-matrix-fixtures.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-401-notification-badge-recipient-rules-report.html"
---

# Notification v0 Badge Recipient Action Rules

## Goal

Make badge counting depend on recipient ownership plus the v0 badge policy instead of total unread state.

## Scope

- Add a notification recipient context for current user and active roles.
- Resolve direct user, active role, and local role queue ownership separately.
- Count the shell badge only when recipient ownership matches and the notification is unread, unarchived, and `badge_count === true`.
- Keep reference/drawer-only unread rows out of the shell badge.
- Keep role queue read/archive behavior local-first in rule explanations.

## Out Of Scope

- Server-side permission enforcement.
- Remote Supabase migration/RLS/live validation.
- Cross-client role queue read/archive synchronization.
- Provider delivery or external notification channels.
- Toast stack, dedupe resolver, source navigation, or dirty-state guard.

## Done When

- Direct user, active role, and role queue ownership are testable independently.
- Read or archived notifications do not count.
- `badge_count: false` notifications do not count even when unread.
- Shell badge continues to use the resolver result.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`

## Handoff Notes

This is a client-side mock/local-first resolver. It is not permission enforcement and does not synchronize role queue state across users or browsers. DEN-402 owns dedupe/update-bump. DEN-403 owns toast stack behavior.
