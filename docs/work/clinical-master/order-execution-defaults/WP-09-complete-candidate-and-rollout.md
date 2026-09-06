---
type: Work Package
title: Complete candidate reconciliation and staged rollout
status: in_progress
updated: 2026-09-06
---

# WP-09 — Complete candidate and rollout

Parent: [full plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).
Human review: [Korean report](../../../completed/clinical-master/2026-09-06-order-defaults-full-local-report.html).
Markdown companion: [Korean review](./WP-09-local-review.ko.md).

## Verified local boundary

The full original522 identity ledger reconciles to524 candidate order records:
522 minus51 explicitly redefined original dispensing identities plus53 additions
(19 dispensing products and34 atomic lab orders). The51 old identities are a
future-selection retirement plan, not deletion or clinical-equivalence claims.
Their existing workspace rows, customization and historical orders remain intact
until the exact scoped retirement operation is reviewed/applied.

- Candidate: [combined release](./artifacts/wp-09/combined-release.non-applied.v1.json).
- Generator: `scripts/generate-wp09-combined-candidate.mjs` (offline authoring only).
- Candidate semantic SHA-256: `0241c936a61835e615ff9be4437e121e2a00e96b3767d9f48f2464cf93d718e9`.
  This is an artifact checksum, not PostgreSQL's authoritative release fingerprint.
- Every original identity has a disposition and exact successor. All candidate
  orders have authored taxonomy; additional atomic assays use explicit assay
  family decisions. The legacy metabolic composition uses the established lab
  path now that its assay/profile authority is explicit. Product-source citations
  stay in provenance; synthetic order plans are not relabeled official prescriptions.
- Real server publish API validates the complete candidate and retains immutable
  compositions. Strict UUID/envelope/graph checks reject unknown fields, invalid
  references, cycles, duplicate leaves and excess depth. SQL remains the schema
  and canonical hash authority. V1/V2 presets and existing English product names
  are accepted without inventing Korean product translations.
- Full local publication/adoption/retries prove524 exact typed candidate rows,
  unchanged foreign catalog and immutable confirmed history. Package scenarios
  first test their own conflicting revisions, then roll back to a savepoint so
  the combined candidate is tested against the original seeded baseline.

## Verification

| Evidence | Result and boundary |
| --- | --- |
| Catalog/domain contracts | 203 pass; `playwright.catalog-contract.config.ts` |
| Publisher compatibility | Fresh35 pass; Phase1A1, execution-preset contracts and dispensing publishers; earlier22-suite evidence retained |
| Admin/chart/imaging browser | 14 pass; mocked APIs, not authenticated remote smoke |
| Laboratory browser | 2 pass; true-empty and typed CBC actual/save/reload/retest (mocked API) |
| TypeScript / focused ESLint / production build | Pass |
| `node scripts/test-wp01b-taxonomy-local.mjs` | Pass; named local synthetic Docker DB; final ROLLBACK |
| SQL package coverage | Field merge/override,127 dispensing,111 treatment,86 lab originals/90 atomic/35 compositions/24 profiles,30 imaging,136 remaining; actual/retry/amendment/foreign/history cases |
| Remote writes / deployment | Not performed; scoped local delivery commit prepared, PR checks remain |

The older WP01B historical-reference wording was corrected. The primary checkout's
full docs check still finds the unrelated missing persona guide in
`_workspace/2026-08-01-002/summary.md`. Recheck in the scoped delivery worktree;
do not copy or change unrelated humanization artifacts to hide this failure.

Re-run fresh checks before delivery; these results are not permission to apply an
unreviewed later checksum. Local two-session race stress and the full deployed
authenticated matrix are not claimed by these focused cases.

## Read-only remote preflight

Observed on 2026-09-06 at approximately13:16 UTC in `clair-emr-staging`:

| Workspace | Catalog rows | Master-linked rows | Active rows | Catalog row MD5 |
| --- | ---: | ---: | ---: | --- |
| clair-demo | 541 | 522 | 429 | 987f1d016ac2f0ff500a5ce57dd0dba4 |
| workspace-clair-cheongdam | 534 | 522 | 426 | 0c6866588df5775e98499123365f635f |
| workspace-clinical-master-pilot-v1 | 522 | 522 | 414 | a18c279b2fe7b2b0d83334bd0656b4a4 |

`clair-foreign-demo` exists and is active; the catalog aggregation returned no
rows for it (zero catalog rows, not proof that every foreign table is empty).
Remote migration count212; latest recorded version `20260903110347`. No20260906
migration was applied. These are discovery-time fingerprints; re-read immediately
before any approved operation and stop on unexpected drift.

## Approved scope and remaining execution

On 2026-09-06 at13:33 UTC the user approved the proposed exact scope: the three
listed workspaces, with `clair-foreign-demo` unchanged; CLAiR synthetic manual
profiles (no hardware integration), parent-only set billing, and nonbillable
atomic retest by default. Parallel implementation was also explicitly approved.
This does not authorize real clinical data, invented registered care locations,
clinical validation claims, or expanding the target workspace allowlist.

Continue the same objective; do not request duplicate approval:

1. Freeze exact workspace IDs, candidate checksum, prerequisite migration list,
   current versions/rows and foreign catalog/result/history fingerprints.
2. Rehearse the exact scope in rollback, including original51 future-selection
   stops with existing catalog pause/CAS operations, all524 active/selectable
   candidates, compiled sets and explicitly chosen profile/device/billing pins.
   Preserve customized field values, pricing, prior orders/results and foreign data.
3. Apply only the approved migrations and candidate, adopt each target, record
   before/after/retry counts, conflicts and fingerprints. No runtime fixture fallback.
4. Verify actual authenticated Admin exact identities/defaults/edit/reload/use-stop,
   chart selection/confirmation, fulfillment/results/retest/history in every target.
5. Deliver only this work's exact slice from the dirty checkout, with candidate
   checks, merge/origin-main proof, Ready deployment and scoped authenticated smoke.

Rollback: migrations are additive; do not delete history or rewrite confirmed
snapshots. Before persistent application save exact affected catalog rows and
bindings. Stop further adoption on mismatch, preserve failed evidence, and use a
reviewed forward-fix/new revision or narrowly restored pre-apply current bindings.
Already-used result/profile versions remain immutable. No blanket database reset.

## Post-approval compatibility checks

- Preserved the471 retained preset IDs/keys and advanced beyond immutable history
  (108 current product presets have a later historical revision4). Delivery-only
  candidate: `artifacts/wp-09/remote-release.non-applied.v1.json`, SHA-256
  `6860fad8eaf44b3fbd5b2984e5dcd685368289d00ff54d8cb2b889bda2cab7e6`.
  Two generator regressions prove clinical defaults/policies/provenance unchanged.
  The delivery identity rebase is complete. The operator transition and whole-scope
  rehearsal below must pass before this becomes an apply-ready packet.
- Fixed schema0 chart confirmation retry so it cannot create retroactive actuals;
  all three chart-only types retain the old response/tasks/events without results.
- Restored existing active-veterinarian dispensing author rights, including the
  transport predecessor's inner dispensing-only writer. General catalog manager,
  foreign scope, CAS, clinical review and audit boundaries remain enforced.
- Retest UI now defaults to `no_charge` while sending an explicit policy in each
  command. Two CBC browser cases and fresh TypeScript check passed.
- Fresh full local SQL harness passed through WP09 with final `ROLLBACK`, including
  active veterinarian dispensing-only authoring/audit and legacy chart retries.

### New remote-state decisions, not duplicate scope approval

Fresh remote read confirms108 dispensing-profile-linked catalog rows per target.
The live `order_catalog_items_dispensing_lineage_check` and corresponding trigger
require matching catalog/master/profile revisions and forbid profile-linked
`active` rows with `clinical_use_allowed=false`. Existing service-operations review
supports synthetic selection/confirmation at `pending_activation`, enabled by an
append-only event for the exact workspace and profile source release. It does not
grant clinical approval. Never bypass the guard, remove lineage, or reuse old review
approval for newly authored synthetic plans.

The current generic candidate has no new dispensing product profiles. A compatible
transition must append new immutable profile revisions and atomically rebind the
catalog master revision/profile/snapshot before generic adoption. All old profile,
review, order and result history must stay intact. Merely changing preset IDs or
publishing product profiles is not sufficient: the existing specialized adopter
also invokes generic adoption before rebinding.

One of90 intended root-set applications has a distinct existing billing policy:
`workspace-clinical-master-pilot-v1 / phase1.optionb.v1.order.metabolic` is already
nonbillable (`price_krw=NULL`, `billing_eligible=false`, reflection=false). Its
`preserve_parent_price` compilation is invalid. Proposed narrow exception is
`no_charge` for this one existing nonbillable root; all other89 keep parent prices.

The user approved both exceptions after an explanation: synthetic-selectable
dispensing (not literal DB active) and the one existing nonbillable set. Preserve
this approval and continue the same objective without asking again. No remote
write, commit, push, merge or deployment performed at this checkpoint.

## Approved pricing and operator preparation

The user authorized synthetic prices for the53 additions and rejected a uniform
KRW1,000 proposal before any remote application. The replacement configuration is
an explicit per-item map:19 dispensing case fees at KRW7,000–45,000 and34 standalone
atomic test fees at KRW5,000–20,000, repeated in the exact three workspaces (159
assignments). These are deliberately selected demo fees, not retail/tablet/dose
prices, item-level market evidence, clinical advice, or an atomic-price sum for a
panel. Existing prices and billing rules remain protected.

- Configuration: [non-applied packet](./artifacts/wp-09/workspace-configuration.non-applied.v1.json).
- Configuration SHA-256: `fe37aed0943fac33a0fef13a71d70449913d920b608a8cd2036fa292d7871161`.
- [MAFRA 2025 survey](https://www.mafra.go.kr/bbs/home/792/592824/download.do),
  page3, is broad panel context only: median CBC34,000 / chemistry80,000 /
  electrolyte32,000. It does not establish the selected item prices.
- Approved device/profile/composition choices remain9 explicitly synthetic manual
  devices,519 order/species bindings and90 root-set assignments (89 existing parent
  prices and the one nonbillable pilot metabolic set). Retest defaults to no charge.
- The live original master catalog was rechecked:414 non-profile rows are active
  and108 profile-linked rows are pending activation in each target. The latter stay
  synthetic-selectable through the existing reviewed service-operation path.
- Two existing pilot rows, `phase1.optionb.v1.order.metabolic` and
  `cm.order.consult.initial`, are nonbillable despite a globally billable source.
  Source reconciliation must preserve their NULL price / false billing flags and
  record an explicit local billing override, not invent a price or alter the source.

The operator-only rollout helper installs without executing data changes. It binds
the exact packet hash and preflight fingerprints, appends compatible dispensing
profile versions, adopts only the three workspaces, resolves frozen eligible lab
definitions, initializes only new prices, accepts strictly eligible current-source
reviews, pauses obsolete51 identities, and configures the chosen lab devices/sets.
Rehearsal runs in a subtransaction and returns evidence after rollback. A persistent
receipt binds retry to the same actor/packet and rejects subsequent state drift.
All application roles are denied direct invocation. No public authoring validation,
clinical approval, medication defaults or security constraint is weakened.

Whole-scope harness passed with all18 new migrations and one existing prerequisite:
`node scripts/test-wp09-scoped-rollout-local.mjs`. Reviewed helper SHA-256:
`f19307dc6ad570cb1e755c391acad130054bc7fc85c560611186766e4da3ea7b`.
The test covers application-role/actor denials,29-table/four-workspace fingerprints,
full permanent-table rehearsal residue, deliberately late failure rollback,
524 selectable /51 paused /53 new prices per workspace,9 devices/519 bindings/
90 compositions, existing financial/local values, immutable profiles/results,
link-pin cascades, notification state and exact retry stability. Even commit=true
was inside an outer ROLLBACK; the receipt table was absent after the test.

Payload lab adoption does not create review targets. The operator therefore creates
canonical current-source proposals only for the frozen69 unmodified items per
workspace, validates the returned target and exact expected link cascade, and uses
the existing protected resolver. Existing pending reviews fail closed. No catalog
membership target is blindly accepted.

Delivery isolation from current main preserves unrelated SOAP, splash, agent and
release-policy changes. Current checks include203 contracts,35 earlier fresh
publisher cases,93 artifact/generator/report tests, TypeScript, docs, secrets and
build. Product-copy normalization and the final exact-candidate rerun are separate.
WP00 and LAB03 tests verify recorded historical Git sources, not later changed
implementation; default WP00 worktree audit still detects drift. Historical replay
requires the pinned f564a493 commit locally (no network fetch or live-source fallback).
Taxonomy provenance-only regeneration changes source hashes/displayed fingerprint,
not any of522 proposed classifications; combined/remote/configuration are unchanged.
Clean delivery reran the full operator harness successfully with the same reviewed
helper/configuration and final outer rollback. The14 Admin/chart/imaging browser
cases and2 CBC true-empty/actual cases passed against explicit mock API contracts.
The Admin test now supplies workspace/session API fixtures instead of a hardcoded
port-specific401 console-error exemption. Application auth behavior is unchanged.

Delivery PR: [#711](https://github.com/mcso0/emr-app-shell-prototype/pull/711),
branch `codex/clinical-master-oed-complete-delivery`, target `main`. Exact final
head, Release Check and Ready Preview are recorded on the PR approval packet after
the fixture-only follow-up commit. The representative subsequently approved
proceeding with the proposed choices; the live cutover checkpoint below supersedes
the earlier pre-approval status. The full objective remains active.

Cutover must coordinate the app and DB: new actual-value triggers are incompatible
with the old writer, so do not apply them early while presenting the old app as
usable. Re-read and freeze live fingerprints immediately before the scoped remote
rehearsal/application; stop on drift or failed evidence. Keep affected workflows
out of use until the compatible app/DB pair passes the three-workspace smoke.
The existing Ready Production deployment is an app-only rollback candidate, not a
complete DB rollback. After persistent adoption, preserve immutable history and
use the reviewed narrow binding restore/forward-fix path above; never blindly
promote the old writer against the new DB contract.

### Live cutover checkpoint — 2026-09-07 KST

Approved candidate `75f475caeba68c8d4182a461512d01390bfdd226` passed Release Check
`34043336698`; exact Preview `dpl_AJSCbL2FopToSLYaEpgtTUwiQYyj` was Ready.
The authenticated Vercel transport returned login HTTP200, not an authenticated
application smoke. PR711 has not merged at this checkpoint.

The18 new SQL files were applied in one atomic Management API migration,
`20260906160743_clinical_master_oed_complete_pr711_18_migration_bundle`, with
transport SHA-256 `9fcd9bfa18d138b80535c474a09a4517b83720a1b0e722a13f239ee539fd2e31`.
The already-installed prerequisite was excluded. The API assigns one ledger
version for the bundle; it does not preserve the18 original filename versions.
Do not blindly replay those files or run `db push`: reconcile the ledger mapping
as a separate reviewed operation. The ordered original-file hashes are retained
in the restricted operator evidence manifest; no migration-history rows were forged.

Before application, all1597 catalog rows and binding baselines were backed up.
Raw PostgreSQL JSON-text page hashes and whole-workspace hashes matched exactly;
numeric-normalized client JSON is not the exact restore source. All101 previously
existing workspace-scoped public tables in the foreign control were unchanged
after DDL. Existing master522 source projections and latest revisions had no drift.

The first remote candidate rehearsal stopped at
`oed_lab_owner_cascade_incomplete` for the WBC item. No persistent candidate apply
was attempted. Immediate residue checks proved all44 master tables and all116
workspace/table fingerprints unchanged, with zero candidate release/receipt rows.
DDL remains installed; the old app is not a compatible completion writer during
the coordinated cutover. Sequences were not claimed unchanged.

The failure was reproduced locally from chronological immutable adoption: links
still legitimately pin owner revision1, while the latest prior master owner is2
with an identical lab-order profile. The protected item resolver requires the
latest prior owner or an accepted same-release catalog target. The append-only
operator repair uses the existing catalog-first pure-cascade acceptance path,
only after actual links match the stored workspace projection and immutable
old/new profiles and panel membership differ solely in revision pins. It does not
weaken the resolver or directly write links. Structural/custom drift must stop;
link bytes and every unrelated catalog field must survive catalog-only acceptance.
Unchanged sibling tests have no item CAS, and payload adoption does not update
existing links. After canonical core source acceptance, a separate immutable-owner
repair therefore uses the existing `labDefinition` catalog API with the complete
locked link set and every link/item revision. Old/new immutable profiles and panel
structure must match; all item/result pins and non-owner fields must remain exact.
Only order/panel owner revisions and matching metadata/hash may change. Existing
writer semantics preserve link/catalog revisions for this owner-only update.
The operator records an explicit audit plus receipt before/after link hashes;
the API itself is not claimed to emit that audit. Every candidate lab link must
finally match the catalog's immutable owner before any rollout can commit.
The focused positive run passed with an explicit outer rollback at helper SHA-256
`29195a90ce5b486e206e93d150dbdb79f435320d47fa37644bb9068ac24c49c1`:
normal-API owner repair and audits were non-vacuously exercised, every candidate
lab link passed owner readiness, existing values/versions survived, and exact
retry was stable across all permanent tables. The unchanged metabolic panel is
resolved through the approved order's exact immutable dependency pin; it is not
republished merely because its record is absent from this payload.
The default full historical-gap/structural-rejection/ACL/rollback harness and the
new exact-head Release Check/Preview must also pass before remote continuation.
Latest completion evidence is recorded in the PR packet rather than inferred
from this intermediate cutover checkpoint.
