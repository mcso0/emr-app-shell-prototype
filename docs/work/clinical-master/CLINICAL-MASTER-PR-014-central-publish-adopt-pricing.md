---
id: "CLINICAL-MASTER-PR-014"
status: "completed"
area: "clinical-master"
priority: "P0"
target_pr: "Central v3 publish, allowlisted workspace adoption, and workspace pricing"
execution_boundary: "remote migration and atomic persistent candidate applied to qmerxgzrwaaahpkhjqlc; authenticated production browser readback verified"
predecessor: "CLINICAL-MASTER-PR-013"
updated: "2026-08-24"
remote_writes: 2
---

# Clinical Master PR-014: central publish/adopt/pricing completion

## Boundary

This work item completed the Phase C remote release for the approved synthetic
operational master v3 payload on Supabase project `qmerxgzrwaaahpkhjqlc`.
Remote write operation 1 applied the additive release-scoped adoption
migration. Remote write operation 2 executed the hash-pinned persistent atomic
candidate `f984d4430ba5813d4fa4fd889a60bb2e61fe566ff4d8d228d53f57aa0caa6371`.
No Airtable operation or Order Set authoring was performed by this work item.

The executed candidate passed the fail-closed read-only fingerprints captured
by `supabase/snippets/clinical_master_operational_v3_phase_c_preflight.sql`.
The execution baseline was locked as follows:

| Baseline | Read-only evidence | Execution gate |
| --- | --- | --- |
| Remote releases | count `4`, max release `6`, latest source fingerprint `85cb291602f3d177ae11a075b4203bdf9e7cb9a3ac68c5a8245a5a90f739b7c7` | exact value must match at execution |
| Release-number sequence | `master.master_releases_release_no_seq`, `last_value=8`, `is_called=true`, next release number `9` | rerun preflight immediately before any future candidate; require the exact sequence state and `releaseNo=last_value+1` |
| Remote master type counts | chart_group 6, clinical_action 12, lab_panel 5, lab_test 14, order 31, order_category 8, result_input_type 4, species 2, specimen_type 5, task_route 6, unit 8 | exact map required |
| Remote lab publish stage | `172`, fingerprint `eac749d40ab0f0e88f9dabed2a5123b85933367d3fae4a3828ad37893e1a45c4` | exact count and fingerprint required |
| pilot catalog | `31`, fingerprint `5fe7ba9e93a045076157a77e5c852a5712660f99a0d2afbb3064a143c7586de0` | exact fingerprint required |
| Cheongdam catalog | `13`, fingerprint `82b9b2a3e9722093a65709a5a9dbdff19f709a8c00616a8203ec0b55f7d1d3c4` | exact fingerprint required |
| clair-demo catalog | `19`, fingerprint `c195d802a07ef3f820aed21809bc7d7bf84fa5013ed4e98e4951e64f5242bcf1` | exact fingerprint required |
| foreign catalog | `0`, fingerprint `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | exact fingerprint required; never adopt |

## Verified remote result

The persistent candidate completed successfully and committed release
`ad453c8e-85be-44c9-8ad1-912f197e6c32` as release number `9`, status
`published`, `recordCount: 230`, `adoptionScope: payload`, and source
fingerprint `0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893`.
The immutable payload manifest contains exactly `230` owners, including `120`
orders, and the release sequence is `9`.

| Workspace | Total catalog | V3 catalog | Active | Paused | Positive prices | Pending reviews |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `workspace-clinical-master-pilot-v1` | 122 | 120 | 120 | 0 | 120 | 0 |
| `workspace-clair-cheongdam` | 133 | 120 | 109 | 11 | 120 | 0 |
| `clair-demo` | 139 | 120 | 120 | 0 | 120 | 0 |

Each allowlisted workspace has the exact price fingerprint
`35fa6f6ec16f23c43a774b0f8abe03fa43fa8bfd6962278e0a76469580e05abf`.
All 11 reviewed Cheongdam custom rows remain active with their names preserved.
The excluded `clair-foreign-demo` catalog remains empty with fingerprint
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.

Authenticated production browser smoke at
`/w/workspace-clair-cheongdam/orders?modulePanel=open&section=orders` loaded the
VIP workspace and category counts, including lab `34`. It showed the preserved
custom `CBC` row active at `35,000` KRW and the V3 master `전혈구 기본 패널`
paused at `36,001` KRW, matching the reviewed collision policy. This is a
readback smoke of the existing production application; no new application
deployment is claimed by PR-014.

The supported-master identity/history fingerprint is
`8bbbcdbcfab3bf15aa69bcee87be4caab7aefaf9c3a73998640a8332dbb0b6b1`.
Pre-v3 release/version/review history fingerprints are
`8b1632cb9f5bf28bea2d8dadc33ca5d30a1afa2b65c1fe4c5bae548fc0653ed8`,
`0c0c30f610bc41cac7b84c171d14e3361ae337e9b59895d309c9462b83593c07`, and
`35c04f8d47dca5085f9b59df8e57dec7a0ce78e3deafb5e71b3bb7839f4ca635`.
The rehearsal compares these histories and all four lab stage tables before
and after the v3 release, excluding only v3 rows.

Active `hospital_admin` selection is deterministic (owner/admin role
precedence, then creation time and user ID) and user IDs are never printed.
The central source payload and workspace fixture are locked by their SHA-256
values in the operation manifest:

- adapter payload: `ee7c8d0f379c71ac675ad90d9e92abfd17da798785b4e0ebd566c6e8394e8697`
- pricing/adoption fixture: `7b0e273f9809e9febc2d74a9cc332f1a6fe4866bc112182da58cfba6a9e0ab2b`
- Airtable additive manifest candidate: `19951ef0fcf0831c0aa542def2be7618b99d8a8991a7e72373426c630d553f94`
- Airtable CAS baseline: `f3ba11edfc20ed0244ca4cb9c5bf0590313a173e2c07478edd35d05fcb059a4f`
- Phase C operation manifest: `c2178c6c22c0faaa2bb16fc505068128f5c5567951fe7a9a52dc2a3972ecbea8`
- Phase C read-only preflight query: `6faf29e765a129c75e7a767331228262ca4ace969ccbba6307612d4a888e57ca`
- Phase C rollback template: `f5d940984248f38ce0c8cb1b0a112b2019e06fd3eeb8c8c340d448183bbbaa95`
- rendered pure-SQL rollback: `35d558e800fd4955a7e1fd2dff9cde264e02621c5ee3d38465740025eb2ef93a`
- rendered full/remote pure-SQL rollback: `9270e3e6da78c213bf25fadd931093dbdbd8cd0874c9f9b83d543432ecafcbc5`
- persistent full/remote pure-SQL commit candidate: `f984d4430ba5813d4fa4fd889a60bb2e61fe566ff4d8d228d53f57aa0caa6371`
- Phase C generator: `39be49b0dc6e55aebde355142f51d221272a0b0ca1436408f5e720d638fc4287`
- Phase C static spec: `f058440b7aed553c2e617b8f34785c6c91222ad858ca22235932098e8d755313`
- release-scoped adoption migration: `4699bbd82b0e5af6a40066750f6876110cf128b1e7d546f187aa10a1ed6c9cd2`
- release-scoped adoption static spec: `2795964826d9193b9f3edcf95c54aa6109b00843326f3eac133afc9145b4a300`
- release-scoped adoption replay: `30abf999b861b11d2dff7947105fcaa0da592233b57e93cd2434959220e259be`

## Executed operation

The central publisher call is private and was invoked only after the baseline
checks. The exact v3 payload was submitted once and then retried byte-for-byte;
the retry returned the same release ID, release number, source fingerprint,
and `recordCount: 230`, with `idempotent: true`. Release numbers are allocated
by the nontransactional sequence, so the candidate requires the preflight
sequence `last_value`/`is_called` snapshot and enforces `releaseNo=last_value+1`
as well as `releaseNo > maxReleaseNo` and uniqueness. Existing releases, master
records, versions, review events, and stage rows are protected by identity and
fingerprint assertions.

The V3 payload explicitly carries `adoptionScope: "payload"`. The additive
`20260824091724_clinical_master_release_scoped_workspace_adoption.sql` migration
persists that scope in each release, preserves cumulative adoption for existing
releases, and makes payload adoption traverse only the immutable publisher-written
owner manifest after exact parity with both stage tables. Missing nonpayload
initial/metabolic rows are not created, and existing nonpayload catalog, lab
projection, pinned version/link, update, and notification rows are excluded.

Adoption is allowlisted to:

- `workspace-clinical-master-pilot-v1`
- `workspace-clair-cheongdam`
- `clair-demo`

`clair-foreign-demo` is a read-only pre/post fingerprint negative control. The
persistent candidate uses one top-level atomic transaction containing three
ordered workspace logical stop-on-error blocks. Any workspace failure aborts
the central publish and every workspace change, so cross-workspace partial
commit is impossible. The tracked rehearsal executes the same ordered body and
ends with `ROLLBACK` so atomicity can be checked without leaving state. Unlike
the rehearsal, persistent execution never rewinds the nontransactional release
sequence; a failed attempt may consume a gap and requires a fresh preflight and
regenerated candidate.

Workspace catalog changes used only the approved public RPCs. Before each
authenticated catalog or review call the candidate set both
`request.jwt.claim.sub` and `request.jwt.claims` to the selected active admin,
then set `local role authenticated`. It restored `local role postgres` and
the original claim values after each call and again before transaction close.
No direct catalog, review, or audit DML is present. The selected actor must
have `service_catalog:manage`; the lab resolver search path and
authenticated-only ACL (including anon and service_role denial) are checked
before any workspace call.
Before publisher or workspace DML, the candidate also pinned every new internal
canonicalizer/adopter helper to owner `postgres`, its expected definer mode and
exact `search_path`, denies effective execution to `anon`, `authenticated`, and
`service_role`, and verifies the immutable manifest table/trigger plus the
validated `adoption_scope` column/default/check/trigger contract.

The 120 price rows are positive, integer, unique KRW fixture values generated
as category base plus category serial, with total `5,529,073` KRW. They are
sent only through the public catalog RPC and never enter the central publisher
payload. Final catalog totals are derived from live rows and lineage; the plan
does not assert that a workspace has exactly 120 rows.

Cheongdam custom rows always win. The reviewed collision map has 11 exact
custom-row/master-key pairs (consultation, dispensing, abdominal ultrasound,
CBC/chemistry/urinalysis panels, ear cleaning, subcutaneous fluid, core
vaccine, and one-day hospitalization). Existing custom IDs, names, prices,
statuses, snapshots, and lineage are preserved. Only the corresponding newly
adopted v3 master row is paused; custom rows are never deleted. The old paused
metabolic master is not part of v3 pricing. `X-ray 2컷` remains distinct from
the anatomical radiography rows until an exact semantic match is proven.

The public catalog sequence is price-only CAS/RPC first, then one strict
payload-linked `pending`/`update_type: new` review pass at the current
catalog-item/master revision. The selector requires null
`previous_source_revision`/`workspace_snapshot`, exact item/source projection
and fingerprint, independently published update and held-version releases
with `held releaseNo <= update releaseNo <= v3 releaseNo`, and positive price;
the update release identity is never required to equal the held version
release. It is not scoped only by `release_id`, so eligible legacy-held payload
rows are covered while the legacy initial and metabolic nonpayload rows remain
pending and untouched. Any payload-linked pending row outside the exact
current-source join fails before resolver or active work. Each target is
re-locked and revalidated against both release rows before the public
`accept_source` RPC, with exact action/update identity and resolved actor/time
readback. Before active patching, every one of
the 120 payload catalog rows must have current source revision/fingerprint, an
accepted actor/time-bearing version-backed `new` lifecycle, and no linked
pending row. A deterministic diagnostic reports separate `missingAccepted` and
`pendingLinked` lists, including wrong-source linked blockers. A fresh-CAS public RPC then sets
`availabilityStatus: active` for every v3 payload order; only reviewed
Cheongdam collision masters are paused afterward. The central payload defines 36 lab tests, but only 30 referenced test keys are
projected by the 30 profiles/panel memberships. The lab assertions require 30
projected tests, 10 panels, 60 source panel links, 30 profiles, one source item
per `(workspace, source master test)`, unique catalog/test links, and no
duplicate source rows after idempotent retry.
The adopter's `catalogCount` and `createdLinkCount` are checked against the
exact payload-manifest owners and their immutable pinned profiles; older
nonpayload rows such as the held metabolic catalog remain byte-identical and
outside those totals. `createdItemCount` is checked as baseline-plus-new-version
delta to 30 referenced tests, while `createdLinkCount` is the exact 80-attempt
payload projection total rather than an inserted-row delta. The release-scoped
v3 projection contains exactly 30 catalogs, 30 tests, and 80 links.
Before the resolver loop, the order-review shape gate reports and requires
`selectedTargetCount=120`, `pendingPayloadCount=120`, `payloadCatalogCount=120`,
`positivePricePayloadCount=120`, `canonicalProjectionMatchCount=120`, and
`versionReleaseMatchCount=120`. Canonical source snapshots/fingerprints are
frozen once from `private.clinical_master_order_source_projection`; raw held
version JSON is retained only as immutable version/release evidence.
A second identical adopter call must return `createdItemCount: 0`, preserve the
same derived catalog/link totals, and leave the projected
`lab_test_item_versions` row count and ordered semantic fingerprint
byte-identical. Payload ownership is derived from inline order/test key sets;
`release_id` is reserved for stage/history/review-ledger evidence because
unchanged master owners do not receive a new release version row.
Fresh lab definitions can be auto-created without corresponding
`workspace_lab_*_updates`; created-item/link counts therefore do not require a
review-ledger row. If release-scoped lab ledger rows exist, the rehearsal still
requires exact source lineage, valid status, resolved actor where applicable,
and no pending rows. Only existing pending rows are resolved through the public
lab review RPC. These adoption/catalog/review RPCs do not emit
`public.audit_events`, so evidence is the optional target-workspace order
review-ledger validation by source identity plus release-scoped lab review-ledger
validation and final projection counts; the foreign workspace
audit surface is separately fingerprinted and must remain unchanged.

The consultation key `cm.order.consult.initial` is a legacy/test identity and
is excluded from the v3 payload, pricing, collision map, and sets. The fresh
v3 key is `cm.order.consult.first-visit` with Korean preferred name `초진`.
The Airtable candidate requires one audited identity fork before additive
creates: record `recZW92s9i06wpNp0` must compare-and-swap its exact current
`masterKey` `cm.order.consult.initial` to
`cm.order.consult.first-visit`, preserving linked Name record
`rec0Pw4CymPIed8ta`; the inverse restore uses the same record ID and old key.
This is 106 unchanged live Master rows plus one audited fork, not a silent
source/Name remap. The central legacy row remains immutable until that
explicit CAS is accepted and read back.

## Tracked files

- `scripts/generate-clinical-master-operational-v3-phase-c.ts` — deterministic
  commit-candidate manifest generator and `--check` drift gate.
- `tests/fixtures/clinical-master-operational-v3-phase-c-operation-manifest.json`
  — input hashes, exact operation order, allowlist, collision map, pricing
  rows, preflight requirements, and no-write safety flags.
- `supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql` —
  full preflight/publish/adopt/pricing/review rehearsal that always rolls back;
  `publisher_only`/`local` is the bounded Docker fallback.
- `supabase/snippets/clinical_master_operational_v3_phase_c_rollback_rendered.sql` —
  generator-rendered pure SQL with inline payload/pricing/constants; no psql
  meta-commands or variables; always ends in `ROLLBACK`.
- `supabase/snippets/clinical_master_operational_v3_phase_c_rollback_remote_rendered.sql` —
  separate generator-rendered `full`/`remote` candidate with the exact remote
  baseline constants; no local-mode fallback and no `COMMIT`.
- `supabase/snippets/clinical_master_operational_v3_phase_c_commit_candidate.sql` —
  generator-derived persistent full/remote candidate; one atomic transaction,
  no sequence rewind, no psql meta-commands, and an explicit terminal `COMMIT`.
- `supabase/snippets/clinical_master_operational_v3_phase_c_preflight.sql` —
  read-only release/type/stage query plus exact full fingerprints for pilot,
  Cheongdam, clair-demo, and foreign.
- `tests/clinical-master-operational-v3-phase-c.spec.ts` — static manifest,
  RPC/ACL, auth-claim, no-direct-DML, cardinality, and rollback assertions.
- `supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql`
  — persisted cumulative/payload scope, exact stage-owner adoption dispatch, and
  fail-closed owner identity/revision checks.
- `supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql`
  — local transaction/static dispatch, retry, and ACL contract replay.

## Verification

Generator and static Phase C spec passed:

```text
node --experimental-strip-types scripts/generate-clinical-master-operational-v3-phase-c.ts --check
PLAYWRIGHT_BASE_URL=https://emr-app-shell-prototype.vercel.app node_modules/.bin/playwright test tests/clinical-master-operational-v3.spec.ts tests/clinical-master-operational-v3-phase-c.spec.ts --reporter=line
PLAYWRIGHT_BASE_URL=https://emr-app-shell-prototype.vercel.app node_modules/.bin/playwright test tests/clinical-master-release-scoped-workspace-adoption.spec.ts --reporter=line
node_modules/.bin/eslint --max-warnings=0 scripts/generate-clinical-master-operational-v3.ts scripts/generate-clinical-master-operational-v3-phase-c.ts
```

The combined focused spec is `18/18` (Phase C `8/8`, operational v3 `5/5`, release-scoped adoption `5/5`); it includes pure-SQL/meta-command absence,
source/pricing SHA locks, six remote constants, foreign-surface guards,
Cheongdam custom ID-set checks, resolver ACL/permission checks, and the single
strict current-source review ordering/coverage guards, including the fresh-key
Airtable identity-fork CAS.

The persistent commit candidate is deterministically derived from the exact
full/remote rollback SQL that passed remote execution. Its only behavioral
differences are removal of every release-sequence rewind and the terminal
`ROLLBACK` to `COMMIT`/result-label change. The exact
`f984d4430ba5813d4fa4fd889a60bb2e61fe566ff4d8d228d53f57aa0caa6371`
candidate passed remotely and committed atomically. Sequence `9`, the release,
all three workspace readbacks, and the unchanged foreign control were verified
after execution. The consumed baseline is no longer a rerunnable candidate;
the old baseline now fails closed rather than repeating pricing or review RPCs.

The local Docker replay was run with the final adapter/pricing fixtures in
`publisher_only` + `local` mode. It called the private publisher twice inside
one transaction, required the second call to be idempotent, then rolled back.
The release-scoped database canonicalizer fingerprint is
`0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893`.
It is the SHA-256 of PostgreSQL `jsonb ::text` after explicit
`adoptionScope: payload` canonicalization, not a JavaScript serialization hash.
The omitted-scope canonical bytes retain the historical
`3213a3f84595ae11007970448b670063c49ea167f01e1825258a655b6843c137` hash. The first
call returned `idempotent:false`/`recordCount:230`, the retry returned
`idempotent:true`, and the fresh residual query returned v3 releases `0`, v3
records `0`, and v3 publish-stage rows `0`.

The full remote rollback rehearsal passed first with exact state restoration,
including the release sequence and all protected fingerprints. The subsequent
persistent candidate used the same verified body, omitted sequence rewinds,
and committed the remote state recorded above. The local Docker seed still has
no `workspace-clinical-master-pilot-v1`, so only publisher-focused local replay
is claimed; the three-workspace completion claim comes from the verified remote
transaction and post-commit readback.

The release-scoped migration/replay was also executed against the local Docker
Postgres through `psql` inside the database container. It covers historical
no-scope canonical bytes/retry, cumulative compatibility, exact payload creation
and unchanged-owner reuse, absent initial/metabolic rows, an existing nonpayload
metabolic catalog plus lab/version/link/update/notification byte snapshot, and
simultaneous two-stage omission/content replacement with zero workspace mutation.
It completed with the additive migration DDL/functions, the
`clinical_master_release_scoped_workspace_adoption_replay_ok` notice, and
`ROLLBACK`; no local rows or functions remained persisted after the replay.

The exact reviewed candidate hashes are recorded once above and are enforced
by the Phase C static spec against the current files. Any generator, spec,
manifest, preflight, template, or rendered-SQL change invalidates the approval
candidate until this work item and the generated artifact set are regenerated
and reviewed together.
