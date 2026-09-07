# WP-01B Slice 03 — Local taxonomy storage and inheritance

Date: 2026-09-06. Status: local implementation verified; remote unapplied.
WP-01B remains in progress. This does not complete clinical defaults, LAB sets,
reference ranges, full WP-02, full management UI or deployment.

## Goal and verified acceptance

| Goal | Verified outcome |
| --- | --- |
| Persist explicit classification | Two nullable master/workspace fields; 25 subtype and 18 lab-family codes; all frozen 522 mappings pass the runtime validator |
| Transport without fallback | Immutable publisher version → master projection → workspace copy → Admin/API/new chart snapshot; no runtime candidate/name lookup |
| Preserve local choices | Per-field baseline; independent refresh despite customized price; override, explicit null, reset, wildcard and detached handling |
| Avoid half-applied classification | Invalid proposed pairs preserve both fields/baselines and record a conflict; retry is idempotent |
| Preserve existing boundaries | Workspace authorization/CAS, clinical data, review/activation state and confirmed history retained in local checks |
| Support creation | Generic and dispensing gateway use common dispatcher; existing clinical create authorization remains authoritative; invalid taxonomy rolls back the new row |

## Implementation

- Migration: `supabase/migrations/20260906074651_clinical_master_order_taxonomy_fields.sql`.
- Runtime vocabulary: `src/features/hospital-admin/order-taxonomy.ts`.
- API transport/validation/snapshot: `src/features/hospital-admin/server-order-catalog-core.ts`.
- Saved classification and taxonomy-only patches: `src/features/hospital-admin/data.ts`.
- Regression: `tests/hospital-admin-taxonomy-read.spec.ts`,
  `scripts/test-wp01b-taxonomy-local.mjs`, [SQL assertions](./taxonomy-fields-local-assert.sql).
- Human companion: [Korean HTML report](../../../../../completed/clinical-master/2026-09-06-wp-01b-taxonomy-fields-local-report.html).

The migration has no data backfill. Old publication payloads without the fields
retain their original hashes. Once published, omission is rejected; explicit nulls
are required to clear. Existing execution-preset revision/hash guards remain.
Taxonomy baselines track source revision separately from the existing whole-row
source snapshot, allowing taxonomy to refresh while a price override stays intact.

Writes to existing taxonomy use the existing management permission, workspace
lock and expected catalog revision. A mixed clinical/taxonomy edit delegates the
clinical part to the existing writer and may advance revision twice with separate
audit entries, atomically. A taxonomy-only edit does not re-submit clinical values
or restart clinical review. Creation preserves the predecessor's authorization,
including dispensing authors, rather than imposing a new generic manage gate.
Only the exact newly created row in that workspace receives taxonomy.

Explicit reset reads the server-side current source during the authorized write;
this is not a runtime display fallback. Wildcard overrides cannot be reset by
silently erasing unrelated customizations. Existing confirmed snapshots remain
untouched; only new server snapshots carry the fields.

## Verification

Commands from repository root:

```sh
npx playwright test --config playwright.catalog-contract.config.ts --reporter=dot
node scripts/test-wp01b-taxonomy-local.mjs
npx eslint src/features/hospital-admin/order-taxonomy.ts src/features/hospital-admin/server-order-catalog-core.ts src/features/hospital-admin/data.ts tests/hospital-admin-taxonomy-read.spec.ts
npx tsc --noEmit
npm run docs:check
git diff --check
```

- Focused contracts: **140 passed**.
- Actual local PostgreSQL publisher/adopter regression: **passed**, inside
  BEGIN/ROLLBACK in the exact named synthetic Docker container. Includes first
  publication/adoption and second publication with preset revision/hash updates,
  customized-price preservation, retry, field override/reset/clear/conflict,
  wildcard/detached, stale CAS, protected patch, missing/foreign snapshot,
  unauthenticated/nonmember rejection and private-helper grants.
- Generic and dispensing creation: saved pair verified; invalid pairs leave no
  created row; dispensing metadata and existing pending-activation state preserved.
- Foreign synthetic workspace rows and existing chart-order fingerprint unchanged.
- Focused ESLint and diff whitespace check: passed.
- Whole-repository type check: **failed** on pre-existing read-result union handling
  in `tests/chart-dispensing-order-execution.spec.ts`,
  `tests/chart-order-action-persistence-server.spec.ts` and
  `tests/chart-order-draft-persistence-server.spec.ts`; no new source diagnostic.
- Docs check: **failed** on two pre-existing references to the missing
  `persona-qa-skill-guide.html` in the customer-discovery docs directory, from
  `_workspace/2026-08-01-002/summary.md` and
  `slice-01-read-boundary.md`.
- No remote SQL, master publish/adopt, migration application, commit/push or deploy.
  Local schema and catalog test writes were rolled back.
- Independent read-only review found and fixed wildcard preservation, predecessor
  snapshot errors and dispensing create dispatch. Final create delta had no
  additional auth/atomicity finding.

## Remaining boundaries

This migration depends on the current cumulative publisher/preset/RPC predecessors.
Local tests used the already seeded cumulative DB, not a clean replay of every
repository migration. The exact chart-search patch refuses unexpected function
drift. Before remote application, inspect predecessor signatures/body hashes,
grants, policies, current IDs/revisions, source types, overrides and backups.
Fresh remote checks and an exact reviewed release packet are still required.

The frozen 522 mapping and 13 legacy reconciliation remain historical non-applied
candidates. Do not regenerate them just to hide source-hash drift: their recorded
UI vocabulary input predates this implementation. Reconcile the newly materialized
vocabulary and explicitly regenerate a new candidate version before application.
This task validated frozen pairs against the new runtime vocabulary, not current
remote eligibility or rebuilt historical mapping digests.

UI creation payload assembly, reset controls, conflict details, role-specific
screens and complete navigation are not yet accepted. Direct legacy dispensing
RPC callers outside the application gateway still need a compatibility audit.
Existing unused UI categories must remain visible or explicitly unresolved;
the reviewed 522 subset is not authority to silently discard them.

## Next bounded slice

1. Finish UI authoring: persist selected subtype/family on creation and edits;
   expose reset/conflict states without inventing defaults or changing clinical type.
2. Verify every category-wide view, missing/conflicting classification, and
   Admin/chart source-row parity using synthetic browser fixtures.
3. Clear/reconcile existing type-check and docs blockers in their owning scope.
4. Prepare a fresh application packet: mapping version, full target freeze,
   before-images, migration predecessor audit, rollback and exact release hashes.
   Remote apply/deployment is a separate action, not implied by this local closeout.
5. Resume the broader OED/LAB sequence after WP-01B acceptance; no claim that
   CBC child orders, equipment profiles or reference ranges were implemented here.
