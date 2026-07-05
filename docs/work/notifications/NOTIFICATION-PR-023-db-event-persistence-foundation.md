---
id: "NOTIFICATION-PR-023"
status: "human_review"
area: "notifications"
priority: "P0"
target_pr: "Notification DB event persistence foundation"
source_docs:
  - "docs/product/features/notifications/global-notification-center-v1-live-plan.md"
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
  - "docs/engineering/auth-security/auth-login/README.md"
dependencies:
  - "docs/work/notifications/NOTIFICATION-PR-018-v1-event-producer-foundation.md"
updated: "2026-07-05"
completed_report: "docs/completed/engineering/2026-07-05-notification-db-event-persistence-foundation-report.html"
---

# Notification DB Event Persistence Foundation

## Goal

Add the local/dev/test Supabase persistence contract for live notification events and user read/archive state so a later slice can replace the in-memory event/state stores without changing product semantics.

## Scope

- Add additive notification event and notification user-state tables.
- Add workspace-scoped RLS policies using existing membership helper boundaries.
- Add fixed RPCs for event upsert/list and user-state list/upsert.
- Preserve the current v1 event shape: dedupe key, event key, domain, priority, toast policy, source, recipient, title/preview/detail, badge/action flags, event scope, actor, and timestamps.
- Add a small TypeScript Supabase gateway contract that calls the fixed RPC names and maps stable error categories.
- Add focused contract/TDD coverage for migration structure, RLS/member checks, RPC names, and gateway RPC calls.

## Out Of Scope

- Wiring visible notification routes to the DB gateway.
- Replacing the in-memory event/state stores.
- Remote Supabase migration execution, staging/live replay, production deploy, or monitoring.
- Realtime/SSE delivery.
- External email, KakaoTalk, SMS, provider/device/PACS integrations.
- Real hospital/customer/patient/guardian/payment/identity data.

## Done When

- The migration defines event and user-state persistence tables with workspace scope.
- The migration enables RLS and active workspace-member policies.
- The migration exposes fixed RPCs for emit/list/state list/state upsert and grants execute to authenticated.
- The TypeScript gateway calls those RPCs with bounded, explicit payloads.
- Focused tests prove the DB persistence contract without requiring remote Supabase access.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-persistence-contract.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- targeted notification persistence lint
- `git diff --check`

## Verification Result

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/notification-persistence-contract.spec.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run docs:check` passed.
- `npx eslint src/features/notifications/server-notification-persistence.ts tests/notification-persistence-contract.spec.ts` passed.
- `git diff --check` passed.

## Handoff Notes

This slice intentionally stops at the persistence foundation. The current app can continue using the in-memory live notification stores until a follow-up async reader/producer adoption slice wires these RPCs into the route and producer paths.
