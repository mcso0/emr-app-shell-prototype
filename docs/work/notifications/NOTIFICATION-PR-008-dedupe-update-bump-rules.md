---
id: "NOTIFICATION-PR-008"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-402"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-007-badge-recipient-action-rules.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-402-notification-dedupe-update-bump-report.html"
---

# Notification v0 Dedupe Update Bump Rules

## Goal

Prevent repeated unread operational events with the same patient, order, and event key from appending noisy duplicate rows.

## Scope

- Add a stable dedupe key helper for patient + optional order + event key.
- Add a shared upsert helper that row and toast state can reuse.
- Bump an existing unread, unarchived row with the same dedupe key.
- Preserve the existing row ID and local read/archive state while updating latest preview/detail/time metadata.
- Append a new row when the existing matching row has already been read or archived.
- Append a new row for different patient, order, or event keys.

## Out Of Scope

- Live event stream ingestion.
- Provider/device real integration.
- Remote Supabase migration/RLS/live validation.
- Audit log dedupe policy changes.
- Toast stack UI rendering.

## Done When

- Same dedupe key + unread/unarchived keeps one row and bumps metadata.
- Different dedupe key appends.
- Read or archived historical rows do not get silently resurrected; new repeats append as new alerts.
- Focused tests lock the policy.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`

## Handoff Notes

This helper establishes shared row/toast dedupe policy, but DEN-403 still owns visible toast stack behavior. Read/archive repeat handling is intentionally conservative: acknowledged or archived historical rows stay historical, and a new repeat appends as a new unread signal.
