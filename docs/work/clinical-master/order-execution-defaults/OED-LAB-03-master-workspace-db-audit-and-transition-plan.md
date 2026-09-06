---
id: "CLINICAL-MASTER-OED-LAB-03"
type: "Work Item"
title: "CBC Master Workspace DB Audit and Transition Plan"
description: "Audit the current code and read-only database against the CBC candidate; plan safe changes without applying them."
status: "done"
area: "clinical-master"
priority: "P0"
tags: [clinical-master, laboratory, schema-audit, transition-plan]
dependencies: [CLINICAL-MASTER-OED-LAB-02]
updated: "2026-09-06"
---

# OED-LAB-03: Master, Workspace and DB Audit

## Goal and boundary

Map the verified non-applied CBC candidate to actual code and schema before
implementation. Read-only inspection only: no migration application, master
publish, adoption, workspace changes or runtime fallback. Do not infer remote
capabilities from fixtures. Missing remote access is explicitly unverified.

## Required inputs

- [LAB-00 requirements](./OED-LAB-00-requirements-and-research-contract.md)
- [LAB-02 execution record](./OED-LAB-02-cbc-functional-specimen-research.md)
- [CBC report](./artifacts/oed-lab-02/report-source.md)
- [Candidate manifest](./artifacts/oed-lab-02/artifact-manifest.v1.json)
- [Workflow and field-level audit targets](./artifacts/oed-lab-02/cbc-workflow-and-screen-contract.v1.json)
- [Source exceptions](./artifacts/oed-lab-02/source-ledger-and-gaps.v1.json)
- [WP-01B persisted read parity](./WP-01B-persisted-admin-chart-read-parity.md)

## Audit sequence

1. Freeze local HEAD, touched paths and candidate content hashes. Preserve WIP.
2. Trace master order, result-definition and nested-set tables/publishers.
3. Trace workspace adoption, explicit profile selection, per-field overrides and
   Hospital Admin/chart catalog reads. Locate every mock/fallback path.
4. Trace chart expansion/confirmation snapshots, execution attempts, specimens,
   typed results, interpretation and previous-request/result links.
5. Inspect available remote schema metadata and scoped synthetic rows read-only.
   Never expose credentials or unrelated patient/customer data. Record local and
   remote evidence separately; use the Supabase skill if that access is available.
6. Produce current-to-target field matrix, smallest CBC-first implementation
   slices, ID preservation/backfill choices, verification and rollback boundaries.

## Completion criteria

Every LAB-02 audit target has an owning table/module, observed support or gap,
evidence location and proposed change. Existing generic nested sets must not be
mistaken for end-to-end lab support. WBC-only retest must preserve old results,
and supporting measurements must not become silent extra orders/charges.
All 21 new order-ID candidates and 19 new result-definition candidates are
reconciled against actual IDs before application. Old RETIC percentage identity
is preserved. No numerical clinical profile, price or remote state is invented.
Deliver an agent-facing MD matrix and readable Korean HTML, with migration,
backfill and rollback plans (not executed). Explicitly identify remaining product
decisions, especially prices, partial billing and actual equipment registration.

## Handoff

Next implementation is a separate CBC-first slice, coordinated with WP-01B/WP-02.
Research `done` does not mean runtime implemented or product decisions approved.
Read-only audit completed on 2026-09-06. `done` means evidence and transition
plan delivered, not implementation, clinical validation or approval to publish.

## Results and artifacts

- [Agent-facing audit, nine-target matrix and transition plan](./artifacts/oed-lab-03/audit-and-transition-plan.md)
- [Korean report source](./artifacts/oed-lab-03/report-source.ko.md)
- [Human HTML report](../../../completed/clinical-master/2026-09-06-oed-lab-03-cbc-schema-audit-report.html)
- [Remote SELECT evidence](./artifacts/oed-lab-03/remote-evidence.v1.json)
- [All 26 candidate identity decisions](./artifacts/oed-lab-03/id-reconciliation.v1.json)
- [Source and artifact fingerprints](./artifacts/oed-lab-03/artifact-manifest.v1.json)

Remote schema and six synthetic Cheongdam CBC catalog rows confirm the scoped
gaps: CBC has three members; canonical result functions force null range and
not_judged; existing defaults/versions are present. New result profiles cannot
be applied as JSON data alone. Existing generic nested sets support one nested
level, not unrestricted recursion. The CBC candidate root is an existing master
order, not a generic set; preserve identity with an explicit composition bridge.

21 proposed order keys and 19 proposed test keys are absent remotely. Preserve
the existing RETIC percentage identity and old revisions. Field-wise inheritance
is not complete: the inspected preset sync skips customized catalogs.

## Verification and limits

- Three audit tests pass: ID/remote evidence reconciliation, source/artifact hashes
  and all nine targets, report links/navigation/desktop/mobile/no-network rendering.
- Combined replay with the previous LAB-02 candidate/report suite: 14/14 pass.
- Representative desktop and mobile screenshots visually inspected.
- Global `npm run docs:check` still fails on the pre-existing unrelated reference
  `_workspace/2026-08-01-002/summary.md` to the persona guide; not modified here.
- No app or migration source edits, local/remote DB writes, patient/result-row
  reads, commits, pushes, publishing or workspace adoption.
- No authenticated browser proof, role-based RLS replay or deployed-app SHA proof.
- Bounded read-only explorers mapped catalog and result paths. Parent inspected
  remote metadata and integrated findings. Korean companion used humanize-korean
  fast run 2026-09-06-003; missing metrics helper handled with manual rules.

## Immediate next

Implement existing WP-01B first: persisted-only Admin/chart reads, honest errors,
no runtime order/value fallback and category-specific core summaries. Then use
the CBC-first slices in the audit plan for profiles/composition, WP-02 adoption,
result snapshots/interpretation and single-item retest. Do not implement all
86 laboratory orders in one change.
