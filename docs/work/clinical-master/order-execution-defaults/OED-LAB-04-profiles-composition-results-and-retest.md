---
type: Work Item
title: Laboratory profiles, composition, results and atomic retest
status: in_progress
updated: 2026-09-06
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
