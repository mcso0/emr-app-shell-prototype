---
type: Work Package
title: Append-only actual execution results
status: in_progress
updated: 2026-09-06
---

# WP-08 — Actual execution/result contract

Parent: [full remediation plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).
This is an in-progress local implementation, not full package acceptance or deployment.

## Implemented boundary

- `order_execution_result_versions` stores one task/attempt's frozen plan/hash,
  actual payload, original performer/time, recording actor/time, variance reason,
  and append-only amendment chain. Public/anonymous/authenticated/service-role
  direct table operations are revoked; mutation is through authenticated RPCs.
- New routed execution completion is guarded at the task table. Recording and
  completing use one transaction and existing lifecycle/billing wrappers. Actual
  quantities do not rewrite confirmed plan or planned billing quantities.
- Queue read/mutate permissions, active membership, actor binding, plan hash,
  work-item revision, result-head revision and command hash are enforced in SQL.
  The HTTP endpoint has no demo-header/mock fallback.
- Re-request initialization previously required `pending` even on later updates,
  preventing attempt2 from starting. The history guard now limits that condition
  to INSERT while retaining immutable links and terminal-history checks.
- The reader accepts an explicit task ID within the work item's exact order and
  encounter, so repointing the projection after re-request need not hide history.
- The shared dialog starts actual values/time empty, shows the confirmed plan,
  and offers explicit amendments from the prior actual values. Completion UI is
  connected to dispensing/treatment and imaging. Local-only dispensing row/bulk
  completion is disabled when a persisted work item is selected.
- WP-07 adds separate manually attested actual records to chart-only confirmation
  for consultation/other/system-exam. Its deferred task INSERT guard prevents
  confirmation through the old RPC without actual v1. Chart history shows the
  original performer/time and append-only amendments with plan/head CAS. These
  fields never enter master defaults or rewrite the confirmed plan.
- Hospitalization uses the existing treatment care queue; chart history offers
  existing start/result actions for hospitalization and routed other, without
  introducing a dedicated inpatient execution engine.

## Local evidence

- Catalog/core contract suite174 passed, including five actual-result tests.
- Admin/preparation browser plus planning RPC route suite16 passed.
- Local rollback-only SQL passed: actual record+complete, same-command retry,
  mismatched retry rejection, variance requirement, amendment chain, immutable
  original snapshot, direct-table restrictions, and unchanged planned billing.
- TypeScript and focused lint passed after the treatment V2 integration.
- Actual dispensing browser test passed: empty initial inputs, explicit time and
  amount, completion/reopen, required amendment reason and retained prior value.
- Treatment V2 count/measurement/device-settings validation and real local RPC
  completion/retry/amendment pass; its focused browser test also passes with
  blank actual inputs and explicit device/settings entry (mocked API).
- WP-07 rollback-only SQL passed explicit chart actual creation for all three
  types, old-RPC bypass/missing/attestation denial, same-command retry, changed
  retry denial, immutable plan, amendment/retry/head CAS and foreign denial.
  Registered inpatient actual completion and unchanged billing also passed.
- Chart actual mocked-browser test passed blank/manual input, server denial then
  confirmation, persisted task reopen and reason-required amendment with v1
  retained. Its contract/domain suites passed 9 tests.

## Open implementation/review findings

- Root-order locking was added before child locks to coordinate set cancellation/
  re-request. Two-session races and historical read after re-request still need
  executable proof, not only source review.
- Laboratory results remain owned by OED-LAB-04's typed graph, profiles and retest
  semantics; this generic actual envelope does not replace lab result rows.
- Full cross-workspace/role matrix, real
  authenticated browser verification and final full-manifest adoption/delivery.

No remote application, publication, migration deployment or full WP-08 completion
is claimed. Continue the [remaining package ledger](./EXECUTION-remaining-packages.md).
