---
id: "DEMO-DB-PR-001"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Demo DB PR 1"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/engineering/demo-data-architecture-2026-06-08.md"
dependencies:
  - "DEMO-DATA-PR-001"
updated: "2026-06-08"
---

# Seed Inventory And Readback Contract

## Goal

Define the local/dev Supabase seed inventory and readback contract for `workspace_id = 'clair-demo'` before UI rewiring or broad demo seed expansion.

## Scope

- Analyze current `supabase/seed.sql` coverage against the Demo Data Architecture required seed families.
- Add a read-only SQL readback snippet for current baseline coverage and known seed gaps.
- Add a focused static contract test that keeps the readback SQL, inventory doc, and current seed gap claims aligned.
- Document pass/fail criteria, execution commands, confirmed coverage, confirmed gaps, and the recommended next PR.

## Out Of Scope

- UI rewiring.
- Remote Supabase, production DB, migration push, or staging replay.
- Real hospital, patient, guardian, staff, billing, or medical data.
- Large seed expansion.
- Direct changes to `supabase/seed.sql`.

## Done Criteria

- Seed inventory/readback document exists under engineering data-model docs.
- SQL snippet exists under `supabase/snippets/` and is read-only.
- Focused contract test covers checklist areas and known gaps.
- Engineering README/data-model README link the new contract.
- `npm run docs:check`, `npm run security:secrets`, and the focused test pass or blocked verification is recorded.

## Verification

- `npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`

## Result

Added Demo DB PR 1 seed inventory and readback contract without changing UI or seed rows. The current synthetic seed covers the outpatient demo baseline from auth/workspace through reception, chart, orders, billing, payments, and audit. Known seed gaps remain for hospital-admin order catalog rows, order sets, lab result-sheet catalog rows, and precomputed fulfillment work items.
