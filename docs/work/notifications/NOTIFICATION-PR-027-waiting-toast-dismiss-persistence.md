---
id: "NOTIFICATION-PR-027"
status: "human_review"
area: "notifications"
priority: "P1"
target_pr: "Reception waiting toast persistent dismissal"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/product/features/notifications/global-notification-center-v0-event-policy.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-019-reception-waiting-over-30m-producer-wiring.md"
  - "docs/work/notifications/NOTIFICATION-PR-026-remaining-producer-db-persistence-adoption.md"
updated: "2026-09-13"
---

# Reception Waiting Toast Persistent Dismissal

## Goal

Keep the reception waiting alert while allowing a user to archive one repeated `waiting_over_30m` notification so it does not return after queue refresh, page reload, or a later priority bump.

## Scope

- Rename the transient toast action from `나중에 보기` to `닫기`.
- Show `이 알림 다시 보지 않기` only for `waiting_over_30m` toasts.
- Reuse the existing authenticated per-user archive mutation and notification archive drawer.
- Remove the toast only after archive persistence succeeds and prevent repeated submission while it is pending.
- Preserve existing per-user read/archive state when the same waiting notification is bumped.
- Keep the existing repeat policy for every other notification event.
- Apply the additive RPC migration to the connected synthetic production project during the approved release.

## Out Of Scope

- Changing the 30-minute or 60-minute thresholds.
- Completing guardian guidance or reception work from the toast.
- Improving the `접수 대기 열기` source navigation.
- Adding timed snooze, global event preferences, or shared team acknowledgement.
- Changing notification RLS, table structure, or other event producer policies.

## Done When

- Closing a toast remains transient.
- Archiving a waiting toast succeeds only through the existing authorized server mutation.
- A repeated waiting event preserves the current user's archived state.
- Another user and a later queue entry retain independent notification state.
- Archive failure leaves the toast visible and exposes the existing error feedback.
- Focused notification UI, persistence, type, lint, build, docs, and secret checks pass.
- The approved PR is merged to `main`, the migration is applied, and production smoke confirms the scoped behavior without real data.

## Verification

- `npx playwright test tests/notification-toast.spec.ts tests/notification-persistence-contract.spec.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run security:secrets`
- `npm run docs:check`
- `git diff --check`

## Verification Result

- Focused Playwright notification and persistence contracts passed: 21 tests.
- Storybook browser interactions passed: 4 stories, including archive success and failure retention.
- The additive migration compiled and preserved a waiting alert's archived state in a local Postgres transaction; the transaction also proved that another event keeps the existing reset-on-bump policy and was rolled back.
- The additive migration was applied to the connected synthetic Supabase project. Readback confirmed the new function fingerprint, waiting-state preservation branch, and authenticated-only execution grant.
- Full lint passed with five pre-existing unused-variable warnings and no errors.
- Typecheck, production build, secret scan, Korean UX copy check, docs check, and whitespace check passed.

## Handoff Notes

The persistent toast action is an archive operation, not a reception or guardian-guidance completion. Restore remains available in the existing notification drawer.
