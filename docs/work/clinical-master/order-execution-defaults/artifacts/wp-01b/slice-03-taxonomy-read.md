# WP-01B Slice 03 — Exact-path read transport

2026-09-06. Local implementation and rollback verification complete for this
bounded follow-up. Slice 03 remains IN_PROGRESS. No remote writes, master/default
data repair, publication, commit, push or deployment. Existing dirty work preserved.

## What current evidence changed

Read-only staging SQL confirmed the deployed Admin v2 RPC omits classification
metadata and matches the repository's previous function. Exact path joins reveal
32 paths, including seven explicitly unclassified paths. This is not fine taxonomy:
paths have action/category/chart-group/route references, not Admin subtype or
pathology-family fields. No classification_nodes table is defined in the inspected
schema. Authoring data also places different modalities under one imaging path.

Cheongdam read-only catalog grouping: 85 clinical_lab rows use cm.path.laboratory,
30 imaging rows cm.path.imaging, 159 dispensing rows cm.path.dispensing, 42 treatment
rows cm.path.surgery-anesthesia. These are current persisted workspace row counts,
not a recount of the 522 candidate dataset. Thirteen rows use legacy unclassified
paths (lab 4, consultation 2, medication 1, hospitalization 1, imaging 2, treatment 3).
They were neither removed nor relabeled. Do not call this fallback cleanup complete.

## Implementation

- CLI-created migration `20260906070813_clinical_master_admin_classification_read.sql`
  extends the existing Admin RPC with an exact-row descriptor: path ID/key, action
  code/name, item type, T-category/chart-group/route codes, unclassified and retired
  flags. LEFT JOINs preserve rows; preferred Korean name lookup is bounded to one.
- Workspace filter, service_catalog:view guard, empty search_path, service-review
  projection and authenticated-only grant are unchanged. No new master table grant.
  Join via catalog.classification_path_id, not current master.orders classification.
- Gateway rejects malformed descriptor or mismatched path identity. Admin preserves
  discoverability for valid but conflicting/retired/unclassified paths. Broad paths
  do not become CBC, chemistry, oral/injection or X-ray/ultrasound by name inference.
- Table/drawer distinguish unavailable lookup from missing fine subtype. Drawer
  exposes saved action name/key/code. Names remain display-only and escaped by React.
- Create/review/update share authoritative readback; matching workspace, item,
  revision and path required. Failed readback preserves a successful committed write
  with classificationPathReadFailed and explicit unavailable display. No stale
  descriptor reuse or false retryable write failure. Metadata stays out of writes.

Review correction: the old update path already performed a best-effort Admin read;
the initial review's claim of universal save-time metadata loss was too broad.
This change unifies create/review and tightens mismatched/failed-read handling.
Independent follow-up review found no additional must-fix items.

## Verification

- 128 pure contract tests passed (106 prior + 22 taxonomy/readback tests).
- Targeted ESLint passed. Full tsc still fails baseline BlockNote dependencies;
  final run has no diagnostics in this follow-up's touched source/tests.
- Candidate SQL executed against existing local synthetic PostgreSQL container
  supabase_db_clinical-preset-perf-seeded-20260831 inside one BEGIN/ROLLBACK.
- Synthetic local and foreign catalog fixtures, authenticated exact lookup,
  previous response parity excluding only the descriptor, one-row cardinality,
  non-member and absent-auth denial, anon/service_role execute grants checked.
- Initial fixture omitted required price and correctly failed; explicit synthetic
  price 0 fixed the fixture. No production price or schema policy changed.
- After rollback: both fixture IDs absent, original function restored. No local
  migration history entry or durable DB mutation. SQL harness files adjacent.
- Staging checks were privileged read-only schema/grouping checks, NOT an
  authenticated application session or deployed candidate verification.
- Existing docs:check persona-guide missing references remain; no new failure added.
- Static report checked at desktop 1440x1000 and mobile 390x844. Mobile page width
  390/scrollWidth 390; zero broken section anchors. This is separate from
  authenticated EMR UI acceptance. Screenshots in output/playwright/wp01b-taxonomy-*.

Reproduce local SQL: concatenate BEGIN, slice-03-taxonomy-db-setup.sql, the candidate
migration, slice-03-taxonomy-db-assert.sql, ROLLBACK; send to docker exec -i on the
explicit local container using psql -X -U postgres -d postgres -v ON_ERROR_STOP=1.
Never run these synthetic fixtures against remote DB. They expect clair-demo and
clair-foreign-demo fixtures and an otherwise empty local order catalog.

## Exact next step

Follow-up: [storage/inheritance design drafted](./slice-03-taxonomy-design.md).
The next deliverable is its non-applied mapping manifest, not immediate deployment.

1. Define explicit persisted Admin subtype/pathology-family fields and a bounded
   mapping table; retain execution clinical type separately. Review against current
   master/workspace taxonomy and field-inheritance requirements.
2. Record candidate mapping decisions for the 522 master orders and distinguish
   the 13 legacy workspace rows. No guessed runtime classification or silent delete.
3. Scope and approve remote migration/data materialization separately. Apply the
   tested read migration only with its explicit release scope; verify authenticated
   table/drawer/save-reopen parity, then decide the Slice 03 gate before Slice 04.

This does not reopen OED-LAB-01 research or implement OED-LAB-04 nested/atomic labs.

[Korean HTML report](../../../../../completed/clinical-master/2026-09-06-wp-01b-slice-03-taxonomy-read-report.html)

Official implementation reference: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions).
Changelog checked; no relevant function/RPC breaking change found. Installed CLI
2.116.0; no SDK/dependency version change. Humanize Korean fast run 2026-09-06-007.
