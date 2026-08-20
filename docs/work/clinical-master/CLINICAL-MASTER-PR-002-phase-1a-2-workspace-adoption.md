---
id: "CLINICAL-MASTER-PR-002"
status: "human_review"
area: "clinical-master"
priority: "P0"
target_pr: "A1/A2 local synthetic reset/replay/reapply/RLS/CAS/notification gates PASS; Sol APPROVE/MUST-FIX 0; local-only human review"
updated: "2026-08-20"
---

# Clinical Master Phase 1A-2: Workspace Catalog Adoption

## Status and gate

This work item remains `human_review`. The A1/A2 local synthetic
reset/replay/reapply, rollback, ACL/RLS, CAS/retry, notification, and focused
runtime/security gates PASS, and independent Sol review is `APPROVE` with
`MUST-FIX 0`. Human acceptance remains pending. No remote Supabase, real data,
production, commit, push, PR, or deploy action was performed.

No new user or domain decision is required. The only prerequisite is technical:
the approved fallback-path rule must be executable for every existing local
catalog row before `classification_path_id` becomes non-null.

## Boundary

Phase 1A-2 changes the workspace-owned `public.order_catalog_items` adoption
boundary and adds durable master-update review state. It includes release 1/2
synthetic adoption, lineage, revisioning, price safety, notifications, and
server-enforced workspace administration.

It explicitly excludes:

- chart/order write-authority migration and any `service_*` replacement or dual write;
- Order Set runtime/revision adoption, lab runtime, fulfillment, billing redesign,
  diagnosis runtime, or master `origin_code` compatibility claims;
- field-level automatic merge, generic merge frameworks, new dependencies, or
  UI/framework redesign;
- emergency safety blocking implementation (the state is rejected/deferred until
  clinical authority and SLA are approved);
- remote migration, real hospital data, production deployment, and Git operations.

The repository currently has no verified live `origin_code` compatibility. Remote
inspection is a later technical preflight, not a new product decision and not a
reason to infer lineage in this phase.

## Current evidence and predecessor contracts

- Existing `order_catalog_items` has `price_krw integer not null default 0` and
  only `active/paused/inactive` availability:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql:4-39`.
- Existing staging fields are preset-string lineage and permit authenticated
  direct insert/update:
  `supabase/migrations/20260528093000_order_catalog_staging_mutation_rls.sql:4-52`.
- The current TypeScript core assumes `priceKrw: number`, lacks
  `pending_activation`, and auto-merges unmodified presets in memory:
  `src/features/hospital-admin/server-order-catalog-core.ts:17-88,592-676`.
- The Supabase mapper rejects null prices and the gateway writes the table
  directly:
  `src/features/hospital-admin/server-order-catalog-core.ts:930-1045,1150-1267`.
- Chart confirmation still rejects every set with `unsupported_order_type`; that
  remains unchanged in Phase 1A-2:
  `src/features/chart/server-order-action-persistence-core.ts:862-891`.
- Phase 1A-1 creates private master tables and revokes direct access from
  `public`, `anon`, `authenticated`, and `service_role`:
  `supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql:26-47,1145-1169`.
- The approved target requires workspace lineage, nullable price, durable
  `workspace_master_updates`, conservative row merge, and two releases:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md`
  (sections 9.1-9.2, 12, 14-16).

## Migration contract

Create one forward migration after
`20260818120000_clinical_master_phase_1a1_private_foundation.sql`. Do not edit
the predecessor migration.

### `order_catalog_items` columns

Add:

- `origin_type text not null default 'workspace_custom'`, values
  `clair_master | workspace_custom`;
- `source_master_record_id uuid null`;
- `source_master_revision integer null`;
- `initial_imported_revision integer null`;
- `last_auto_merged_revision integer null`;
- `classification_path_id uuid null` initially, then `NOT NULL` only after
  fallback preflight and backfill succeed;
- `catalog_revision integer not null default 1`;
- `source_projection_snapshot jsonb null`;
- `source_projection_fingerprint text null`.

`source_projection_snapshot` and its SHA-256 fingerprint are required for
master-derived rows and null for `workspace_custom` rows. PostgreSQL computes
the fingerprint from the canonical JSONB projection; TypeScript never becomes
the fingerprint authority.

Add FKs to `master.master_records(id)` and
`master.classification_paths(id)`. Add a unique `(workspace_id,id)` key for
tenant-safe composite FKs and a partial unique index on
`(workspace_id,source_master_record_id)` where the source is non-null. Add
indexes on `source_master_record_id`, `classification_path_id`,
`(workspace_id,preset_merge_status)`, and retain
`(workspace_id,availability_status,category_group)`.

For `order_catalog_items` itself, authenticated receives `SELECT` only through
same-workspace membership RLS. Revoke authenticated direct `INSERT`, `UPDATE`,
and `DELETE` grants and remove the direct DML policies; all catalog writes go
through the fixed-search-path admin CAS RPC or the private adoption writer.

Replace constraints so that:

- master-origin rows require source ID, source revision, and initial revision;
- workspace-custom rows have no master source reference or source revision;
- `catalog_revision > 0`;
- `price_krw is null or price_krw >= 0`;
- availability is `pending_activation | active | paused | inactive`;
- merge status is `current | update_available | conflict | deprecated_source | detached`;
- `source_projection_snapshot` is an object and fingerprint is a lowercase
  64-character SHA-256 when source lineage exists;
- an active billable row (`billing_reflection_enabled = true`, the current
  billable predicate) must have a non-null price.

Drop the old `price_krw` default and `NOT NULL`; existing stored `0` values are
preserved and remain intentionally free. Do not convert existing zero to null.

### Safe classification backfill

The migration sequence is mandatory:

1. Add `classification_path_id` nullable.
2. Add and validate one reviewed, type-specific Other/Unclassified A/path for
   every item type used by existing synthetic rows.
3. Build an explicit category/type-to-path mapping and reject missing,
   retired, inactive, held, or type-mismatched paths.
4. Backfill every existing row as `workspace_custom` unless a deterministic,
   reviewed master mapping is proven. Never infer lineage from name,
   `source_preset_version`, `t_code`, `origin_code`, or price.
5. Assert unresolved count is zero, then set `classification_path_id NOT NULL`.

The A1/A2 synthetic fixture must expand fallback coverage before this final
assertion. `supabase/seed.sql` and
`supabase/snippets/den-468-491_cheongdam_master_seed.sql` are implementation
scope for stable workspace/role/catalog seed contracts, but seed changes must
use explicit synthetic path mappings and must not promote existing rows to
master lineage.

### Workspace update table

Create only `public.workspace_master_updates`; do not create a separate diff
table. Required columns are:

`id`, `workspace_id`, `release_id`, `source_master_record_id`,
`order_catalog_item_id`, `update_type`, `status`,
`previous_source_revision`, `source_revision`, `changed_fields`,
`source_snapshot`, `workspace_snapshot`, `resolved_by_user_id`, `resolved_at`,
and `created_at`.

Use the approved values:

- update type: `new | changed | deprecated | replacement | emergency`;
- status: `pending | auto_applied | accepted | dismissed | conflict`.

Enforce object JSON checks, resolved actor/time for accepted or dismissed,
unique `(workspace_id,release_id,source_master_record_id,update_type)`, and
these indexes: `(workspace_id,status,created_at desc)` for the review queue,
`(release_id)`, `(source_master_record_id)`, and
`(workspace_id,order_catalog_item_id)` where the item ID is non-null. Use
composite workspace FKs for `workspace_id/order_catalog_item_id` and
source/release FKs to private master tables. `workspace_snapshot` is a review
snapshot only and must not contain
SOAP, secrets, tokens, or unnecessary personal data.

RLS posture:

- authenticated users receive `SELECT` only, guarded by active same-workspace
  membership;
- authenticated direct `INSERT`, `UPDATE`, and `DELETE` grants are revoked;
- direct mutation policies are removed;
- only the private adoption writer creates records;
- only the authenticated hospital-admin review RPC resolves records.

## Distributable projection and proof of unmodified state

The source projection whitelist is exactly:

- canonical order identity/master key;
- preferred canonical Korean/English names and aliases;
- item type/category projection;
- A/T/X/CG/NT classification projection;
- destination and task-required projection from NT;
- canonical target species;
- canonical sales unit/default quantity;
- canonical billing-reflection default;
- canonical care-guide reference/default delivery state;
- canonical lifecycle/safety/deprecation/replacement metadata.

Never distribute canonical price, workspace display/billing names, aliases
owned by the workspace, availability choice, tax, pricing rule, billing policy,
internal instruction, local metadata, or local lab/device mapping as an
automatic overwrite. Workspace-owned fields are excluded from the source
fingerprint. Price remains workspace authority, so preserving a configured
price during source projection replacement is not a source-field merge.

For a master row, the DB stores the last applied source projection JSONB and
its canonical SHA-256. An unmodified row is proven only when the current
source-owned projection fingerprint equals the stored fingerprint. A stale
`customization_state` flag or `customized_fields` list alone is insufficient.
Customized rows are preserved as whole rows and receive snapshots/review; no
automatic field-level merge is allowed.

## Server RPC and transaction contract

### Trusted adoption

Use a private owner/operator-only function with no `authenticated` or
`service_role` EXECUTE privilege:

```text
private.clair_adopt_master_release_to_workspace(
  p_workspace_id text,
  p_release_id uuid
) returns jsonb
```

Do not add `p_idempotency_key` without a durable idempotency ledger. The minimum
safe idempotency key is the unique workspace/release/source/update tuple plus
the partial source-lineage index.

Inside every adoption transaction, including an independent adoption call, lock
and retain both locks in this exact order:

1. Acquire the A1 global publication transaction advisory lock first. Never
   acquire the workspace lock before it, and never acquire the two locks in the
   reverse order.
2. Acquire the entire-workspace adoption transaction advisory lock (not a
   workspace/release pair), keyed by
   `hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)`.
3. While holding both locks, verify the release is `published` and is the latest
   eligible published revision.
4. Select source rows and workspace rows in deterministic master-key/row-ID order
   with `FOR UPDATE`.
5. Perform idempotent upserts and review/notification writes while retaining both
   locks until the adoption transaction completes.
6. Commit without external calls, releasing both transaction locks only at commit.

### Authenticated hospital-admin mutation

Add a fixed-search-path `SECURITY DEFINER` RPC with authenticated EXECUTE only:

```text
public.clair_update_order_catalog_item(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
) returns jsonb
```

It must require active membership, hospital-admin management permission, and
`auth.uid()` as actor; lock the row; compare expected `catalog_revision`; reject
lineage, source revision, classification path, snapshot, fingerprint, merge
state, and workspace reassignment fields; enforce price/activation checks; and
increment `catalog_revision` atomically.

### Review resolution

Add a fixed-search-path `SECURITY DEFINER` RPC with authenticated EXECUTE only:

```text
public.clair_resolve_workspace_master_update(
  p_workspace_id text,
  p_update_id uuid,
  p_expected_catalog_revision integer,
  p_action text
) returns jsonb
```

Only `accept_source` and `dismiss` are supported. The server derives the result
from the trusted saved source projection and stored workspace snapshot; the
client cannot submit a replacement row or snapshot. `accept_source` preserves
workspace-owned price, availability, local instructions, and overrides, applies
only the saved source projection, performs no field-level merge, increments
`catalog_revision`, and records actor/time. For a new item, acceptance must
first mark its durable `new` review `accepted`; only that same DB transaction
may transition `pending_activation` to `active`, and only when the active
billable non-null-price guard also passes. The DB RPC must reject every direct
pending-to-active transition without that accepted review.

## Release transitions

| Case | Release behavior |
| --- | --- |
| New master order | Create one `clair_master` row as `pending_activation`, price null, create `pending` review and admin notification. |
| Existing unmodified master row | Replace only the whitelisted source projection atomically, advance source revisions/fingerprint, preserve workspace-owned fields, increment catalog revision, record `auto_applied`. |
| Existing customized row | Preserve the entire row; store source/workspace snapshots; set `update_available` or `conflict`; no source field auto-merge. |
| `detached` or `workspace_custom` row | Ignore; no lineage promotion and no auto-update. |
| Deprecated source | Preserve row, set `deprecated_source` review state, and notify. Deprecation does not force availability or prohibit an ordinary workspace-admin pause/reactivation decision in Phase 1A-2. |
| Replacement source | Create a review linking old and replacement IDs; do not silently remap. |
| Accepted review | Explicit server mutation only; apply the trusted saved source projection while preserving workspace-owned price, availability, local instructions, and overrides; perform no field-level merge; increment revision and record actor/time. A new item can become active only after its `new` review is accepted and the DB price guard passes. |
| Dismissed review | Preserve current row, mark review dismissed, record actor/time. |
| Emergency | Reject/defer Phase 1A-2 implementation; requires separately approved clinical authority, reason, SLA, and safety block contract. |
| Retry | No duplicate catalog row, review item, or notification. |

## Notification contract

Extend existing `notification_events` minimally with:

- `event_key = 'clinical_master_update_available'`;
- `domain = 'hospital_admin'`;
- `recipient_kind = 'active_role'`, `recipient_id = 'hospital_admin'`;
- `source_kind = 'fallback_detail'`;
- `source_entity_id = workspace_master_updates.id::text`;
- `dedupe_key = 'clinical-master-update:' || workspace_master_updates.id::text`;
  This update-ID key is retry-stable and must be reused on every retry.

`fallback_detail` is reused because the existing notification enum has no master
update source kind; `source_entity_id` and `source_route` make the durable
review target explicit. `active_role/hospital_admin` is reused because the
existing visibility helper already resolves role-targeted events; the new
`hospital_admin` domain restricts visibility to active hospital administrators.
The notification payload contains only update ID, labels, and a safe route.
It must not contain `source_snapshot`, `workspace_snapshot`, prices, internal
instructions, SOAP, secrets, or tokens. Existing notification RLS and actor
visibility helpers must be extended so only active hospital admins receive the
new domain. Client-side notification events remain non-writable.

## TypeScript, API, UI, seed, and chart-read scope

The implementation may update the existing catalog model/gateway so price is
`number | null`, availability includes `pending_activation`, merge status
includes `deprecated_source`, and server-managed lineage/revision fields are
not accepted from client patches. `createOrderPricingSnapshot` must preserve
`0` and reject active billable `null`; chart catalog read may add lineage and
catalog revision fields additively. The existing chart writer and set rejection
remain unchanged.

Existing hospital-admin data/module surfaces may expose pending/review state
using their current patterns, but no new UI framework or generic review
abstraction is permitted.

## Synthetic replay and test matrix

Use two synthetic workspaces (A unmodified, B customized) and two master
releases (release 1 baseline, release 2 changed + new + optional replacement).
The replay must run in a transaction with `ON_ERROR_STOP=1` and clean up all
rows, users, memberships, notifications, reviews, and master fixture state.

Required checks:

1. A1 predecessor clean reset/full replay/rollback/concurrency gate.
2. A2 migration apply and reapply idempotency.
3. FKs, composite tenant keys, RLS, grants, and private master denial.
4. Anonymous, inactive member, ordinary member, admin, and cross-workspace attacks.
5. Classification fallback mapping: missing, retired, held, and type-mismatch rows
   fail; unresolved count must be zero before NOT NULL.
6. Release 1 pending activation, idempotent retry, and notification dedupe.
7. Release 2 unmodified auto-update with source fingerprint/revision advance.
8. Customized whole-row preservation with review snapshots and no field merge.
9. Hospital-created row untouched by both releases.
10. Deprecated/replacement review and explicit accept/dismiss transitions.
11. Null price vs explicit zero; active billable-null rejection; active zero acceptance.
12. CAS revision mismatch, protected-field rejection, actor/workspace mismatch.
13. Concurrent adoption of the same workspace/release produces one result.
14. Notification payload privacy and update-ID dedupe.
15. Existing chart individual read behavior remains valid; chart set selection still
    returns `unsupported_order_type`; no Phase 1A-3 write behavior appears.
16. Historical chart/order snapshots remain unchanged after later catalog releases.

## Exact implementation ownership

One Luna implementation worker may touch only the following scoped files:

- new `supabase/migrations/<next>_clinical_master_phase_1a2_workspace_adoption.sql`;
- new `supabase/snippets/clinical_master_phase1a2_replay.sql`;
- `src/features/clinical-master/server-clinical-master-adoption-core.ts`;
- `src/features/hospital-admin/server-order-catalog-core.ts`;
- `src/features/hospital-admin/server-order-catalog.ts`;
- `src/features/hospital-admin/data.ts`;
- `src/features/hospital-admin/module.tsx`;
- `src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts`;
- `src/features/notifications/mock-notifications.ts`;
  `server-notification-persistence.ts`; `server-notifications-core.ts`;
  `server-notifications-route.ts`; `notification-surface-rules.ts`;
- `supabase/seed.sql` and
  `supabase/snippets/den-468-491_cheongdam_master_seed.sql` for explicit synthetic
  workspace/fallback-path/catalog seed contracts only;
- `tests/fixtures/clinical-master-phase1a1.fixture.json` only to add the
  required synthetic fallback coverage;
- new `tests/fixtures/clinical-master-phase1a2.fixture.json`;
- new `tests/clinical-master-phase1a2.spec.ts`;
- new `tests/clinical-master-phase1a2-notifications.spec.ts`;
- `tests/hospital-admin-order-catalog-server.spec.ts`;
- this work item and the one new `docs/work/index.md` row.

No other files, worktrees, remote systems, or external state are in scope.

## Done and failure criteria

Done requires: predecessor A1 runtime gate; A2 migration/reapply; zero unresolved
classification paths; two-workspace/two-release replay; no cross-workspace leak;
no duplicate retry/concurrency results; null/zero activation tests; customized
and local-row preservation; private master/direct-DML denial; notification
privacy; focused TypeScript/DB tests; and synchronized work item/index status.

Failure means: claiming A1/A2 completion from static evidence only; inferring
master lineage; using a generic fallback path; leaving unresolved/retired paths;
allowing authenticated direct DML; accepting client snapshots/lineage/price
authority; overwriting customized or local rows; duplicating retries; leaking
workspace data; adding chart writer/Order Set/lab runtime behavior; or making
any remote/production/Git change.

## Latest local verification evidence

On 2026-08-20, pinned `supabase@2.115.0` completed a clean local reset and
the A2 `ON_ERROR_STOP=1` replay passed its rollback cleanup assertion. Running
the A2 migration directly a second time was idempotent, and the replay passed
again. Focused Playwright passed 14/14 chart-action tests and 19/19 A2 tests;
full TypeScript, scoped ESLint, docs-link, and `git diff --check` gates passed.

The local database has nine seeded custom catalog rows, zero unresolved
classification paths, seven active reviewed fallback paths, and zero durable
replay rows after rollback. Authenticated catalog `INSERT/UPDATE/DELETE`
privileges are false; same-workspace admin RPC, direct-DML denial,
cross-workspace/inactive-member RLS, private-master denial, CAS/protected-field
rejection, and null-versus-zero price safety passed. Forward-upgrade and
adopted-row-preserving reapply proofs passed without erasing lineage. A
publisher-vs-adoption two-session probe held the exact A1 global-then-workspace
locks and serialized the adoption after publication; a same-workspace adoption
probe held the same lock order and returned one result followed by zero
duplicates. The replay also proved skipped-release catch-up, lifecycle/
replacement review precedence, metadata-only release no-op for both pending and
dismissed same-source history, fresh-workspace replacement/deprecated-source
state, client-derived-field rejection, activation review gating, historical
snapshot preservation, notification privacy, and retry dedupe.

This is implementation-worker evidence only; independent representative review
remains pending.

## Current implementation state

Phase 1A-2 implementation is complete within the approved ownership boundary in
the active local worktree. The scoped migration, replay, catalog server
boundary, notification extension, seed fallback contracts, and focused
fixtures/tests pass the local runtime, security, concurrency, TypeScript,
lint, and documentation gates above. The work item is in `human_review`; no
remote or Git action was performed.
