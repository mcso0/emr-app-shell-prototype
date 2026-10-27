---
id: ENGINEERING-DB-PR-004
status: deferred
area: engineering
type: Work Item
title: Remove historical data dependencies from clean migration replay
description: Separate fresh schema reconstruction from historical synthetic rollout assumptions.
tags: [supabase, migrations, replay, follow-up]
---

# Clean Migration Replay

## Goal and Evidence

Reconstruct an empty Supabase project without automatic API grants and without
copying remote data. At `aa26f7c424967a627be498a48f47820562a8702b`, transactional
replay passed 199 of 310 files and stopped at
`20260826160000_clinical_master_dispensing_service_review.sql`: its unconditional
insert assumes an existing `clair-demo` workspace and a specific master release.
The normal seed.sql runs after migrations and cannot satisfy this dependency.

Diagnostic-only synthetic workspace/release prerequisites allowed investigation
of later files. Pricing required exactly 108 adopted dispensing rows; presets
required specific profiles. The diagnostic continuation recorded 25 failed files,
including cascaded missing-object/patch-anchor errors, not 25 independent bugs.
Do not weaken assertions or fabricate catalog records to label replay successful.

## Proposed Scope and Done Criteria

- Classify schema changes, historical one-time data transformations, and required
  synthetic bootstrap data; inspect existing seed and reviewed fixture sources.
- Choose a safe fresh-install strategy while preserving already-applied migration
  history and deployed behavior. A final additive migration cannot repair a failure
  that occurs earlier in replay.
- Run all migrations and approved seeds on a disposable empty platform without
  default grants; then validate intended ACL/RLS, representative RPCs, isolation,
  and unchanged existing-project upgrade behavior.
- Keep real data import, remote mutation, and clinical/business rule changes out.

## Authorization and Related Work

Recording only is authorized. Repair strategy, implementation, and remote work
require a separate scoped request. Existing [DEN-458](../demo-data/DEN-458-local-supabase-replay-hardening.md)
covers local tool diagnostics/readback and explicitly excludes schema/migration
changes; this item owns the newly demonstrated historical-data dependency.
[DB-PR-002](ENGINEERING-DB-PR-002-fulfillment-rls-helper-grant.md) is independent.
[DB-PR-003](ENGINEERING-DB-PR-003-public-table-rls-replay-gap.md) tracks RLS parity.

## Sources

- [First failed migration](../../../supabase/migrations/20260826160000_clinical_master_dispensing_service_review.sql)
- [Pricing assertion](../../../supabase/migrations/20260826190000_clinical_master_dispensing_service_review_pricing.sql)
- [Seed configuration](../../../supabase/config.toml)

No replay repair or remote action performed in this task.
