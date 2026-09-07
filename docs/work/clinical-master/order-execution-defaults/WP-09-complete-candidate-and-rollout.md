---
type: Work Package
title: Complete candidate reconciliation and staged rollout
status: in_progress
updated: 2026-09-07
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

### Resource and transport remediation — 2026-09-07

The approved one-item Cheongdam synthetic glucose activation is now the baseline;
the canonical writer changed only item activity/local revision and the linked
catalog revision, with an explicit audit. Existing result pins/history and all
other scoped tables remained unchanged. Candidate packet
`31dc031650cdd29d0150bc34537372443f397a92615e8f76d25a8047bd38f048`
retains the same payload/configuration and updates only that approved preflight.
Its full rehearsal lost the connection during a server restart at05:11:51 UTC.
The CSV was empty: FAILED, not PASS. Independent44 master/116 workspace-table
fingerprints matched the after-glucose baseline, with zero candidate release and
zero receipt. Restart logs do not prove an OOM cause. The prior Production writer
remains incompatible with the installed actual-value triggers; no order workflow
is claimed usable until coordinated app/DB delivery and authenticated smoke.

The initial local memory estimate used an obsolete cumulative publisher. Added
the two already-deployed20260831132225/20260831135847 prerequisites to the local
harness and assert current remote cumulative-body SHA
`5f2f2992c15d80f4a9d8ddad84574ba16831590c86f92bce08454f134982016a`.
Do not use the older relation-function memory experiment as a remote diagnosis.

On the matched baseline, two scalar SQL-function context groups retained about
447MB after retry. The narrow remediation wraps their exact SELECT bodies in
PL/pgSQL, preserving current treatmentV2 validation, SQL NULL/JSON null, errors,
OID, owner/ACL, definer/invoker, search_path and every other pg_proc property.
Migration `20260907054704_clinical_master_oed_scalar_memory.sql` pins both previous
body hashes and changes no table, publisher, fingerprint, audit or atomicity rule.
The paired local experiment removed those two large retained groups; sparse
whole-container samples were1.527GiB before /789.1MiB after. These are neither
exact peaks nor a remote capacity guarantee, and do not establish restart cause.

Fresh local evidence:

- Scalar differential:416 field-cell +1100 schema cases, result and SQLSTATE/message
  equality, unchanged function metadata; outer ROLLBACK.
- Full23-migration WP09 harness: structural drift/ACL/actor/SHA/foreign/stale
  rejection; complete false-rehearsal residue check; late-failure rollback;
  524 selectable/51 paused/53 new prices per target;9 devices/519 bindings/
  90 compositions; exact retry stable; outer ROLLBACK.
- Reviewed rehearsal transport:12 tests, including mock-TTY exit/failure/interruption/
  accelerated deadline and one-shot replay rejection. Existing client timeout
  independently terminated a local sleep. No password or remote DB was used.

`scripts/run-wp09-reviewed-rehearsal.mjs` requires a separately reviewed manifest
SHA; `--check` is non-mutating. `--run` launches only once per manifest, verifies
copied bytes, uses clean container environment and verified TLS, reads the password
directly through psql, and bounds the client to960 seconds plus a host watchdog.
Transport exit (including zero) always leaves remote outcome UNKNOWN until CSV
validation and independent server/residue inspection. No automatic retry or paid
compute change. The manifest, CA, connection details, terminal logs, before/after
snapshots and rollback function definitions stay in restricted local evidence,
not committed docs. New runtime hashes require a freshly reviewed wrapper before
another full remote rehearsal.

The narrow scalar migration was then applied remotely as ledger version
`20260907055739_clinical_master_oed_scalar_memory`. Exact replacement body hashes
and unchanged OID/owner/ACL/metadata were independently read back. The416+1100
differential cases also passed remotely inside a rolled-back temporary test.
All44 master and116 scoped workspace fingerprints remained exact, with no
candidate release/receipt and no further server restart. This is function-only
remediation, not the full candidate rollout. The newly prepared wrapper pins both
replacement bodies and metadata before/after execution. The subsequent execution
and independent readback are recorded below; Production remains incomplete.

### Persistent candidate and independent readback — 2026-09-07

The complete remote false rehearsal passed for packet SHA-256
`31dc031650cdd29d0150bc34537372443f397a92615e8f76d25a8047bd38f048`.
Its CSV was validated, then all44 master and116 scoped workspace fingerprints,
both scalar functions and their metadata were independently unchanged; candidate
release/receipt counts were zero. Failed password attempts never started SQL.
Their one-shot markers and logs were retained rather than reused or removed.

The separately reviewed true operation committed that same packet once. Independent
readback found one receipt and one published release
`85c4a744-5d2b-4a86-aa64-10a6fd009958`. The214059-byte outcome CSV exactly equals
the persisted receipt outcome: applied true, rehearsal false, clinical approval
false, exact three-workspace allowlist, and240 canonical lab-owner refresh entries.

The client reported `postcommit_receipt_guard` statement timeout (`57014`) with
`commit_acknowledged=true`; it did not report a successful terminal marker. A bulk
MCP fingerprint read also exceeded its transport limit. Neither failure was treated
as rollback or used to justify replay. Independent read-only queries, split into
four workspace/table comparisons per request using the same native row ordering
and digest expression, matched all116 receipt after-fingerprints. All65 protected
foreign/history comparisons matched the pre-apply baseline. These split reads span
multiple read transactions, not one shared snapshot; no intervening writes were
performed by this task. Both scalar bodies/metadata, the rollout helper, and the
server start time remained unchanged.

Independent semantic queries confirmed each workspace has524 selectable candidates,
51 paused replacements,53 exact approved new prices,3 manual devices,173 synthetic
manual-profile bindings, and30 current compositions with the approved parent-price
or pilot nonbillable policy. The pre-apply exact catalog backup contains1597 rows;
every existing ID, price, pricing rule, billing eligibility/reflection and sales unit
matched after commit. Manual profiles remain synthetic and not clinically validated.

Workspace adoption retries ran inside the committed helper and passed its no-change
assertion. A separate top-level receipt replay has not been executed after commit;
do not claim it was. No automatic retry, credential reset, paid compute change,
permission weakening, deletion of history, or additional workspace adoption occurred.
Restricted local evidence retains the original backups, failed transport logs,
receipt, CSV, split fingerprints, semantic checks and runtime metadata.

Current local follow-up gates:12 transport tests including mock-TTY scenarios,
15 packet/configuration tests, secret scan, diff check, lint, typecheck and build
passed. Build retains an existing broad NFT trace warning through the docs reader;
no unrelated configuration change was made. The final commit's docs/secret gate,
exact Release Check and Ready Preview must still be recorded. PR711 is not merged;
compatible app delivery and authenticated three-workspace acceptance remain open.

### Authenticated Preview discovery and nullable-set correction — 2026-09-07

Candidate564688 passed Release Check34093913274 and reached Ready Preview
`dpl_WqpNRQqhPkYaNBNhMiPFxETJTKLT`. With an existing signed-in synthetic account,
Cheongdam Admin showed the blood-glucose order's exact identity, serum defaults,
dog/cat manual-profile bindings and preserved36012KRW price. A temporary search
alias survived save/reload; use-stop persisted as paused. The ordinary UI restored
active status and empty aliases afterward (catalog revision13); audit/customization
metadata was retained rather than reset. No clinical default or price changed.

Chart candidate loading then failed with HTTP500 before any new QA order existed.
The existing four encounter drafts were fingerprinted and left untouched. A bounded
read-only RPC returned541 unique rows; offline replay through the actual gateway
rejected33 non-range-priced sets. `readString(null)` had erased the explicit SQL
null range basis, contradicting the mapper's own non-range price contract.
The narrow mapper correction preserves explicit nullable range basis for both
SQL and camel-case envelopes; missing/malformed values still fail closed. The
regression failed before the fix, then all541 captured rows passed full-list replay
and104 focused catalog/read/taxonomy tests passed. Independent review found no
must-fix issue. No DB migration, policy weakening or candidate filtering was used.

The corrected code still needs its own exact Release Check/Ready Preview and
resumed authenticated acceptance. The pilot workspace has no patients/encounters;
its acceptance requires a synthetic fixture through the supported UI. No new QA
patient, chart order, actual result or retest was created at this checkpoint.
Production remains unmerged; the full deployment objective is still active.

### Authenticated draft-save preservation correction — 2026-09-07

Exact5b731f5dfa5ed27e68a4a9fdf5f81f35b84488e5 passed Release Check34095495498
and Ready Preview `dpl_DAj6cRsufepHRUkfwkuqWCourBv4`. After login, Cheongdam chart
search loaded492 patient-eligible candidates (the server list is541; species
filtering is separate). Selecting three new synthetic consultation/lab/imaging
orders reached the draft writer but returned HTTP500. Postgres logs at16:40:58KST
reported `P0001 catalog_item_unavailable`, not a memory/statement-timeout failure.
Independent readback found no new order and identical fingerprints for all four
existing encounter drafts. No confirm/result/retest occurred.

The old eye-drop dispensing draft still pins its original snapshot while its
catalog source is now paused. The client sent all existing drafts with the new
ones; the SQL upsert writer rebuilds every submitted catalog snapshot. This both
rejects a paused source and risks rebasing untouched active-source pins/prices.
The existing RPC contract preserves omitted rows; only `removedOrderIds` removes
drafts. The correction therefore stays in the shared client serializer: omit an
unchanged persisted root, keep every new/edited root, and submit the parent with
all child inputs when a set child changes. Full UI/reconciliation rows, CAS,
explicit removal, source eligibility and both save callers remain unchanged.
No SQL migration, catalog reactivation, permission change or history rewrite.

Ten tests execute the actual extracted serializer/dirty helpers: eight failed
before the fix; all ten pass afterward. Twenty-eight existing pure contracts pass,
and the local API route test passes with the configured mock dev server. An initial
serverless test invocation had one Invalid URL setup failure; it was rerun with
the app server rather than counted as passing. Typecheck, focused/full lint,
build, docs1009 and UX-copy checks pass; build retains the existing unrelated
docs-reader NFT warning. Independent review found no must-fix issue and reran
all10 serializer cases successfully. New exact-candidate Release Check/Preview
and authenticated acceptance remain required.

Pilot Admin alias/save/reload/use-stop also passed on the earlier Preview and was
restored to active/empty aliases at revision12, retaining36012KRW and defaults.
Cheongdam final revision13 remains the earlier restored baseline. These intended
Admin edits postdate the116-fingerprint adoption proof; do not claim the entire
catalog/audit state stayed unchanged after QA. Clair-demo Admin and clinical-default
edit/reset checks remain. The full objective and Production delivery are not done.

### Authenticated result/retest evidence and live-display corrections — 2026-09-07

Exact3658c2c396217c9216680a3ca0d2f93f01aac2c9 passed Release Check34097346851
and Ready Preview `dpl_AWesFdDCWnDj6Uz3RfmaB6XWkk7s`; the branch alias points to
that deployment. Cheongdam synthetic encounter8da74865-36ff-4cda-ae7d-1e3b4d55c7d2
successfully added consultation868c98f7-173d-4f4f-a797-3432d99c8907,
WBC2800faee-c72a-452e-880d-39ebcbdc0fb0 and existing-CT-review
c4f4569c-cf6a-4bd9-9b26-b1f5045ec01d. All four prior draft-row fingerprints
remain identical after these confirmations; paused catalog sources stayed paused.

Consultation and imaging actual records both retain original v1 plus reasoned v2,
the original performer/time and an unchanged Task-plan hash. UI reload and separate
DB reads agree. A completed consultation Task intentionally retains its initial
plan even when the Order confirmed snapshot later receives calculation metadata;
do not assert equality between these two distinct snapshots or rewrite either.
Canonical WBC9.9 persisted and generated an explicitly chosen same-encounter,
new-specimen/manual-profile/no-charge atomic retest52dff63f-9059-4871-8bbd-60ba2dbd01eb.
The retest was separately confirmed, saved as10.1 and completed. Its billing
candidate count remains0, and the original9.9 row fingerprint is unchanged.
Entering a QA marker in the device-warning field correctly produced flagged_result
and blocked completion. Removing that non-device marker through normal result-save
created entry revision2 and allowed completion; no guard or permission was weakened.
All four new execution tasks are complete. These are synthetic functional records,
not real exams, clinical validation, hardware input, payment or external messages.

Observed UI defects are corrected locally without a migration:

- Atomic confirmation returns rows captured before its final revision update.
  A scoped existing GET readback now refreshes only confirmed selected roots/children;
  failed readback preserves the successful command and its original ETag.
- The old history label treated the B3 set-application hash as the confirmed plan.
  Individual orders normally lack that hash. The UI now distinguishes a scoped
  Task execution plan from the optional set hash; no snapshot/hash is invented.
- Live lab/imaging pages exposed unsaved comment editors, sample attachments,
  generated clinical prose and mock staff/US fallbacks. These unsupported live
  surfaces now explain their limits; canonical result saving and typed actual/history
  actions remain. Existing snapshot names, request time and assignment presence are
  used without guessing an unprovided clinician name or imaging modality.
- Pilot reception showed mock staff IDs rejected by the existing UUID/membership
  guard. Its three staff-source predicates now reuse the existing real workspace
  staff path only for pilot plus Supabase auth, including its existing scoped
  reception snapshot and missing-patient profile reads. Cheongdam, legacy/mock behavior,
  permission checks and registered-location boundaries are unchanged.

Focused regression evidence: chart history13, live display6 and pilot staff4 pass,
with failures reproduced on the previous code; previous delta-save10 remains covered.
The browserless catalog contract config now includes all four files and passes237
combined tests. Independent chart, lab and reception reviews found no must-fix issue.
Full typecheck, lint, build, docs1009, secrets4241 and UX-copy pass; the build retains the existing
unrelated docs-reader NFT warning. The first UX command used an incorrect script name
and ran no check; the correct ux-copy:check passed. Final staged secret scan4244
also passed; new Preview verification remains. Clair-demo glucose Admin alias plus pretreatment-default edit/save/reload,
field-only master reset and use-stop passed. Final catalog revision13 is active,
aliases empty, original default inputs and36012KRW restored; audit/revisions remain.
The initial save confirmation was dismissed by a premature QA reload and wrote
nothing; the subsequent confirmed save and reload are the verified result.
pilot synthetic registration/encounter and remaining workspace flow acceptance are
not yet complete. PR711 remains open and unmerged. Preserve all synthetic QA IDs as
append-only evidence; do not reset historical results to make fingerprints match.

## Authenticated 974d checkpoint and live-selection correction (2026-09-07)

Exact974d02b3ad512418d4dd2ea1542e9f825b5c7867 Release Check34100400065 passed.
Preview dpl_4DHfyQvHTNA7GPcLbQM4n5er2Bzq is Ready; immutable irsys5nfk and
branch alias resolve to the same deployment. Existing login survived reload.
Three-workspace glucose clinical-default edit/save/reload/field-only master reset
now passes. Final revisions Cheongdam15/pilot14/clair-demo13 all retain active,
aliases[], the original four defaults and36012KRW. Revision/audit history remains.

Pilot UI now shows the actual single workspace staff member. Approved synthetic
patient98812500-1da2-4d2b-9f6d-b9d6608bde88 was registered through the supported UI;
no real personal data or external communication was used. Registration signature
controls are prototype state, not evidence of collected consent. Reception correctly
blocks the closed day: read-only DB confirms no weekly hours or date exceptions.
No encounter, operating hours, schedule, department, room or role was invented.
Pilot clinical acceptance requires a separately scoped operational-fixture decision.

Clair-demo actual synthetic Nabi encounter439cb9c0-94df-482b-8d99-00a4cc4525f7
(May30, patient19421000-0000-4000-8000-000000000002) was selected from the live queue.
The URL, patient header and five existing orders agree; all five pre/post-addition
whole-row fingerprints match. New consultationc5eadbad-4fc6-4f34-a058-d2d22a2eac29,
WBC4b9cbfc8-8336-4e43-969c-06804d4a698f and CT-review38c50fd1-89a9-4f15-b1e2-be06a0f47918
are additive QA rows. WBC explicit cat manual profiled76b4b21-02b6-55e3-8d66-efc97b89c43f
and deviceb3d56bba-638c-5953-b974-6197b9608270 persisted with synthetic clinical context.
WBC and CT confirmed; tasks9d6106b9-4bec-4e54-a3b7-1ec24f1f24fc and
526ea975-769f-4078-8b79-cc954fe9f159 are pending downstream work. WBC history immediately
shows revision1 and Task plan retained, validating the974d readback/display fix.
Results, retest and imaging actual/version acceptance are not yet complete here.

Consultation is intentionally still draft: its clinician policy is runtime_resolved,
not arbitrary manual input. Client and SQL remove a submitted actor ID and use only
encounter.primary_veterinarian_id, which is absent on this existing encounter.
The required-field block is correct. Do not alter the resolver or old encounter just
to complete QA. The UI's misleading free-text field is now read-only in inline,
detail and amendment controls, showing its actual value or the missing-vet reason.

First entry into authenticated clair-demo exposed sample Coco despite an empty live
queue. Existing sample-ID bridging could then show a different live order set.
No write was made on that phantom selection. Local correction confines all five
chart fallback consumers and scenario synchronization to mock auth, preserving
actual UUID selection and existing empty/error handling. Shared work-queue date
initialization and refresh now use the current operating date in Supabase mode;
mock fixture dates and explicitly selected dates remain. The pure date helpers,
server bridge, permissions, clinician resolver, historical rows and DB are unchanged.
Initial regression reproduced empty/scope/date/scenario failures; two additional
component tests reproduced the editable clinician defect. All10 focused regressions
and247 combined contracts pass, including shared-clock initialization/refresh and
explicit-date preservation. Full typecheck, lint and build pass; the build retains
the existing unrelated docs-reader NFT warning. Docs1009, secrets4244, UX-copy and
diff checks pass; the final staged secret scan includes the new test and passes4245.
Independent selection-boundary and clinician-render reviews found no must-fix issue.
PR711 remains open; this local delta still needs commit/check/Preview verification.
