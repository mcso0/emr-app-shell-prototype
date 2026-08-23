---
id: "CLINICAL-MASTER-PR-007"
status: "implemented"
area: "clinical-master"
priority: "P0"
target_pr: "Private diagnosis master schema reservation"
updated: "2026-08-23"
---

# Clinical Master PR-007: Diagnosis Foundation

## Status

Implemented as a schema-only, private foundation. The forward migration adds
the diagnosis record types and exactly three `master.*` tables for category
hierarchy, diagnosis identity, and diagnosis-to-disease-group links. It adds
typed guards, disease-group-only link targets, RLS with no policies, explicit
role/helper revokes, immutable typed identities, and deferred commit-time
completeness requiring at least one link and exactly one primary link per
persisted diagnosis.

## Boundary

This slice creates no diagnosis rows, backfill, publisher replacement, release/
version/review writes, workspace adoption, public diagnosis/API changes, chart
or UI changes, Airtable/seed/care-guide changes, or remote database work. The
existing Phase 1B-1 publisher remains unchanged and rejects `diagnosis_category`
and `diagnosis` record types.

## Verification

- `tests/clinical-master-diagnosis-foundation.spec.ts`: focused static contract,
  predecessor-file, replay, RLS/revoke, and publisher-unsupported checks pass.
- `git diff --check`: pass.
- In an isolated temporary local Supabase project, separate from the user's
  existing local database, a fresh start applied all 158 migrations including
  PR-007 successfully.
- The transaction-only replay passed with `BEGIN`, `SET CONSTRAINTS`, `DO`,
  `ROLLBACK`, and the
  `clinical_master_diagnosis_foundation_replay_cleanup_ok` marker. A direct
  PR-007 migration reapply also succeeded, and the replay rerun passed with the
  same rollback and cleanup marker.
- Existing Phase 1 A1/B1 publisher specs: 16/16 passed.
- No remote database application or replay was performed; the replay rolled
  back without retaining diagnosis rows, and publisher/Airtable/workspace/
  chart/UI adoption remains out of scope.

## Next gate

PR-008 is now the implemented, local-only authoring/export contract for the
reviewed synthetic diagnosis snapshot; it does not publish diagnosis rows or
change the current SQL publisher. A later, separately approved diagnosis
publisher slice must define publishable diagnosis payloads,
release/version/review snapshots, and any workspace/chart adoption before
these reserved tables can receive canonical rows. See the [PR-008 work
item](CLINICAL-MASTER-PR-008-airtable-authoring-export-contract.md).

## Result report

[비개발자용 PR-007 결과 보고서](../../completed/clinical-master/2026-08-23-clinical-master-pr-007-diagnosis-foundation-report.html)
