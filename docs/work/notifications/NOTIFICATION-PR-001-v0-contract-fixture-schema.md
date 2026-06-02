---
id: "NOTIFICATION-PR-001"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-395"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/home/home-command-entry-planning.md"
  - "docs/product/features/home/home-v1-ui-spec.md"
  - "docs/completed/design/2026-06-02-global-notification-center-planning-report.html"
dependencies: []
updated: "2026-06-02"
completed_report: "docs/completed/design/2026-06-02-den-395-notification-v0-contract-report.html"
---

# Notification v0 Contract And Fixture Schema

## Goal

Define the v0 global notification center contract and fixture schema before implementation starts.

## Scope

- Create the canonical notification v0 product contract.
- Define event rule fields: `requires_action`, `badge_count`, `toast_policy`, recipient, source target, and dedupe key.
- Define fixture shape for all v0 event categories.
- Lock badge calculation to `unread && badge_count === true`.
- Document `localStorage` read/archive state and role queue non-sync limitations.
- Document source missing and permission-unavailable fallback behavior.

## Out Of Scope

- Live push, service worker, or provider delivery.
- Kakao, SMS, or email notification channels.
- Remote Supabase migration, RLS, or live validation.
- Notification publisher/admin system.
- Free mention/comment notification system.
- Final clinical, billing, or reception action inside notifications.

## Done When

- `docs/product/features/notifications/global-notification-center-v0-contract.md` exists and is linked from docs navigation.
- All v0 events can be represented by the fixture schema.
- Badge, read/archive, source, dedupe, and toast policies are explicit.
- `npm run docs:check` passes.
- A Korean closeout report is created under `docs/completed/`.

## Verification

- `npm run docs:check`

## Handoff Notes

Use DEN-396 for event matrix and UX writing details after this contract is accepted. Keep DEN-395 focused on the schema, resolver contract, storage boundary, and navigation fallback policy.

## Completion Notes

- Added `docs/product/features/notifications/global-notification-center-v0-contract.md`.
- Linked the contract from Product docs, GitBook summary, Docs portal, and Home notification boundary docs.
- Promoted the notification center inbox item into this PR-sized work item.
- Added Korean closeout report at `docs/completed/design/2026-06-02-den-395-notification-v0-contract-report.html`.
