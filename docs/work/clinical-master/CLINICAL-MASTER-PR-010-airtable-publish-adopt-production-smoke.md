---
id: "CLINICAL-MASTER-PR-010"
status: "active"
area: "clinical-master"
priority: "P0"
target_pr: "Airtable publish, synthetic workspace adoption, and authenticated production smoke"
execution_boundary: "production-synthetic-only"
updated: "2026-08-23"
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

The additive creator-profile preservation migration below is the only approved
follow-up. Its local replay passed and Sol returned `APPROVE/MUST-FIX 0`. No
production publish, workspace adoption, or authenticated operational smoke is
claimed yet. These exact files and hashes are not permission to improvise a
different migration or to bypass the authenticated publisher/adopter boundary.
The eventual operation permits a production/demo smoke against synthetic data
only. It does not authorize real patient, guardian, hospital, payment, or
external-provider data or side effects.

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

## Prior atomic remote rollback evidence

The first remote publish attempt failed at the existing
`clinical_master_lab_publish_stage_record_type_check` constraint for
`clinical_action`; a repeat produced the same constraint failure. Both
transactions rolled back atomically: release count, `cm.*` master rows, and
the named target workspace remained zero, while the six pre-existing
unrelated stage rows and the protected workspace checksums were unchanged. No
remote retry was made after that failure.

## Exact remote migration handoff

The publisher hotfix migration is remotely applied. After the reviewed
creator-profile preservation migration is delivered through Git, the remote
operator must execute these remaining steps in order against Supabase project
`qmerxgzrwaaahpkhjqlc`:

1. Read the linked migration list and verify that the publisher hotfix is
   applied and `20260823140000_workspace_creation_creator_profile_preservation.sql`
   is not already applied with a different file. Verify both exact SHAs above
   before applying anything.
2. Read and fingerprint all six pre-existing rows in
   `private.clinical_master_lab_publish_stage` using the complete semantic row
   fields, ordered by `(release_id, master_record_id)`. This fingerprint is a
   hard gate and must remain identical after migration application, the first
   publish, same-payload retry, and the v2 order-only publish. The latest
   read-only remote preflight recorded six rows with exact semantic SHA-256
   `a278136e25d4fa5e0b3e72a9a6df6c4283d39edaab346ff3bcb376ba5e9483d1`; every
   before/after readback must equal this value.
3. Apply only the exact creator-profile preservation migration through the
   approved Supabase migration path. Do not use direct table updates or an
   alternative SQL file.
4. Read back the exact named constraint
   `clinical_master_lab_publish_stage_record_type_check` with
   `pg_get_constraintdef`, and verify the 11 allowed record types.
5. Read back `private.publish_clinical_master_release(jsonb,uuid)` and verify
   its owner, `prosecdef`, exact `search_path` of
   `public, private, master, extensions, pg_catalog`, and ACL: `anon`,
   `authenticated`, and `service_role` must not have execute while the
   private owner remains the only execution boundary.
6. Re-read the six-row stage fingerprint. If it differs, stop and do not
   publish/adopt.
7. Only after all readbacks match, run the exact locked publisher payload and
   authenticated adopter, then repeat the six-row fingerprint gate after
   publish, idempotent retry, and v2. Treat the publisher/adopter release,
   workspace, and catalog rows as the approved persistent state. Run the
   operational smoke in one remote PostgreSQL transaction with `SET LOCAL ROLE
   authenticated` and the exact JWT claims for the approved synthetic admin,
   call existing public authenticated RPCs only, capture IDs/readback, and
   issue an explicit `ROLLBACK`. On a fresh connection, prove zero residual
   rows from the rolled-back operational smoke and unchanged protected/stage
   hashes. Run the authenticated browser smoke only as read-only visibility
   proof; do not perform direct inserts or claim browser/API write E2E.

This is an ordered handoff. It records the completed publisher-hotfix migration
gate but is not evidence that the creator-profile migration, publish/adoption,
or smoke has run. The creator-profile migration/replay/spec evidence passed Sol
re-review; its Git delivery must complete before the remaining remote sequence.

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
re-review returned `APPROVE/MUST-FIX 0`. The follow-up Git delivery and its
remaining remote execution are still separate, unperformed steps.

## Allowed operation

1. Confirm the authenticated session and resolve the existing public
   authenticated workspace-creation RPC. Create or reuse only the named
   synthetic target workspace; do not directly insert workspace or membership
   rows. The RPC must use the existing synthetic admin with the same
   `display_name`, `initial`, and `status`, pass contact arguments as `NULL`
   so `email` and `phone` are preserved, and permit only `updated_at` to
   change. Capture a pre/post semantic-profile fingerprint that excludes
   `updated_at`, and assert that `email`, `phone`, `display_name`, `initial`,
   and `status` are unchanged; no other profile fields may change.
2. Run the private publisher and private adopter only, using the exact release
   key and locked payload. The public Data API/client must not become a second
   publisher path.
3. Verify the release and workspace readback through authenticated server/API
   boundaries. Capture the release ID/number, source fingerprint, adopter
   result, workspace ID, and all created synthetic row IDs.
4. Keep the publisher/adopter release, workspace, and catalog state persistent
   as approved. Run operational smoke in one remote PostgreSQL transaction
   using `SET LOCAL ROLE authenticated`, the exact JWT claims for
   `00000000-0000-4000-8000-000000000001` with `role: authenticated`, and
   existing public authenticated RPCs only. Capture IDs and readback, then
   issue an explicit `ROLLBACK`; on a fresh connection, verify zero residual
   operational-smoke rows and unchanged protected/stage hashes. Never use
   direct inserts or a workspace-wide cleanup boundary.
5. Run browser smoke as authenticated read-only login, target-workspace, and
   catalog visibility checks with no critical browser errors. This does not
   claim browser/API write E2E or async, Realtime, or notification effects.

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

The run must prove all of the following, or remain incomplete:

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

## Authenticated smoke checklist

Use only synthetic patient/encounter data in the target workspace. The
operational smoke is one remote PostgreSQL transaction with `SET LOCAL ROLE
authenticated`, the exact JWT claims for the approved synthetic admin
(`sub: 00000000-0000-4000-8000-000000000001`, `role: authenticated`), and
existing public authenticated RPCs only. Record request/result evidence for
each step; do not use direct inserts:

- Save and confirm an individual pilot order.
- Select an Order Set, change quantity, and confirm the resulting orders where
  the existing workspace contract supplies the Order Set. If the target has no
  Order Set, record this as blocked; do not create one with a direct insert.
- Create the laboratory result item/panel flow and verify the downstream lab
  handoff.
- Confirm treatment/imaging/dispensing task delivery where the selected order
  route requires it.
- Confirm billing amount readback and that repeating the same action does not
  create a duplicate charge.
- Read back the frozen DB snapshot and lineage references for the created
  order/result/billing rows.
- Issue an explicit `ROLLBACK` for the operational-smoke transaction.
- On a fresh connection, verify zero residual rows attributable to the rolled-
  back operational smoke, while retaining the approved persistent
  publisher/adopter state and immutable master/release audit rows.
- Verify the protected baseline checksums and six-row stage fingerprint remain
  unchanged after the run.

Browser smoke is authenticated and read-only: log in, open the target
workspace, verify catalog visibility, and record that no critical browser
errors occurred. It does not claim browser/API write E2E, async effects,
Realtime effects, or notification effects.

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
insert workaround.

## Evidence and closeout placeholders

Complete these fields only after the authenticated run; blank values mean the
work item is not closed:

```text
Run timestamp (Asia/Seoul):
Authenticated actor/session evidence:
Target workspace ID and creation/readback evidence:
Input SHA readback:
Release ID / release number / source fingerprint:
Adapter payload SHA readback:
Publisher result and idempotency result:
Adopter result and catalog counts:
Synthetic admin semantic-profile pre/post fingerprint (updated_at excluded):
Profile invariant readback (email/phone/display_name/initial/status):
Persistent publisher/adopter state IDs and readback:
Operational smoke transaction/role/JWT-claim evidence:
Operational smoke captured-ID ledger and readback:
Explicit ROLLBACK evidence:
Fresh-connection zero-residual query (operational-smoke rows only):
Protected baseline and six-row stage hashes after run:
Browser read-only smoke evidence (login/workspace/catalog/critical errors):
Browser/API write E2E, async, Realtime, and notification effects: not claimed
Sol review:
Final status:
```

## Explicitly out of scope

- Real or non-synthetic data and real external-user launch.
- Direct Airtable API/PAT integration in the application or CLI.
- Direct writes to private/public tables, unapproved migrations, RLS, user
  profiles, or immutable release/master rows.
- Changes to the publisher/adopter implementation outside the exact migration
  and locked payload handoff above, payload hash substitution, catalog pricing
  authority, Order Set pricing, or runtime UI.
- Deleting or rewriting an immutable publisher release as a rollback strategy.
