---
type: Work Package
title: Execution-default field lineage and merge
status: in_progress
updated: 2026-09-06
---

# WP-02 — Execution-default field lineage and merge

Parent: [full remediation plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).
This is part of the complete remaining-package objective, not a final closeout.

## Implemented locally

- Each typed input is an atomic field. Nested instruction arrays/objects are not
  recursively combined. Source cells preserve value presence separately from
  explicit JSON null; policy presence is also explicit.
- `execution_source_baseline` records exact immutable preset ID, revision, content
  hash and master revision for every known field. An older row is bootstrapped
  only from its exact previously copied preset, never the latest master.
- New full-object workspace edits derive changed dotted paths. Omitted prior
  values are explicit workspace clears; unchanged policies retain their authority.
- Untouched fields advance independently, while overrides and untracked divergence
  remain local. Competing source edits produce a stored conflict. An unrelated
  source revision refreshes the unresolved decision stamp without losing its base.
- `resetExecutionFields` accepts selected current source fields; `keepExecutionFields`
  records a local decision. Both require management permission, workspace ownership,
  catalog CAS and source-revision consistency. Invalid combinations fail atomically.
- Old `*`/whole-default markers retain whole-object protection until the existing
  whole-source resolver is explicitly accepted. Execution markers then reconcile;
  unrelated hospital-owned fields retain named protection.
- Type/schema or invalid cross-field proposals preserve saved values. Resolved
  contract conflicts clear after successful revalidation.
- Admin exposes source/override/conflict state and confirmable per-field actions.
  New chart/snapshot JSON freezes per-field source metadata; historical snapshots
  are not enriched or updated.
- Audit snapshots include baseline/conflict state and distinguish source acceptance,
  local retention and ordinary edits. Prior authorization, validation, workspace
  locking, source/preset guards and legacy clinical lifecycle checks remain intact.

## Verification

- `node scripts/test-wp01b-taxonomy-local.mjs`: passed. Actual local PostgreSQL
  transaction, publisher/adopter revisions3–6, source/override/clear/policy cases,
  unresolved-conflict revision refresh, contract recovery, keep/reset/whole-source
  accept, retry, CAS, protected metadata, permission denial and foreign/history
  fingerprints. Every migration/data change rolled back.
- Catalog contract suite:154 passed, including malformed lineage rejection and
  new-snapshot clone isolation/transport without replacing workspace values.
- Admin browser suite:9 passed, including confirmation cancel, keep/reset, reload,
  stale mutation, read-only controls and narrow viewport bounds. Catalog endpoints
  are explicit fixtures; this is not authenticated live-data evidence.
- Separate tenth browser case passed: dispensing-author permission does not grant
  administrator-only field-conflict resolution controls.
- TypeScript passed after source/UI implementation. Final combined type/lint/build
  and staged authenticated acceptance will be repeated with the later packages.
- Independent review identified stale conflict stamps, lingering contract conflicts
  and missing decision audit metadata; these were fixed and covered. The reviewer
  retracted a missing-preset finding after tracing the inherited adopter guard.

## Remaining acceptance boundaries

- Expand local coverage across dispensing and other typed schemas, including a
  source removal and rejected invalid compatibility-mirror changes.
- Complete combined WP-01B/02 authenticated persisted Admin→chart→confirmation trace
  after the full active synthetic dataset is prepared.
- Prototype activation is separate: the existing clinical writer currently requires
  an accepted new-source record for active master edits. This package does not fake
  clinical validation or silently remove that condition. WP-09 must align the
  approved active, synthetic, not-clinically-validated dataset policy explicitly.
- No remote apply, master publication, workspace adoption, commit or deployment
  was performed in this checkpoint. Original522 reconciliation and final release
  evidence remain under WP-09.
