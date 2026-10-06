---
type: Work Item
title: Laboratory profiles, composition, results and atomic retest
status: in_progress
updated: 2026-10-06
---

# Boundary and sequence

Implement the approved laboratory track within the full defaults-remediation
objective: CBC first, then every original86 lab order by assay family. Research
artifacts are inputs only, never runtime fallback imports. Preserve existing
master identities, V1 result snapshots, patient results, catalog price/availability
overrides and unrelated WIP. No real device integration or clinical validation.

1. Add immutable result-profile revisions and explicit workspace/manual-device
   and request selections. No missing-profile fallback or latest-version choice.
2. Extend frozen definition V2, authoritative input validation/interpretation,
   serialization and immutable definition guards together. Preserve V1 behavior.
3. Publish/adopt CBC identities and composition with bounded nested expansion;
   retain root identity and distinguish requested atomic outputs from support data.
4. Implement atomic retest as a new order/result with exact prior row/write revision,
   specimen decision, reason and explicit billing policy. Old result remains intact.
5. Prove CBC browser/database behavior, then author/verify all86 original identities
   and their explicit additions. Reconcile the full522 ledger under WP09.

Existing quantity/profile research does not approve new billing prices or infer
actual analyzer ownership. Parent-only set billing and nonbillable retest were
asked as product choices; keep actual selection explicit while implementation
continues. Do not hide an unanswered choice in an automatic runtime default.

## Current local integration checkpoint

### Lab entry warning implementation, 2026-10-06

This slice starts from verified Production Ready SHA
`9a16bf0d3e29cff17bdf1ea900db88f8ecea9deb` in the isolated
`lab-result-entry-warnings` worktree. The dirty primary checkout is preserved.
승욱 approved local implementation of the agreed laboratory input behavior.
Imaging is deferred until its manual workflow/device boundary is resolved;
dispensing and treatment are excluded. No remote data write or deployment is
included in this checkpoint.

- Frozen V2 rules drive numeric, coded/select and narrative controls. Coded
  results include direct input. Wrong numeric format, unknown code, configured
  input/display-range breaches and explicitly unsupported qualifiers retain raw
  input and show a warning with `not_judged`; semantic warnings do not block the
  sheet save or an independent row. Empty input remains null. Structural size,
  metadata and profile errors still fail validation.
- Removed the additional-result menu, result-state selector and device-flag
  editor. A `측정 불가` column disables the row's value control and stores null,
  `exact`, no active flag. Unchecking restores the previous value, qualifier and
  historical flag only while that result's local draft survives. No restoration
  caption is shown. Findings remain the place for manually recorded device notes.
- New numeric choices default to `=`. Optional frozen `allowedQualifiers`
  permissions expose `<`/`>` only when explicitly authored. Existing frozen
  qualifiers remain readable. No hospital-specific qualifier permissions or
  clinical/analyzer/critical limits are inferred or populated.
- The new migration extends warning states and updates the authoritative
  evaluator. Raw whitespace is retained; decimal comparisons preserve precision.
  The completion guard normalizes `not_performed` so raw whitespace cannot bypass
  its existing exclusion. Required warned/unavailable rows still prevent task
  completion; no completion-policy expansion is approved here.
- V1 result storage stays compatible. Without a frozen rule, no choices, limits
  or semantic warnings are fabricated. Corrupt/missing V2 rules surface a read
  error. Airtable type/unit/decimal reconciliation, profile publication/adoption
  and actual per-order permissions/limits remain separate pending work. This
  checkpoint does not claim every master order has been corrected.

Validation and delivery boundary:

- Focused contract/autosave tests pass (31). The mocked persisted V2 browser
  flow passes: raw warnings, independent row save, reload, measurement restore,
  historical metadata and atomic retest revision. Local SQL apply/reapply tests
  the real baseline evaluator/row trigger/completion guard and rolls back inside
  an owned network-isolated Postgres container.
- Actual input component interaction tests pass (9). Six additional mocked
  browser cases pass for in-flight revisions, delayed readback, retries, conflict
  preservation, read-only access and keyboard focus. TypeScript/build, touched
  source lint and documentation links pass. Build retains the existing PRD
  document-reader tracing warning. Synthetic table captures are saved under
  `.omo/evidence/lab-result-entry-warnings/`; the local component preview uses
  Storybook port 6007, not the old HTML prototype or Production.
- The SQL fixture uses reduced tables. It does not establish full deployed
  RPC/RLS/audit/CAS behavior. The source contract and autosave tests cover the
  existing unchanged transport/security boundary; authenticated production
  acceptance is still required before claiming delivery.
- Apply the forward migration before activating the new application version.
  Never remove warning-state support while warned rows exist. An application
  rollback must preserve their readability and raw data. No rollback or forward
  migration has been run remotely.

### Delivery preparation, 2026-10-06

승욱 requested commit, push, PR and `origin/main` merge after implementation.
The feature was rebased without conflicts onto verified `origin/main`
`cd660768d456b68454c737b2d2b39cff3dfce480`. Its Ready Production deployment is
`dpl_JDGYz64mh6YfMpqvqFVcDhx7viSx`. Exact-candidate Production and remote DB
approval gates remain required by the release runbook. No remote apply, merge
or Production activation is recorded here.

Remote preflight confirms the connected Supabase project `clair-emr-staging`
has no new warning evaluator/token/state support. Validator, evaluator and
completion-guard function bodies match the local baseline exactly; the optional
qualifier insertion anchor occurs once. Candidate migration SHA-256:
`eb96bd23584ed8d5f3db436e45c2ebc1c33e65a2a276ff05cb3f6e7ac15feaab`.
The proposed remote action is only this migration, first rollback-only rehearsal
and unchanged-baseline verification, then persistent apply and readback. It
changes shared V2 validation/state support across the project, not a per-order
master definition. No existing result backfill, clinical threshold authoring,
profile publication, RLS, membership or provider operation is included.

Post-apply checks will verify the function/constraint contract and pure synthetic
numeric/coded/permission/completion-token examples. Post-merge smoke is `/login`
plus authenticated read-only laboratory result/control inspection in the
prepared Cheongdam workspace. No real patient write, synthetic order creation,
result overwrite or attachment operation is implicitly approved by this packet.
If authenticated access is unavailable, report that limit; do not substitute an
HTTP probe for authenticated acceptance.

After any warned value exists, the old Production deployment is not a safe
application rollback. Keep the forward DB contract and warning-aware reader.
A concrete local recovery candidate is `625cf25e29666a4c1dcda5a3736ca4297010e32b`
on `codex/lab-result-entry-readonly-recovery`: it disables result-value and
measurement controls while preserving raw warnings and existing note/file
permissions. Its mocked warning-result read/reload/no-POST case and build pass.
It is prepared, not deployed or pushed. The equivalent
[recovery patch](./artifacts/lab-result-entry-warnings/read-only-recovery.patch)
has SHA-256 `4a0c931946b006bf32fd365e6ff9218f4f0c9d84f799e8f989c31bceca335f22`
and passes an apply check against the feature candidate. This is a UI recovery
candidate, not a server-wide write shutdown or canonical permission change.
Any recovery deployment needs its own reviewed candidate and authorization.

Stop before merge for missing DB approval/apply proof, changed candidate,
non-Ready Preview, failed/unknown exact Release Check, failed required checks,
missing smoke/compatible recovery evidence or unapproved data actions. Record
PR, final SHA and remote checks in the PR rather than inventing completed release
facts in this source checkpoint.

- All86 original identities are reconciled with90 exact atomic orders,35 versioned
  compositions (including nested groups) and24 immutable result profiles. The34
  additional atomic IDs are explicit additions, not renamed originals.
- Existing assay/specimen identities and typed vocabulary are preserved; changed
  numeric/coded/text definitions use versioned acceptance. Profile selection is
  explicit by workspace/device/species and pinned per request/result.
- Workspace normal-range overrides are immutable versions scoped to catalog/base
  profile. CAS/exact retry/explicit null clear are enforced. New requests pin the
  chosen version; prior requests and frozen results never read the current override.
- Admin UI explicitly applies a composition version and chosen billing policy;
  nested source paths remain on the flattened atomic leaves. No recursive task
  engine or implicit latest profile/device selection was introduced.
- Removed invented collection/receipt/performance metadata derived from queue
  state. Missing actual facts remain absent rather than copied from timestamps.
- Combined catalog contracts203, publisher compatibility22 and Admin/chart/imaging
  mocked browser14 pass. Local SQL covers all86 publish/adopt/retry, composition
  application, explicit range edit/clear and unchanged old result/foreign controls.
  TypeScript and build pass. See [full candidate](./WP-09-complete-candidate-and-rollout.md).
- Still required: approved exact target/config choices, persistent application and
  authenticated deployed result/retest/history proof. Functional fixture bands
  are not clinical intervals. No remote write or device integration is claimed.

## Earlier CBC checkpoint (superseded by the integration above)

- Added standalone runtime profile-rule contract with numeric/coded/text typing,
  explicit missing/instrument/qualifier/flag states and inclusive interval judgment.
  Empty is not zero; documented display bounds are not analytical/critical limits.
- Six immutable CBC profiles and26 atomic order identities are generated with
  explicit existing-ID reconciliation. Local publishing pins the exact release,
  profile revision, test definition and workspace/device binding.
- Admin configuration and chart selection APIs/UI have no first/latest/default
  device fallback. DB insert/update and confirmation checks enforce the same
  workspace, patient species, catalog binding and registered device model.
- Canonical results are attached after task creation. The prepared-workspace
  result screen reads the actual persisted entry with both order/work-item
  selectors; it no longer manufactures result rows from a current catalog.
- Typed numeric/coded/text results, qualifiers, instrument-no-result and device
  flags are transported end to end. Server judgment is checked against the
  frozen rule; blank is not zero and coded abnormal is not numeric high.
- Atomic retest creates a new unconfirmed order, records exact prior row/write
  revision and immutable origin chain, and preserves the original result. Reason,
  specimen decision/reference, billing policy and configured profile are explicit.
  Creating a request does not claim that sampling or actual performance occurred.
- Local SQL rollback: six-profile publish/retry, CBC WBC adoption/configuration,
  missing-selection rejection, direct-write and confirmed-pin guards, V2 freeze,
  empty/interval/flag states, required completion, exact old-write retry and
  independent retest draft/confirmation pass. No prior result is overwritten.
-193 focused contracts and two mocked browser cases pass: true-empty handling and
  CBC read/type/save/reload plus explicit atomic retest creation. These do not
  establish authenticated production behavior.
- CBC nested composition, versioned acceptance of changed workspace test kinds,
  workspace-authored profile overrides, all86 expansion, actual lab performance
  metadata and broader adversarial/remote acceptance remain in progress.
