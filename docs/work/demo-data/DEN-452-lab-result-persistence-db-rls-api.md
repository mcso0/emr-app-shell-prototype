---
id: "DEN-452"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-452"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
  - "docs/work/demo-data/UI-PR-002-fulfillment-billing-ui-wiring-e2e.md"
dependencies:
  - "DEMO-DB-PR-004"
  - "UI-PR-002"
updated: "2026-06-09"
---

# Lab Result Persistence DB RLS API

## Goal

Replace the UI PR 2 local/dev lab result-entry server-boundary proof with a durable local/dev Supabase persistence foundation for entered lab result values.

## Scope

- Add local/dev/test Supabase schema for lab result entry headers and structured result rows.
- Enforce workspace membership at the DB/RLS/RPC layer for lab result entry reads and writes.
- Save lab result values through a workspace-scoped RPC that validates encounter, lab order, and optional lab fulfillment work item scope.
- Read saved lab result entries by result id, work item id, or order id.
- Update the existing result-entry API route to use the Supabase RPC path for authenticated sessions while preserving the demo-header fallback path.
- Pass seeded lab test item ids from the lab/imaging UI into saved result rows.
- Add focused contract coverage and extend the existing UI/API wiring E2E with result readback after save.

## Out Of Scope

- Remote Supabase, production DB, migration push, or provider integration.
- Seed data changes.
- UI redesign or broad mock-store removal.
- Analyzer/device integration, reference lab integration, PACS, receipt, refund, settlement, or accounting integration.
- Real hospital, patient, guardian, payment, or clinical data.

## Done Criteria

- Lab result entries can be stored in durable DB tables in local/dev/test environments.
- Result rows can link back to seeded `lab_test_items` when the UI has a catalog item id.
- RLS policies and RPC membership checks use the active workspace membership boundary.
- The API route checks server-side permissions before calling the DB RPC path.
- Existing Sales Demo/mock fallback still works for unconfigured local sessions.
- Focused tests cover schema/RLS/RPC/API/UI wiring expectations.

## Verification

- `npx playwright test tests/lab-result-entry-persistence-contract.spec.ts --reporter=line`
- `npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `npx supabase migration up --local`
- `npx supabase db reset`
- Local DB transactional RPC readback through `clair_save_lab_result_entry` and `clair_get_lab_result_entry`.

## Result

DEN-452 adds the durable local/dev lab result value persistence foundation that UI PR 2 intentionally left out. The result-entry route can now save and read lab result rows through Supabase RPCs under server permission checks for authenticated sessions, while preserving the demo fallback path for mock-mode usage.

The local Supabase replay was verified after Docker became available: pending migrations applied, `supabase db reset` replayed migrations and `supabase/seed.sql`, and a transactional RPC readback returned the saved WBC value `21.4`. The remaining work is DEN-453 lab result UX state handling, followed by billing and dispensing/treatment mock-store reduction in later issues.
