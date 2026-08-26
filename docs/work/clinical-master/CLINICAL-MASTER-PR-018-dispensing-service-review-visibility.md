---
id: "CLINICAL-MASTER-PR-018"
type: "Work Item"
title: "Dispensing service-review visibility and execution"
description: "Makes the 108 inactive PR-017 dispensing candidates visible and executable for representative service review in exactly three synthetic workspaces without claiming clinical approval."
status: "completed"
area: "clinical-master"
priority: "P0"
tags: ["clinical-master", "dispensing", "service-review", "synthetic-demo"]
target_pr: "Dispensing service-review visibility"
source_docs:
  - "docs/engineering/data-model/clair-clinical-master-data-target-architecture.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-017-evidence-grounded-dispensing-order-master.md"
dependencies: ["CLINICAL-MASTER-PR-017"]
updated: "2026-08-26"
remote_writes: 6
---

# Clinical Master PR-018: Dispensing service-review visibility

## Goal

Expose the 108 PR-017 dispensing candidates in chart search and carry selected
orders through confirmation and the dispensing fulfillment queue for customer-
facing service-operations review.

## Scope

- Allowlist only `clair-demo`, `workspace-clair-cheongdam`, and
  `workspace-clinical-master-pilot-v1`.
- Preserve `pending_activation` and `clinical_use_allowed = false`.
- Mark every exception lineage as `serviceReviewOnly` and release-pin it to
  release 13 (`78a57bf0-10a8-47db-9ae1-8a8cff79b2c4`).
- Require authenticated `service_catalog:view` permission for chart search.
- Preserve the source product species and route evidence. For this explicitly
  allowlisted service-operations review only, record
  `speciesUseBasis = service_operations_review` instead of claiming a
  veterinarian extra-label attestation that the review UI does not collect.
- Preserve confirmation snapshots and Task/Queue creation. Unpriced review
  rows force billing reflection off and create no Billing candidate.
- Keep `clair-foreign-demo` unchanged.

## Out Of Scope

- Clinical approval or real-hospital activation.
- Real patient, guardian, staff, payment, or prescription data.
- Controlled-substance activation.
- Airtable mutation or modification of the PR-017 master dataset.
- Inventory, label printing, lot, expiry, and actual dispense-event facts.

## Done Criteria

- Each target workspace returns exactly 108 service-review dispensing rows;
  `clair-foreign-demo` returns zero.
- A non-member cannot read the rows.
- Chart search visibly labels the rows as `서비스 검토용`.
- Selected rows preserve lineage through order confirmation and fulfillment
  queue readback.
- Focused tests, lint, TypeScript, build, docs check, Release Check, PR merge,
  production deployment, and scoped smoke pass.

## Remote State

- Supabase project: `qmerxgzrwaaahpkhjqlc`.
- Applied migrations: `20260826093004`, `20260826093201`,
  `20260826093549`, `20260826095444`, `20260826095618`, and
  `20260826100007`.
- Readback: 108 service-review rows in each target workspace; foreign control
  zero; fake authenticated non-member zero.
- Event table has RLS, no external table grants, and immutable update/delete.
- The authenticated chart-search definer RPC has a fixed `pg_catalog`
  `search_path`, explicit workspace-permission check, and no anonymous or
  service-role execute grant.

## Verification

```bash
npx playwright test tests/chart-dispensing-order-execution.spec.ts tests/clinical-master-dispensing-service-review-migration.spec.ts
npx tsc --noEmit --pretty false
npm run lint
npm run docs:check
npm run build
```

- Focused chart, migration, and fulfillment suite: 29 passed.
- TypeScript, ESLint, docs links, secret scan, and production build: passed.
- Supabase readback: 108 rows per target, foreign zero, fake non-member zero.
- Execution readback: one Cheongdam synthetic order confirmed with exactly one
  universal Task and one dispensing Queue projection, zero Billing candidates,
  and visible Queue readback. The order remains `serviceReviewOnly` and does
  not claim clinical approval.
- The chart draft auto-save now runs only after an actual edit. This prevents
  the saved ETag from changing continuously and racing explicit confirmation;
  the focused hotfix suite passes 15 tests.
- Supabase advisors: no new unresolved release-blocking finding. The private
  append-only event table intentionally has RLS with no client policy, and the
  authenticated definer RPC is intentionally exposed behind its explicit
  workspace-permission check and fixed `pg_catalog` search path.

## Rollback

Append a `revoked` event for the same workspace and release. The latest event
immediately removes service-review search and new-order eligibility without
deleting catalog rows or mutating clinical-review state. Application rollback
uses the immediately preceding Ready production deployment.
