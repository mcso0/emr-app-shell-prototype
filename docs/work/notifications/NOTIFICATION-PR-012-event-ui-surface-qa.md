---
id: "NOTIFICATION-PR-012"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Project 20 / DEN-406"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v0-contract.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-011-dirty-state-notification-navigation-guard.md"
updated: "2026-06-03"
completed_report: "docs/completed/design/2026-06-03-den-406-notification-surface-qa-report.html"
---

# Notification v0 Event UI Surface QA

## Goal

Verify that v0 notification events map consistently across drawer, toast, and inline alert surfaces.

## Scope

- Add a testable surface resolver for drawer, toast, and inline alert eligibility.
- Keep every v0 notification reviewable in the drawer.
- Suppress toast for `drawer_only` and `inline_first` events.
- Gate `role_active` toasts by current recipient ownership and current unread/unarchived state.
- Gate `source_context_only` toasts by current source workflow proximity.
- Add a notification inline alert wrapper over `EmrInlineAlert` for inline-first recovery surfaces.
- Confirm notification actions remain navigation/detail only, not final clinical/billing/reception actions.

## Out Of Scope

- Wiring a live event stream into toast emission.
- Refactoring chart, reception, billing, or inpatient feature-local inline alert systems.
- Building a full notification page or notification preferences UI.
- External provider/channel delivery.
- Remote Supabase migration/RLS/live validation.

## Done When

- All fixture notifications resolve to drawer visibility.
- Drawer-only reference notifications do not toast.
- Inline-first source recovery notifications prefer inline alert and do not toast.
- Role-active/source-context toast eligibility is covered by focused tests.
- QA notes and screenshot are available for Human Review.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-surfaces.spec.ts tests/notification-toast.spec.ts tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"`
- `npm run docs:check`

## Handoff Notes

Subagent QA confirmed `EmrInlineAlert`, `NotificationToastCard`, and drawer fallback detail are the relevant v0 surfaces. DEN-406 intentionally avoids broad module integration and keeps live toast event wiring as a later implementation concern.
