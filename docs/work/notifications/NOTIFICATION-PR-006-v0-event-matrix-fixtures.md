---
id: "NOTIFICATION-PR-006"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-400"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-005-localstorage-role-queue-disclaimer.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-400-notification-v0-fixtures-report.html"
---

# Notification v0 Event Matrix Fixtures

## Goal

Expand the mock notification fixture set so every approved v0 event key is represented with contract fields that downstream rule, toast, source navigation, and QA work can reuse.

## Scope

- Add representative synthetic fixtures for all ten v0 event keys.
- Include recipient, source target, `requires_action`, `badge_count`, `toast_policy`, priority, and dedupe key on every row.
- Include both badge-count action rows and unread reference rows that do not count toward the shell badge.
- Include one `fallback_detail` source case with `missing_source`.
- Keep data synthetic and demo-only.

## Out Of Scope

- Live event ingestion, provider/device real integration, remote Supabase migration/RLS/live validation.
- Kakao/SMS/email notifications.
- Notification publisher/admin system or free mention/comment system.
- Source navigation implementation and fallback detail UI behavior.
- Toast stack and dedupe resolver implementation.

## Done When

- All ten v0 event keys exist in `mockGlobalNotifications`.
- Required fixture contract fields are present.
- Reference rows such as dispensing/treatment completion and billing-ready remain unread without contributing to the shell badge.
- Drawer smoke renders the expanded fixture list without layout breakage.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`
- Playwright Chromium screenshot smoke at `http://localhost:3000/w/clair-demo/reception?modulePanel=open`

## Handoff Notes

DEN-400 provides representative fixture data only. DEN-401 owns badge/recipient/action resolver behavior, DEN-402 owns dedupe/update-bump implementation, and DEN-403 owns toast stack rendering.

## Completion Notes

- Added `order_recheck_requested`, `assigned_order_completed`, `device_result_received`, and `billing_waiting_ready` fixtures.
- Updated the imaging result fixture to match the approved action/badge policy while preserving its initial archived/read local state.
- Added optional contract context fields to the fixture type.
- Added fixture contract coverage tests.
