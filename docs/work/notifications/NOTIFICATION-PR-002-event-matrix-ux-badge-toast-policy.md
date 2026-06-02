---
id: "NOTIFICATION-PR-002"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-396"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-001-v0-contract-fixture-schema.md"
updated: "2026-06-02"
completed_report: "docs/completed/design/2026-06-02-den-396-notification-event-policy-report.html"
---

# Notification v0 Event Matrix And UX Policy

## Goal

Finalize the v0 event matrix, UX writing rules, and badge/toast policy for implementation.

## Scope

- Define the v0 event matrix with trigger, recipient, `requires_action`, `badge_count`, `toast_policy`, source target, title, and detail.
- Define drawer, toast, inline alert, and drawer-only surface rules.
- Define UX writing rules for work type badges, titles, details, action labels, and relative time.
- Lock badge count policy away from total unread interpretation.
- Define toast max-3 queue behavior and dedupe/update-bump expectations.

## Out Of Scope

- Live push, service worker, provider/device delivery.
- Kakao, SMS, or email notifications.
- Remote Supabase migration, RLS, or live validation.
- Notification publisher/admin system.
- Free mention/comment notification system.
- Billing amount verification/blocking alerts.
- Security policy alerts.

## Done When

- `docs/product/features/notifications/global-notification-center-v0-event-policy.md` exists and is linked from notification docs.
- All 10 v0 events are represented in a matrix.
- Badge, toast, surface, writing, and dedupe acceptance checks are explicit.
- `npm run docs:check` passes.
- A Korean closeout report is created under `docs/completed/`.

## Verification

- `npm run docs:check`

## Handoff Notes

Use DEN-397 through DEN-403 to implement shell, drawer, row state, fixtures, badge resolver, dedupe, and toast behavior against this policy. Keep v0 scoped to synthetic fixtures and local read/archive state.

## Completion Notes

- Added `docs/product/features/notifications/global-notification-center-v0-event-policy.md`.
- Linked the event policy from notification docs, Product docs, Docs portal, GitBook summary, and the base contract.
- Added Korean closeout report at `docs/completed/design/2026-06-02-den-396-notification-event-policy-report.html`.
