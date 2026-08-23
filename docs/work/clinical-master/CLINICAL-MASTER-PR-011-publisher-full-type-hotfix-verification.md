---
id: "CLINICAL-MASTER-PR-011"
status: "implemented"
area: "clinical-master"
priority: "P0"
target_pr: "Full-type clinical-master publisher hotfix verification"
execution_boundary: "local-only"
predecessor: "CLINICAL-MASTER-PR-010"
updated: "2026-08-23"
---

# Clinical Master PR-011: Full-Type Publisher Hotfix Verification

## Status and boundary

This work item is the local verification gate for the additive full-type
publisher hotfix. The gate passed with Sol `APPROVE/MUST-FIX 0`; PR-010 now
waits on scoped Git delivery. No production publish, workspace adoption,
authenticated smoke, or remote migration is claimed here. The replay is
rollback-only and uses synthetic fixture data.

Included in this slice:

- `supabase/migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql`:
  direct reapply-safe constraint/function replacement, A1 typed-pass ordering,
  and generated clinical-action `actionCode` in stage/effective content and
  immutable snapshots.
- `tests/fixtures/clinical-master-publisher-full-type-hotfix.fixture.json`:
  83-record, all-11-type fixture with collision-safe fallback identities,
  five valid chart-group codes, five classification paths, 13 panel items,
  and 17 lab-order profiles. Eleven existing fallback identities are retained
  by ID; the remaining 72 records are fresh publisher rows.
- `supabase/snippets/clinical_master_publisher_full_type_hotfix_replay.sql`:
  local `psql` replay that re-applies the migration inside a transaction,
  publishes the fixture, checks typed/stage/specialized rows and actionCode,
  fingerprints all pre-existing durable lab-stage rows across the first
  publish, idempotent retry, and v2 order-only change, probes exact natural
  code collisions for chart groups/task routes/species, checks same-payload
  idempotency, proves the unchanged action revision/actionCode remain stable,
  then ends with `ROLLBACK`.
- `tests/clinical-master-publisher-full-type-hotfix.spec.ts`: static contract
  checks for the exact 11-type guard, A1 pass order, actionCode call sites,
  private ACL/search path, replay assertions, and direct reapply marker.

Out of scope: Airtable API access, remote Supabase writes, production or
authenticated browser smoke, direct table inserts, and any change to the
PR-008/PR-009 authoring or adapter implementation.

## Approval and user chain

The predecessor PR-010 request chain records:

- `모두 승인`
- `필요한 승인 미리 승인`
- latest continuation: `고고해보자`

Those approvals authorize only PR-010's exact synthetic production smoke
boundary. PR-011 uses no remote authority; its local replay is limited to a
transaction that is explicitly rolled back.

## Immutable input locks

| Input | SHA-256 |
| --- | --- |
| Airtable authoring snapshot | `44a0fd0f22030b9052efae80077067615177976a08583705b34c67a3846a6216` |
| Adapter result | `c15ed6176ef860b4607385537bb91e2b091f1f3c36f15f4dfaec874490fd0e2b` |
| Exact compact publisher `.payload` | `0ff241fd3281a0e7170773dc49f978eea35e8968a79ad8800070955ed16f484e` |
| Pretty PR-011 fixture JSON | `8db6d81eef378bbc5d7b848dee38cd06cddc3df6cc91ef3ab1d2ce685c4f618c` |
| PR-011 migration SQL | `1d8d12e71aa23c2b5c4867e9601ab925bbda622b1d6940720fa2b7da929e1015` |
| PR-011 rollback replay SQL | `26bd851fc59cbc64981aa3cfe1da0c685142eb7a6bef8822016b718ec5f265c2` |
| PR-011 focused spec | `3ea9718d79036e8a7b6fa2836ddd2ef90459e0deb89e09cd86d1cd7eedd61e37` |

The pretty fixture is semantically equal to the locked compact publisher
payload. The five chart-group values are the canonical database values:
`CG_CONSULTATION`, `CG_MEDICATION_SUPPLY`, `CG_PROCEDURE`, `CG_EXAM`, and
`CG_THERAPY`.

The collision remediation keeps the 11 existing `phase1a2.fallback.*`
identities at their existing IDs and advances each exact identity by one
revision on first publish. The replay therefore expects 72 fresh
`master_records`, chart groups `+1`, task routes `+0`, species `+0`, and five
new classification-path rows. The same payload is idempotent, and the
classification-path relations continue to target the existing Airtable
record-linked identities rather than creating duplicate fallback rows.
The temporary `.tmp-airtable-operational-pilot-authoring.json` is retained for
hash verification only and is explicitly excluded from commits.

## Prior rollback evidence

The completed B1 work item records the predecessor evidence: local synthetic
PostgreSQL reset/reapply, `ON_ERROR_STOP` replay, transaction rollback cleanup,
typed projection, lineage, RLS/grant, and direct-DML security gates passed.
The source-backed replay remains
[`clinical_master_phase1b1_replay.sql`](../../../supabase/snippets/clinical_master_phase1b1_replay.sql),
and the recorded closeout is
[`CLINICAL-MASTER-PR-004`](./CLINICAL-MASTER-PR-004-phase-1b-1-laboratory-slice.md).
PR-011 adds a direct migration reapply marker and keeps its own replay
transaction rollback-only; no prior evidence is reused as production proof.

## Verification record

Run the focused static test first, then the A1/B1/diagnosis/PR-008/PR-009
regression set and repository checks:

```text
npx playwright test tests/clinical-master-publisher-full-type-hotfix.spec.ts --reporter=line
npx playwright test tests/clinical-master-publisher-full-type-hotfix.spec.ts tests/clinical-master-airtable-publish-adapter.spec.ts tests/clinical-master-airtable-authoring-export.spec.ts tests/clinical-master-phase1a1.spec.ts tests/clinical-master-phase1b1.spec.ts tests/clinical-master-diagnosis-foundation.spec.ts --project=chromium --reporter=line
npx tsc --noEmit --pretty false
npx eslint --max-warnings=0 tests/clinical-master-publisher-full-type-hotfix.spec.ts tests/clinical-master-airtable-publish-adapter.spec.ts tests/clinical-master-airtable-authoring-export.spec.ts scripts/clinical-master-airtable-publish-adapter.ts src/features/clinical-master/server-clinical-master-airtable-publish-adapter.ts src/features/clinical-master/server-clinical-master-airtable-export-core.ts
npm run docs:check
git diff --check
```

Local Supabase replay may be run only against an isolated/local database with
no reset of shared state. The available local Docker database was used with a
single rollback-only transaction; no remote runtime result is implied.

Current verification status: the static gate and local runtime replay passed.
The direct migration reapply emitted
`clinical_master_publisher_full_type_hotfix_direct_migration_reapply_ok`, the
replay emitted `clinical_master_publisher_full_type_hotfix_replay_ok`, and
the transaction ended with `ROLLBACK`. Post-rollback readback showed zero
target release rows, zero `cm.*` supported master rows, and all 11 pre-existing
fallback identities remained at revision 1. No shared-state reset or remote
write was performed. The natural-code probe notice
`clinical_master_publisher_full_type_hotfix_natural_collision_probes_ok` also
passed for the exact chart-group, task-route, and species unique constraints;
the local baseline had zero pre-existing lab-stage rows, while the replay
fingerprint is written to preserve any pre-existing rows when present.

The locally verified migration is handed to PR-010 as the exact remote
candidate `supabase/migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql`
(the remote application/readback sequence and migration SHA are owned by
PR-010). This PR-011 work item remains local-only and does not claim that the
remote migration, publisher, adopter, or smoke has run.

Sol's initial review disposition was `REJECT/MUST-FIX 3`. The three findings
were corrected, and the final re-review returned `APPROVE/MUST-FIX 0`. Remote
operation and Git delivery remain separate, unperformed steps owned by PR-010.

## Closeout fields

```text
Focused PR-011 spec: PASS (3/3)
A1/B1/diagnosis/PR-008/PR-009 regression: PASS (40/40, Chromium)
TypeScript: PASS (`npx tsc --noEmit --pretty false`)
ESLint: PASS (focused Airtable/publisher adapter and PR-011 files)
Docs check: PASS (917 docs/agent markdown files)
Diff check: PASS (`git diff --check`)
Safe local replay: PASS (direct reapply + publish/idempotency/v2 checks + rollback)
Final status: implemented; Sol APPROVE/MUST-FIX 0; ready for scoped Git delivery
```
