# Dispensing Order Master V1 Implementation Plan

Status: `foundation, inactive release 13, and three-workspace pending adoption applied and verified; clinical activation remains prohibited`

## Boundary

The implementation is additive and revision-pinned. It preserves the existing
generic master, workspace catalog, chart atomic confirmation, fulfillment, and
billing contracts. It does not coerce the 108 technical records into the current
required-dose `MedicationOrderMetadata`, does not activate unreviewed content, and
does not create a second workspace order authority.

## Proposed File Set

| File | Change |
| --- | --- |
| `supabase/migrations/20260826150000_clinical_master_dispensing_order_foundation.sql` | Add normalized medication/product/evidence/review/regulatory tables, release staging, immutable review events, computed activation gate, workspace lineage fields, and server/RPC enforcement. No dataset rows. |
| `supabase/snippets/clinical_master_dispensing_order_foundation_replay.sql` | Apply the foundation inside one local transaction; verify false/true clinical-use gates, tamper rejection, immutability, RLS/ACL, then roll back without residue. |
| `supabase/migrations/20260826151000_clinical_master_dispensing_order_publish_adopt.sql` | Add strict payload validation, idempotent private publish, pending-activation workspace adoption, reconciliation, audit, and rollback-safe release isolation. No embedded release payload. |
| `supabase/migrations/20260826152000_clinical_master_dispensing_fulfillment_history.sql` | Add a workspace- and queue-permission-scoped read RPC over existing fulfillment transition events. No runtime row mutation. |
| `supabase/snippets/clinical_master_dispensing_release_replay.sql` | Publish the exact inactive payload, verify exact counts and retry, reject wrong approval scope, adopt to a rollback-only target, prove target retry and foreign-workspace immutability, then roll back. |
| `supabase/snippets/clinical_master_dispensing_v1_preflight.sql` | Read-only schema, permission, migration history, baseline count/fingerprint, runtime aggregate, lock, and exact target-presence verification. |
| `supabase/snippets/clinical_master_dispensing_v1_commit_candidate.sql` | Exact rendered release payload/upsert candidate generated from the immutable dataset; separate approval packet and SHA-256. |
| `supabase/snippets/clinical_master_dispensing_v1_postflight.sql` | Exact payload/release counts, semantic fingerprints, RLS/ACL checks, runtime zero-artifact proof, immutable audit readback, and foreign-workspace control. |
| `supabase/snippets/clinical_master_dispensing_v1_forward_fix.sql` | Release-scoped emergency safety block and workspace pause; never deletes history or confirmed snapshots. |
| `scripts/generate-dispensing-order-release-v1.mjs` | Convert the final JSON plus repository-owned structural fixture into a self-contained canonical inactive release payload with deterministic UUIDs, sorting, and hashes. |
| `scripts/clinical-master-dispensing-airtable-adapter.ts` | Read-first Airtable schema/record diff and exact idempotent create/update plan; rejects unknown tables/fields and cross-base targets. |
| `scripts/validate-dispensing-order-master-v1.mjs` | Extend current technical validation with generated payload, linked-table, release, and workspace projection checks. |
| `src/features/hospital-admin/server-order-catalog-core.ts` | Add a nullable, versioned dispensing product/profile lineage read model. Keep hospital price/name policy separate. |
| `src/features/chart/order-execution-domain.ts` | Add a V2 dispensing detail schema with reviewed route vocabulary and required clinician-entered prescription values; no clinical defaults. |
| `src/features/chart/server-order-draft-persistence-core.ts` | Preserve product/profile/evidence/review lineage in drafts without creating downstream artifacts. |
| `src/features/chart/server-order-action-persistence-core.ts` | Re-resolve active workspace row and clinical-use gate; snapshot the exact product/profile/review revision on atomic confirmation. |
| `src/features/chart/server-order-execution-mutation-core.ts` | Reject stale, inactive, species/route-incompatible, clinically unreviewed, or client-authority fields. |
| `src/features/chart/server-order-execution-read-model-core.ts` | Return immutable dispensing lineage and reviewed product facts. |
| `src/features/chart/module.tsx` | Search/filter 100+ dispensing profiles, display inactive/review warnings, and collect required prescription inputs before confirmation. |
| `src/features/fulfillment/server-fulfillment-work-item-core.ts` | Map and authorize one work item's persisted transition history without exposing another workspace or queue. |
| `src/app/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]/history/route.ts` | Expose the authenticated, workspace-scoped history read boundary. |
| `src/features/dispensing/module.tsx` | Show reviewed product facts, immutable prescription snapshot, and persisted actor/reason/status history; leave lot/expiry/opened/BUD/actual quantity/substitution/waste/checker capture to a separately approved dispense-event contract. |
| `tests/clinical-master-dispensing-schema-migration.spec.ts` | Static migration/RLS/ACL/immutability/gate contract. |
| `tests/clinical-master-dispensing-fulfillment-history.spec.ts` | Static workspace/permission/ACL/history-scope contract for the new read RPC. |
| `tests/clinical-master-dispensing-publisher.spec.ts` | Payload key rejection, evidence/review gate, idempotent publish, conflict, and retry. |
| `tests/clinical-master-dispensing-adoption.spec.ts` | Pending activation, unique workspace lineage, foreign workspace, customization preservation, stale revision, and safety block. |
| `tests/chart-dispensing-order-execution.spec.ts` | 100+ search, draft zero-artifact rule, required inputs, species/route checks, immutable snapshot, and retry. |
| `tests/dispensing-fulfillment.spec.ts` | Extend existing one-order/one-task/one-queue/no-duplicate/billing-separation coverage with dispense-event lineage. |
| `docs/engineering/data-model/clair-clinical-master-data-target-architecture.md` | Reconcile the implemented normalized dispensing family and gate only after verification. |
| `docs/engineering/data-model/order-fulfillment-handoff-contract.md` | Add the verified immutable dispensing/execute snapshot boundary only after implementation. |
| `docs/product/domain/workspace-order-catalog-platform.md` | Record the verified workspace medication lineage and activation behavior only after implementation. |

The three migrations were applied to production-bound project
`qmerxgzrwaaahpkhjqlc` as remote history versions `20260826011738`,
`20260826011742`, and `20260826011745`. Their final SHA-256 values are recorded
in the Supabase approval packet. Clinical activation was not performed.

## Migration 1: Normalized Foundation

### Private canonical tables

- `master.medication_ingredients`
- `master.medication_products`
- `master.medication_product_ingredients`
- `master.medication_species_applicability`
- `master.medication_product_handling`
- `master.dispensing_order_profiles`
- `master.evidence_documents`
- `master.evidence_assertions`
- `master.clinical_reviews`
- `master.medication_regulatory_profiles`
- `private.clinical_master_dispensing_release_payloads`

All master/private tables remain RLS enabled or inaccessible through schema/table
grants to `anon` and `authenticated`; only reviewed security-definer functions may
mutate them. Published payload, evidence-document content identity, and completed
review rows are immutable. Foreign keys use `restrict`, not cascading deletion.

`master.master_records` continues to own the dispensing order identity. Ingredient
and product tables use their own stable UUID/key families so the existing
`master_records.record_type` constraint is not broadened unnecessarily.

### Computed clinical-use predicate

`master.clair_dispensing_profile_clinical_use_allowed(profile_id, revision)`
returns true only for the exact revision when:

- the owning master order/product/profile revisions are published and not blocked;
- required official evidence assertions resolve to immutable documents;
- a named eligible veterinarian has an approved, non-superseded review of that revision;
- the Korean regulatory profile is approved and controlled status is
  non-controlled;
- Korean display translation review is approved; and
- no pending/not-found blocker remains.

No client, Airtable formula, workspace admin, or generic `reviewed` label can set
this value directly.

### Workspace additive fields

`public.order_catalog_items` receives nullable dispensing-only lineage columns:

- `source_dispensing_profile_id` and revision;
- `source_medication_product_id` and revision;
- `source_clinical_review_id`;
- `source_evidence_fingerprint`;
- `clinical_use_allowed` as a server-maintained projection; and
- `dispensing_profile_snapshot` plus SHA-256 for review/search display.

Rows with dispensing lineage must remain `pending_activation`, `paused`, or
`inactive` while the computed gate is false. Existing non-dispensing rows remain
unchanged.

### Dispense execution event

Add `public.order_dispense_events` only if local replay proves the existing order
and fulfillment tables cannot preserve the required execution history. The table
would be append-only per order attempt and store workspace/order/task lineage,
actual quantity/unit, lot, manufacturer expiry, opened/reconstituted timestamp,
calculated BUD plus rule/source, substitution, waste, checker, completion actor/time,
and immutable event fingerprint. It must contain no guessed values and no raw SOAP.

## Migration 2: Publish And Adopt

### Publisher

`private.publish_clinical_master_dispensing_release(payload, actor_user_id)`:

1. acquires the existing clinical-master publication advisory lock;
2. rejects unknown keys, wrong schema revision, count/hash mismatch, duplicate
   IDs/keys/products, missing evidence, and any `clinicalUseAllowed=true` row;
3. writes one immutable release payload and normalized rows in one transaction;
4. publishes technical rows only as clinically inactive/pending review;
5. records exact counts and fingerprints; and
6. returns the existing release on an exact retry, but conflicts on same key with
   different content.

### Workspace adoption

`private.adopt_clinical_master_dispensing_release(workspace_id, release_id, actor, approved_workspace_ids)`
uses the existing `(workspace_id, source_master_record_id)` uniqueness and creates
rows only as `pending_activation`. It preserves hospital-owned name, price, tax,
unit, billing, and customization fields on retry/update. It refuses the foreign
control workspace unless that exact workspace is in the approved packet.

This dataset may be technically published and adopted pending activation, but it
may not enter chart search until named clinical/regulatory/translation review makes
the database predicate true and a separate activation approval is granted.

### Locally verified candidate

- Dataset revision: `2026-08-26.1`, 108 atomic orders.
- Dataset SHA-256:
  `cc3ef6c977122bef5a708d5c6a800a3120b257584bd78ee72c26a67d2b95260f`.
- Canonical release payload SHA-256:
  `3825feb207ed3ea3b9fcf3be69f3e1745f4571671d988da3d57a760e3f19460b`.
- Generic manifest: 108 dispensing orders, 8 structural dependencies, one
  classification path.
- Normalized relation rows: 1,657; every review gate remains pending and the
  clinical-use count is zero.
- The release replay passed publish, exact retry, scoped pending adoption,
  adoption retry without revision drift, foreign-workspace immutability, chart
  non-exposure, and transaction rollback.
- Exact separate approvals are frozen in
  `docs/work/clinical-master/clinical-master-pr-017/supabase/approval-packet-01.md`.

### Verified remote result

- Inactive release: No. 13, ID
  `78a57bf0-10a8-47db-9ae1-8a8cff79b2c4`.
- Exact publish retry returned the same release with `idempotent=true`.
- Normalized relation counts matched all 1,657 expected rows; clinical-use,
  duplicate, orphan, and non-pending review counts were zero.
- `clair-demo`, `workspace-clair-cheongdam`, and
  `workspace-clinical-master-pilot-v1` each adopted exactly 108 rows as
  `pending_activation`; retries created zero rows and preserved fingerprints.
- `clair-foreign-demo` remained empty with fingerprint
  `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.
- Runtime aggregates remained 38 confirmed atomic orders, 38 Tasks, 31
  fulfillment work items, and 38 billing candidates.

## Application Contract

### Search and draft

- Server search excludes false-gate rows from ordinary chart results.
- An explicit admin/reviewer view may show pending rows with reasons, but cannot
  confirm them.
- Adding an eligible row to the chart creates only a draft. It persists the profile
  lineage and no task, queue, billing candidate, or dispense event.

### Confirmation

The server re-reads the current workspace catalog row, exact profile/review
revision, patient species, route compatibility, availability, and clinical-use gate.
It ignores client-supplied canonical names, evidence, review, price, route authority,
and destination. The V2 dispensing detail schema requires clinician-entered dose
basis/value/unit, route, frequency, duration, and total quantity with explicit units.

One successful atomic confirmation creates one order and one fulfillment work item.
The dispensing screen is a read model of that work item. The trusted chart billing
action independently creates at most one billing candidate. Every retry is
idempotent.

## RLS, ACL, And Audit

- Revoke direct master/private access from `public`, `anon`, `authenticated`, and
  `service_role` except narrowly reviewed execute grants where the current release
  architecture requires them.
- Workspace catalog reads remain active-member scoped; mutations stay behind the
  existing hospital-admin/server boundary.
- Order confirmation remains chart-authority scoped. Dispensing read/complete uses
  current `dispensing:view`/`dispensing:complete`; controlled items remain excluded.
- Audit payloads include actor, workspace, request ID, target IDs/revisions,
  before/after lifecycle state, and fingerprints, but no secrets, provider payloads,
  unrelated clinical text, or patient identity beyond existing scoped IDs.
- Negative tests cover anon, non-member, inactive member, wrong workspace,
  wrong role, stale revision, direct table write, and cross-workspace references.

## Verification Matrix

### Dataset and generated payload

- current technical validator;
- generated authoring/publish/adoption count and fingerprint equality;
- source URL/hash integrity and no secret/private URL scan;
- zero active rows, unknown clinical defaults preserved as null.

### Database

- fresh local Supabase replay and migration ordering;
- schema constraints, immutable triggers, publisher exact retry/conflict;
- RLS/ACL negative matrix and security-definer search path checks;
- before/after/retry counts and semantic fingerprints;
- zero duplicate lineage, orphans, cross-workspace drift, and outbox claim;
- exact foreign workspace unchanged proof.

### Runtime and browser

- at least 20 focused scenarios: search, category/route/species filtering, inactive
  exclusion, review reason display, draft/cancel, required fields, units, invalid
  species/route, stale review, safety block, confirmation, retry, task/queue,
  billing separation/retry, dispensing completion/return, permissions, audit,
  and historical snapshot preservation;
- focused tests, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
  `npm run security:secrets`, `npm run docs:check`, and `git diff --check`.

## Rollout And Stop Conditions

1. Freeze exact dataset, generator, migration, and SQL hashes.
2. Read-only remote preflight and row-impact comparison.
3. Apply schema migration only after its separate approval; stop on any target,
   lock, history, permission, or baseline mismatch.
4. Publish the exact inactive release only after publish approval; verify and retry.
5. Adopt only the named workspaces after adoption approval; foreign control stays zero.
6. Merge/deploy only after code/replay review and the production-trigger approval.
7. Keep feature and clinical activation off until separate approvals and a named
   reviewer/regulatory gate are satisfied.

Stop on any unexpected target, count, fingerprint, duplicate, orphan, permission
failure, RLS weakening, cross-workspace row, clinically unsafe value, real-data
exposure, migration-history mismatch, or failed idempotency check.

## Forward Fix And Historical Preservation

No rollback deletes published master history, workspace snapshots, confirmed orders,
tasks, billing candidates, or dispense events. The safe operational response is a
release-scoped safety block plus workspace pause, followed by a corrected immutable
revision. Schema rollback is considered only before data publication and only when
dependency and row-count checks prove zero owned data. Production remediation uses
forward-fix migrations.
