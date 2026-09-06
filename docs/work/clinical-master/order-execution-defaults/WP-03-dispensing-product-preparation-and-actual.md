---
type: Work Package
title: Dispensing product identity, planned preparation and actual execution
status: in_progress
updated: 2026-09-06
---

# WP-03 — Dispensing vertical

Parent: [full remediation plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md).
This is an implementation checkpoint, not completion of WP-03 or the full objective.

## Identity decision and source limitations

- Original159 dispensing identities reconcile to108 retained exact-product rows,
  51 explicitly redefined generic rows, and19 newly authored product definitions.
  Consolidating duplicate product choices gives127 successor dispensing rows;
  the original522 denominator becomes490 before other package additions.
- Every original generic key has an explicit replacement ledger. This is authored
  product redefinition, not proof of clinical interchangeability. Historical orders
  and workspace overrides must be preserved when future-selection retirement is
  eventually applied. No retirement or remote application has occurred.
- [Primary reference dossier](./artifacts/wp-03/product-redefinition-research.md)
  distinguishes veterinary products, nine human-reference products, supplements,
  regional formulations, unpublished strengths and contradictory source fields.
- [Deterministic authoring](../../../../scripts/generate-wp03-dispensing-definitions.mjs)
  produces [non-applied definitions](./artifacts/wp-03/dispensing-definitions.non-applied.v2.json).
  All new doses/courses are explicitly synthetic functional fixtures, not veterinary
  prescribing guidance. Source species and authored demo applicability stay separate.
  No drop→mL, strip→g, spray→mL or CFU→mass conversion is invented.

## Quantity and persistence implementation

- Authority V2 adds editable `product_unit` calculation and explicit preparation
  scope (`course_total` or `per_administration`). V1 calculations and confirmed
  snapshots keep their original semantics.
- Theoretical per-administration quantity, theoretical course total, proposed
  practical preparation and saved planned practical quantity are distinct. The
  historical `actualDispense*` RPC keys remain compatibility transport aliases for
  planning only. Chart labels now say `준비 예정량`; V2 indicates whole course vs1 dose.
- A006858 keeps0.25tablet and prepares0.5; A014075 keeps0.25×3×5=3.75 and prepares4.
  The new policy rounds the course once, not each administration.
- Additional audit found25 measured-product metadata rules disagreed with the PR019
  generator; three would change totals (A010086,A010709,A011395). The successor preserves
  all108 dose/frequency/duration/total values and records explicit0.1 nearest-decimal
  preparation policy plus a reconciliation ledger. Capsule counting uses whole units.
- Typed calculation/product authority persists as an atomic reserved default field.
  The preset contract validates it separately; clinical input validation still rejects
  that field. Only the exact catalog row projects it into future snapshots/search.
- SQL and TypeScript agree at decimal increment boundaries. An unresolved manual
  adjustment remains flagged across repeated recalculations until explicitly confirmed.

## Verified locally

-168 focused catalog/domain contracts passed at the calculation checkpoint.
- Four deterministic identity/arithmetic/provenance/reproduction tests passed.
- Real SQL calculator assertions and override→retry→confirm→task/work handoff→billing
  →return/reconfirm pass in a rollback-only local PostgreSQL transaction.4.5 planned
  tablets bill4.5 units, then revised8 units bill8, without a second occurrence multiplier.
- Earlier task planning snapshots and append-only preparation-command history remain
  unchanged. These are preparation facts, not completed actual dispensing.
- Full127 source publication/adoption/storage/search assertions passed in the same
  local rollback-only harness. The source/current/copy contract checks validate the
  typed authority, while patient-detail inputs still reject it.
  No remote apply, commit, deployment or clinical activation is claimed.

## Remaining

- Complete reserved-authority persistence review, all-product adoption assertions,
  Admin editing and authenticated chart readback, not just an injected order snapshot.
- Add explicit actual-result entry through the shared WP-08 append-only task-attempt
  envelope, gate bare completion, and verify amendment/history/variance behavior.
- Complete source retirement + workspace override handling under the final full-manifest
  deployment packet, with scoped active/synthetic/not-clinically-validated policy.
- Repeat combined browser/type/lint/build and full original522 successor audit under WP-09.
