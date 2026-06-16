---
id: ENGINEERING-TESTING-API-BACKED-DEMO-RUNBOOK
status: active
area: engineering
doc_type: runbook
last_updated: 2026-06-11
related_work:
  - DEN-457
  - DEN-458
  - DEN-459
  - DEN-460
---

# API-Backed Demo Runbook

This runbook explains how to verify the current synthetic `clair-demo` outpatient demo without touching remote or production Supabase.

## Current Claim

The project can show a local-first, synthetic API-backed EMR demo foundation for the scoped outpatient flow:

1. reception and chart queue context
2. chart order actions
3. fulfillment work-item queues
4. lab result-sheet catalog and result-entry boundary
5. billing invoice/payment/checkout snapshots
6. audit review surface

This is not a production/live claim. Mock fallback remains intentionally available for Sales Demo and unconfigured local sessions.

## Environment Boundary

Allowed by default:

- local app runtime
- local/dev/test Supabase
- synthetic `clair-demo` seed data
- Playwright route/UI/API regression tests

Approval-gated:

- remote Supabase link, SQL, migration push, or dashboard mutation
- production deploy or production monitoring changes
- real hospital, patient, guardian, staff, billing, payment, or medical data
- real payment provider, email, KakaoTalk, PACS, device, or external provider integrations

## Fast Docs And Safety Check

Use this when the work is docs-only or when checking handoff readiness:

```bash
npm run docs:check
npm run security:secrets
```

Expected result:

- docs check reports internal docs references are good
- secret scan reports no tracked secret-shaped values

If this fails, treat it as a documentation or repository hygiene blocker before handing the issue to Human Review.

## Seed Replay Check

Use this before depending on local Supabase readback:

```bash
npm run demo:seed:check
```

This command is diagnostics-only and does not mutate the database.

When local `psql` is available and `SUPABASE_LOCAL_DB_URL` points to localhost, run:

```bash
npm run demo:seed:check -- --readback
```

Failure interpretation:

- `environment_gap`: local tooling or local DB is missing. Typical causes are Docker Desktop not running, Supabase CLI not installed, `psql` not installed, or the local DB is not started/reset.
- `remote_guard`: the DB URL does not point to a local host. Do not bypass this for remote/prod replay without explicit approval.
- `seed_gap` or SQL baseline failure: the synthetic seed/readback contract regressed.

## Focused Regression Commands

Use the narrowest command that matches the work item.

```bash
npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line
npx playwright test tests/lab-result-entry-persistence-contract.spec.ts --reporter=line
npx playwright test tests/dispensing-fulfillment.spec.ts --reporter=line
npx playwright test tests/api-boundary-permission-regression.spec.ts --reporter=line
npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts --reporter=line
```

What they prove:

| Command | Proof |
| --- | --- |
| `tests/demo-seed-inventory-readback-contract.spec.ts` | static and SQL-snippet contract for the `clair-demo` seed inventory |
| `tests/lab-result-entry-persistence-contract.spec.ts` | local/dev/test lab result-entry persistence contract and route expectations |
| `tests/dispensing-fulfillment.spec.ts` | visible dispensing/treatment fulfillment readback and mutation state |
| `tests/api-boundary-permission-regression.spec.ts` | unauthenticated, insufficient-role, and cross-workspace API denial paths for connected lab/billing/fulfillment APIs |
| `tests/ui-demo-api-wiring-e2e.spec.ts` | visible day-in-clinic route/UI proof from reception through audit for the selected synthetic path |

## Broad Implementation Check

Use this after touching TypeScript, route handlers, feature modules, or shared helpers:

```bash
npx tsc --noEmit
npm run lint
```

Known lint baseline as of DEN-459:

- `scripts/owner-os.mjs`: unused `normalized`
- `src/features/auth/workspace-membership-management.tsx`: existing hook dependency warning
- `src/features/chart/module.tsx`: existing hook dependency warnings
- `src/features/hospital-admin/store.ts`: unused `hospitalOrderCategories`

Do not treat these warnings as new regressions unless the active work changes those files or warning counts.

## Demo Flow Interpretation

Passing the visible E2E means the selected synthetic path exercised the current API/server boundaries. It does not mean:

- every screen has removed mock/local state
- every clinical table is fully live-persistent
- remote Supabase has been validated
- production RLS and compliance are complete
- external payment, email, PACS, device, or provider integrations exist

When reporting results, state the exact command, whether it passed, and whether any failure was an environment gap, seed gap, route/API regression, UI regression, or approval-gated remote/live task.
