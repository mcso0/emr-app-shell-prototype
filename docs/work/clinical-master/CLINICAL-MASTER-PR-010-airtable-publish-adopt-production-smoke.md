---
id: "CLINICAL-MASTER-PR-010"
status: "completed"
area: "clinical-master"
priority: "P0"
target_pr: "Airtable publish, synthetic workspace adoption, and authenticated production smoke"
execution_boundary: "production-synthetic-only"
updated: "2026-08-23"
completion_report: "docs/completed/clinical-master/2026-08-23-clinical-master-airtable-pilot-operational-closeout-report.html"
delivery_prs: "#584, #585, #586"
---

# Clinical Master PR-010: Airtable Publish, Adoption, and Production Smoke

## Status and authorization boundary

PR-011's local migration/replay evidence is complete. Sol's initial review
returned `REJECT/MUST-FIX 3`; all three findings were corrected, and the final
re-review returned `APPROVE/MUST-FIX 0`. PR #584 was merged and the exact
publisher hotfix migration was applied remotely with its migration-history,
constraint, function ACL/search-path, and six-row stage fingerprint gates
passing. The run stopped before workspace creation when readback proved the
legacy creator RPC would change the existing synthetic admin's `initial` from
`SM` to `송`.

The additive creator-profile preservation migration was delivered in PR #585
(`4994d561…`) as migration `20260823140000`; its local replay passed and Sol
returned `APPROVE/MUST-FIX 0`. The exact synthetic publish/adopt run then
completed, with persistent publisher/adopter state and rollback-only
operational smoke recorded below. PR #586 (`65c7227e…`) delivered migration
`20260823142511`, Release Check `32646206229`, and Vercel deployment
`dpl_BYmnrGkff9Uqwiq9DKTcMmxHo25v` READY on the production alias. Credentialed
browser login/workspace/catalog visibility remains pending and is intentionally
not claimed. These exact files and hashes are not permission to improvise a
different migration or to bypass the authenticated publisher/adopter boundary.
The operation used synthetic data only and did not authorize real patient,
guardian, hospital, payment, or external-provider data or side effects.

The user authorization recorded in this request chain is:

- `모두 승인`
- `필요한 승인 미리 승인`
- latest continuation: `고고해보자`

Those approvals apply only to the exact synthetic project, release, workspace,
publisher/adopter path, and transactional/read-only smoke checks described below.
Publisher/adopter state is the approved persistent state; the operational smoke
is explicitly rolled back. They do not authorize broad workspace mutation,
direct table inserts, deletion of immutable master rows, or bypassing
authenticated server boundaries.

## Exact immutable inputs

| Item | Value |
| --- | --- |
| Supabase project | `qmerxgzrwaaahpkhjqlc` |
| Authoring snapshot SHA-256 | `44a0fd0f22030b9052efae80077067615177976a08583705b34c67a3846a6216` |
| Adapter result SHA-256 | `c15ed6176ef860b4607385537bb91e2b091f1f3c36f15f4dfaec874490fd0e2b` |
| Exact publisher `.payload` SHA-256 | `0ff241fd3281a0e7170773dc49f978eea35e8968a79ad8800070955ed16f484e` |
| Exact remote migration | `supabase/migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql` |
| Remote migration SHA-256 | `1d8d12e71aa23c2b5c4867e9601ab925bbda622b1d6940720fa2b7da929e1015` |
| Creator-profile preservation migration | `supabase/migrations/20260823140000_workspace_creation_creator_profile_preservation.sql` |
| Creator-profile preservation migration SHA-256 | `24270b80b6ebcc814670067ed6eb27e15d0e7abb041fc781d28af88cedc2c920` |
| Release key | `cm.release.airtable.operational-pilot.v1` |
| Synthetic target workspace | `workspace-clinical-master-pilot-v1` |
| Synthetic admin identity | `00000000-0000-4000-8000-000000000001` |

The hashes are input locks. If the authoring snapshot, adapter result, or
publisher payload differs, stop before publish/adoption and obtain a fresh
reviewed handoff. Do not silently regenerate or substitute a payload.

`.tmp-airtable-operational-pilot-authoring.json` was used only for local hash
verification and was removed before candidate staging. It must not be
regenerated or included in any commit.

## Airtable collision-remediation readback

The approved Airtable Base `applMtgWwOxwPigB8` was updated in place without
adding or deleting rows. Exactly 11 existing `Master Records` primary keys now
use the production-safe `phase1a2.fallback.*` identities: four chart groups,
five task routes, and two species. The existing `cm.chart.treatment` row was
retained and its chart sort order was set to `905`; the four remapped chart
rows read back with sort orders `901`–`904`. The five classification-path rows
still point to the same Airtable record IDs; only the displayed primary-key
values changed. The post-write table counts were exactly `1/1/107/107/5/13/17/12`
for Release Drafts/Sources/Master Records/Names/Classification Paths/Lab Panel
Items/Lab Order Profiles/Diagnosis Category Links.

The resulting publish payload still contains 83 supported records, 30 orders,
and excludes 24 diagnosis records plus 12 diagnosis-category links. Because
the 11 fallback identities already exist in the target database, the local
publisher replay expects 72 new `master_records`, 83 new revisions, chart
groups `+1`, task routes `+0`, and species `+0`; classification paths advance
by five new `cm.path.*` rows.

The remote pilot readback confirmed the same Base counts and payload shape. The
persistent target workspace is `workspace-clinical-master-pilot-v1`; release v1
is abbreviated as `847616e3…` / `release_no=5`, and the idempotent v2
order-only release is abbreviated as `98383567…` / `release_no=6`. Adoption
readback found 31 catalog rows, 31 pending reviews, 14 lab items, and 27 lab
links. The 24 diagnosis records and 12 diagnosis-category links remained
excluded; PR-007's reserved diagnosis schema still contains no pilot diagnosis
rows.

## Prior atomic remote rollback evidence

The first remote publish attempt failed at the existing
`clinical_master_lab_publish_stage_record_type_check` constraint for
`clinical_action`; a repeat produced the same constraint failure. Both
transactions rolled back atomically: release count, `cm.*` master rows, and
the named target workspace remained zero, while the six pre-existing
unrelated stage rows and the protected workspace checksums were unchanged. No
remote retry was made after that failure.

## Remote execution and closeout evidence

The exact remote sequence completed against Supabase project
`qmerxgzrwaaahpkhjqlc` within the approved synthetic boundary:

1. PR #584 merged at
   `886f37738397f70bce36866e04b3aee5d777546d`; migration
   `20260823124500` was applied. Migration history, the named 11-type stage
   constraint, publisher function owner/`prosecdef`/fixed `search_path`/ACL,
   and the six-row stage fingerprint gate all passed.
2. The pre-existing six-row stage semantic SHA remained
   `a278136e25d4fa5e0b3e72a9a6df6c4283d39edaab346ff3bcb376ba5e9483d1`
   through migration, first publish, same-payload retry, and v2 order-only
   publish. Protected baseline fingerprints also remained unchanged.
3. PR #585 merged at `4994d561…`; creator-profile preservation migration
   `20260823140000` preserved the synthetic admin's existing profile values
   while allowing the named workspace-creation RPC to proceed.
4. The locked publisher payload and authenticated adopter completed. Releases
   v1 (`847616e3…`, `release_no=5`) and v2 (`98383567…`, `release_no=6`) read
   back with the expected idempotent/order-only behavior. Persistent
   master/release/workspace/catalog state is retained; immutable publisher rows
   are not rolled back or deleted.
5. One remote PostgreSQL transaction ran with `SET LOCAL ROLE authenticated`,
   exact JWT claims for synthetic admin
   `00000000-0000-4000-8000-000000000001`, and existing public authenticated
   RPCs only. The transaction captured IDs/readback, then explicitly rolled
   back. The CBC order used quantity `1`, `per_order`, and `55000`; three lab
   result rows were entered; fulfillment reached `completed`; billing produced
   exactly one `55000` charge and a retry remained stable. Master/workspace
   lineage read back correctly.
6. Order Set smoke was blocked because the target workspace had zero Order
   Sets; no direct insert workaround was used. Fresh-connection residual rows
   were all `0`; the CBC catalog row remained `pending` with `NULL` price,
   revision `1`, and review `1`; protected fingerprints and the six-row stage
   hash were unchanged.
7. PR #586 merged at `65c7227e…` with migration `20260823142511`. Release
   Check `32646206229` passed and Vercel deployment
   `dpl_BYmnrGkff9Uqwiq9DKTcMmxHo25v` was READY on the production alias.
   Security Advisor was run; pre-existing INFO/WARN findings remain, so this
   closeout does not claim a clean security-advisor result.

Credentialed browser read-only login, target-workspace visibility, and catalog
visibility have not yet been proven. No browser/API write E2E, async, Realtime,
or notification effects are claimed.

## Sol review disposition

Sol's initial review was `REJECT/MUST-FIX 3` for this slice:

- scope the stage revision update to the current release;
- preserve and verify the six pre-existing stage-row semantic fingerprint,
  exact natural-code collision failures, and exact identity/path tuples; and
- make the remote migration handoff, ACL/search-path readback, and prior
  constraint failure evidence explicit in this work item.

All three findings were corrected and the final re-review returned
`APPROVE/MUST-FIX 0`. The later workspace-creator blocker received
`REJECT/MUST-FIX 1`; the additive preservation migration resolved it and Sol's
re-review returned `APPROVE/MUST-FIX 0`. PR #584/#585/#586 delivery and the
synthetic publisher/adopter/operational smoke are complete. Browser read-only
login/workspace/catalog visibility remains a pending, explicitly unclaimed
follow-up.

## Executed operation and bounded smoke

1. The creator-profile preservation migration allowed the existing public
   authenticated workspace-creation RPC to create/reuse only
   `workspace-clinical-master-pilot-v1` without changing the approved admin's
   `email`, `phone`, `display_name`, `initial`, or `status`.
2. The private publisher and private adopter ran with the exact release key and
   locked payload. The public Data API/client was not used as a second
   publisher path.
3. Release, workspace, catalog, review, lab-item, and lineage readback was
   captured: 31 catalog rows, 31 pending reviews, 14 lab items, and 27 lab
   links. Master/release/publisher/adopter/workspace/catalog state is persistent
   approved state.
4. Operational smoke ran in one remote PostgreSQL transaction using
   `SET LOCAL ROLE authenticated`, exact JWT claims for
   `00000000-0000-4000-8000-000000000001` with `role: authenticated`, and
   existing public authenticated RPCs only. IDs and readback were captured,
   then the transaction was explicitly rolled back. Fresh-connection residual
   rows were all `0`; protected/stage hashes were unchanged. No direct inserts
   or workspace-wide cleanup boundary was used.
5. Browser smoke is still pending credentialed read-only login, target-
   workspace visibility, and catalog visibility. No browser/API write E2E or
   async, Realtime, or notification effects are claimed.

## Required preflight gates

Stop before any write if any gate fails:

- The session is not authenticated as the approved synthetic admin, or the
  target workspace is not exactly `workspace-clinical-master-pilot-v1`.
- The current project is not `qmerxgzrwaaahpkhjqlc`.
- Input hashes do not exactly match the locked values above.
- A release with the same key has a different payload/source fingerprint,
  release state, or immutable content.
- A target workspace/catalog collision exists outside the expected synthetic
  target, or the existing workspace is not provably safe to reuse.
- Protected baseline readback differs from its recorded checksum:
  `clair-demo` 19 rows → `b4e3c19350f85c8c2853bb31d2fcd782`; Cheongdam 13 rows →
  `351f0432d4d2544abe4d3d391e21a705`.
- The RPC/API would require direct table writes, any profile change beyond the
  exact allowed RPC behavior above, public client publishing, or deletion of
  immutable publisher rows.

## Expected publish/adoption result

The completed synthetic run proved all of the following; browser read-only
visibility remains a separate pending boundary:

- 83 supported clinical-master records are published.
- 30 pilot orders are available to the adopter.
- 24 diagnosis records and 12 diagnosis-category links remain excluded from
  the private publisher payload.
- The target workspace has exactly 31 catalog rows after adoption: 30 pilot
  orders plus the one expected pre-existing master catalog row.
- Every newly adopted pilot catalog row begins `pending_activation` with a
  `null` price;
  no canonical price or weight-tier value is imported from Airtable.
- Publisher rows are immutable. There is no delete-based publisher rollback.
  A collision or fingerprint mismatch aborts the run before adoption.

## Authenticated operational smoke evidence

The smoke used only synthetic patient/encounter data. It ran in one remote
PostgreSQL transaction with `SET LOCAL ROLE authenticated`, exact JWT claims
for the approved synthetic admin
(`sub: 00000000-0000-4000-8000-000000000001`, `role: authenticated`), and
existing public authenticated RPCs only. No direct inserts were used.

- Individual CBC order: quantity `1`, pricing mode `per_order`, amount `55000`.
- Laboratory flow: three result rows entered and read back.
- Fulfillment: the selected task reached `completed`.
- Billing: exactly one `55000` charge; retry remained stable and did not
  duplicate the charge.
- Lineage: master/workspace lineage and the frozen order/result/billing
  readback were captured.
- Order Set: target count was `0`, so this item was blocked; no direct-insert
  workaround was used.
- The transaction ended with explicit `ROLLBACK`. On a fresh connection,
  residual rows were all `0`; the CBC catalog row remained `pending` with a
  `NULL` price, revision `1`, and review `1`.
- Protected workspace fingerprints and the six-row stage baseline hash were
  unchanged.

Credentialed browser smoke remains pending: authenticated login,
target-workspace visibility, catalog visibility, and critical-browser-error
observation have not yet been proven. No browser/API write E2E, async,
Realtime, or notification effects are claimed.

If a required UI flow is not backed by the existing publisher/adopter contract,
record it as a blocked smoke item. Do not create a direct-insert workaround or
claim the flow passed.

## Rollback and residual-state rule

The publisher/adopter release, workspace, and catalog state is the approved
persistent state. Immutable publisher/release rows are not deleted for rollback.
The operational smoke uses exactly one remote PostgreSQL transaction with
`SET LOCAL ROLE authenticated`, the exact approved-admin JWT claims, and
existing public authenticated RPCs only; it ends with an explicit `ROLLBACK`.
On any collision, mismatch, permission failure, unexpected row count, checksum
drift, or partial failure:

- stop the run;
- retain the exact error, request ID, release/workspace IDs, and created-row
  ledger;
- issue or confirm the explicit transaction `ROLLBACK`; and
- on a fresh connection, re-read the target and protected state to prove zero
  residual operational-smoke rows and unchanged protected/stage hashes.

If rollback or the fresh-connection residual/hash proof cannot be established,
stop and escalate. Never delete by workspace-wide predicate or use a direct
insert workaround. For this run, explicit rollback passed, fresh-connection
residual rows were all `0`, and the protected/stage hashes remained unchanged.

## Evidence and closeout placeholders

These fields record the completed synthetic operational closeout. Browser
read-only login/workspace/catalog visibility remains a pending, explicitly
unclaimed follow-up.

```text
Run timestamp (Asia/Seoul): 2026-08-23 remote evidence packet
Authenticated actor/session evidence: synthetic admin `00000000-0000-4000-8000-000000000001`; `role=authenticated`; browser login pending
Target workspace ID and creation/readback evidence: persistent `workspace-clinical-master-pilot-v1`; creator-profile preservation passed
Input SHA readback: authoring/adapter/payload/migration locks matched this work item
Release ID / release number / source fingerprint: v1 `847616e3…` / `5`; v2 `98383567…` / `6`; locked payload fingerprint matched
Adapter payload SHA readback: `0ff241fd3281a0e7170773dc49f978eea35e8968a79ad8800070955ed16f484e`
Publisher result and idempotency result: 83 supported records; v2 order-only retry stable
Adopter result and catalog counts: 31 catalog rows; 31 pending reviews; 14 lab items; 27 lab links
Synthetic admin semantic-profile pre/post fingerprint (updated_at excluded): unchanged under creator-profile preservation migration
Profile invariant readback (email/phone/display_name/initial/status): unchanged; legacy `initial=SM` preserved
Persistent publisher/adopter state IDs and readback: release v1/v2 and `workspace-clinical-master-pilot-v1` retained as approved state
Operational smoke transaction/role/JWT-claim evidence: one PostgreSQL transaction; `SET LOCAL ROLE authenticated`; exact synthetic-admin claims; public authenticated RPCs only
Operational smoke captured-ID ledger and readback: CBC qty 1/per_order/55000; 3 lab rows; fulfillment `completed`; master/workspace lineage; one billing charge
Explicit ROLLBACK evidence: PASS
Fresh-connection zero-residual query (operational-smoke rows only): all `0`; CBC pending/NULL/revision 1/review 1
Protected baseline and six-row stage hashes after run: unchanged; stage baseline `a278136e25d4fa5e0b3e72a9a6df6c4283d39edaab346ff3bcb376ba5e9483d1`
Browser read-only smoke evidence (login/workspace/catalog/critical errors): pending credentialed read-only login
Browser/API write E2E, async, Realtime, and notification effects: not claimed
Security Advisor: ran; pre-existing INFO/WARN remain; clean result not claimed
Sol review: hotfix and creator-preservation follow-up APPROVE/MUST-FIX 0
Final status: completed; operational synthetic closeout PASS; browser read-only pending
```

## Result report

[비개발자용 Airtable pilot operational closeout report](../../completed/clinical-master/2026-08-23-clinical-master-airtable-pilot-operational-closeout-report.html)

## Explicitly out of scope

- Real or non-synthetic data and real external-user launch.
- Direct Airtable API/PAT integration in the application or CLI.
- Direct writes to private/public tables, unapproved migrations, RLS, user
  profiles, or immutable release/master rows.
- Changes to the publisher/adopter implementation outside the exact migration
  and locked payload handoff above, payload hash substitution, catalog pricing
  authority, Order Set pricing, or runtime UI.
- Deleting or rewriting an immutable publisher release as a rollback strategy.
