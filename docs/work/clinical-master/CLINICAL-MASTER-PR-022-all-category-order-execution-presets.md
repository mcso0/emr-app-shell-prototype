---
id: "CLINICAL-MASTER-PR-022"
type: "Work Item"
title: "All-category clinical-master order execution presets"
description: "Adds a generic, evidence-labeled execution-preset contract for every clinical-master order category and carries editable defaults through workspace adoption into immutable chart snapshots."
status: "blocked"
area: "clinical-master"
priority: "P0"
tags: ["clinical-master", "order-presets", "workspace-adoption", "chart-orders", "supabase", "synthetic-demo"]
target_pr: "All-category order execution presets"
source_docs:
  - "docs/engineering/data-model/clair-clinical-master-data-target-architecture.md"
  - "docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md"
  - "docs/engineering/data-model/clair-clinical-master-airtable-authoring-export-contract.md"
  - "docs/engineering/data-model/order-catalog-preset-initialization-contract.md"
  - "docs/product/domain/workspace-order-catalog-platform.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-016-operational-master-v4-400-orders.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-017-evidence-grounded-dispensing-order-master.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-020-workspace-dispensing-preset-management.md"
dependencies: ["CLINICAL-MASTER-PR-016", "CLINICAL-MASTER-PR-017", "CLINICAL-MASTER-PR-020"]
updated: "2026-08-31"
remote_writes: 11
remote_publish_outcome: "rolled_back"
---

# Clinical Master PR-022: All-category order execution presets

## Goal

Give every eligible CLAiR master order a deterministic, evidence-labeled set
of useful execution defaults, copy those defaults into the workspace-owned
catalog, let the hospital edit or pause them, and prefill new chart drafts while
preserving required-field validation and immutable confirmed snapshots.

This work closes the current dispensing-only transport gap. It does not make
synthetic content clinically approved and does not put workspace, clinician,
patient, provider, ward, device, or price authority into the central master.

## Baseline

- Implementation worktree:
  `/Users/iseung-ug/project/emr-app-shell-prototype/.worktrees/clinical-master-execution-presets-20260831`
- Branch: `codex/clinical-master-execution-presets-20260831`
- Current `origin/main` baseline: `00d62a6ea34abf2551a4d0fbf8587bbbb40f8e7f`
- Historical candidate commit used at the completed remote execution gate:
  `1c75aa04079bcdda36e50bfcc9ce0bf4350f4494`
- Current-main feature commit: `b465608c`.
- The separately approved performance-candidate branch-head was
  `4549c6fd36b9347e05361b0d63a610ac33dfd10f`, rebased exactly 3 commits ahead /
  0 behind that `origin/main` baseline at execution time. The later approval
  and remote rollback evidence are recorded below.
- The primary checkout and the prior audit worktree are excluded from edits,
  staging, reset, stash, checkout, and cleanup.
- Live read-only evidence found 510 published normal master orders: 108 complete
  dispensing presets, 86 partial laboratory profiles, 316 without typed
  execution presets, and no dedicated system-examination category.
- Existing confirmed encounter orders and snapshots are immutable and must not
  be backfilled or rewritten.

## Field Ownership Contract

Default resolution order is:

1. encounter/runtime context;
2. workspace override or workspace-owned operational default;
3. CLAiR master execution preset;
4. chart schema default;
5. explicit user input when the value cannot be derived safely.

Master-owned examples include the intended specimen, test/panel, collection
instruction, imaging body region and position, treatment method/site, and
non-authoritative operational instructions. Workspace-owned examples include
external providers, wards/cages, devices, local instructions, availability, and
price. Runtime-owned examples include the responsible clinician and current
patient/encounter context.

## Scope

- Add an additive private-master execution-preset projection with revision,
  schema version, default inputs, provenance, review state, hashes, release
  lineage, current-row uniqueness, and fail-closed validation.
- Keep normalized type-specific clinical profiles as the owning structured
  source; the generic JSON projection is a runtime transport, not the sole
  clinical authority.
- Add a generic workspace `default_detail_inputs` field and source/customization
  fingerprint support while retaining a dispensing compatibility fallback.
- Extend deterministic authoring/generation validation for laboratory, imaging,
  consultation/preventive, treatment/surgery/dental, hospitalization,
  miscellaneous/emergency/certificate, remaining dispensing, and a new
  dedicated system-examination slice.
- Preserve workspace edit, whole-row review, CAS, audit, pause/use-stop,
  workspace isolation, and price authority.
- Prefill chart drafts through the generic field, retain complete required-field
  validation, and freeze the effective values on confirmation.
- Provide focused contract tests, local migration/replay verification,
  all-category completeness checks, and an exact external-application packet.

## Out Of Scope

- Real patient, guardian, staff, hospital, identity, payment, or prescription
  data.
- Named-veterinarian clinical approval or real-patient activation of synthetic
  content.
- Canonical CLAiR prices or silent overwrite of hospital-owned price/settings.
- Retrospective mutation of confirmed chart orders, fulfillment, or billing.
- Broad reset or replacement of customized workspace rows.
- Controlled-substance workflow, external provider/device integration, or real
  email/SMS/PACS/accounting effects.
- Airtable, remote Supabase, GitHub PR/merge, Vercel deployment, or production
  activation without a separately approved exact-target action packet.

## Data And Safety Invariants

- Every eligible active master order has exactly one current compiled execution
  preset after the dataset phase.
- Unknown detail keys, incompatible clinical-order types, malformed values,
  missing static required defaults, stale source revisions, and hash drift fail
  closed before publish/adoption.
- Dynamic required fields declare their resolver source instead of receiving a
  fake master identifier.
- Machine unit codes and display labels remain distinct; method/analyzer-
  dependent values stay unknown or review-gated rather than guessed.
- Synthetic values remain visibly `synthetic_unreviewed`; technical adoption is
  not clinical review.
- Customized workspace rows are not silently partially merged. Any one-time
  demo backfill may set only the new execution-default field for an exact
  allowlist and must preserve names, price, availability, revision history, and
  existing confirmed/draft encounter orders.
- `clair-foreign-demo` remains an unchanged negative control.
- Master tables are not exposed to client roles. Public workspace storage uses
  RLS plus explicit grants; privileged functions use fixed `search_path`,
  explicit execute grants, actor/workspace permission checks, CAS, and audit.

## Implementation Sequence

1. Freeze the field matrix, generic interfaces, compatibility behavior, and
   category coverage contract.
2. Implement the additive master/workspace schema and rollback-only replay.
3. Implement deterministic all-category authoring and compiled-preset output.
4. Extend publisher, source projection, adopter, workspace edit/review, and
   chart-search snapshots.
5. Extend chart draft resolution and immutable confirmation snapshots.
6. Run focused tests, typecheck, lint, build, docs checks, secret scan, local DB
   replay, and independent security/correctness review.
7. Stop at the external-action gate with exact SQL/data hashes, target counts,
   before/after/retry fingerprints, rollback/forward-fix, and stop conditions.

## Done Criteria

- The current 510 eligible master orders plus the explicitly added
  system-examination identities pass exact one-current-preset coverage.
- All category-specific required static defaults are populated; each dynamic
  required field has a tested resolver source.
- A copied workspace row exposes editable defaults and `사용 중지`; master
  updates preserve customized rows and create the required review state.
- Adding representative orders for every clinical type prefills the effective
  details. Complete rows can be confirmed; deleting a required value blocks
  confirmation with a visible invalid state.
- Later master/workspace changes do not mutate confirmed order, fulfillment, or
  billing snapshots.
- Publish/adopt/retry is deterministic and idempotent; target workspaces match
  exact counts and semantic fingerprints; the foreign workspace is unchanged.
- Direct client master access, cross-workspace reads/writes, unauthorized
  mutation, stale CAS, and internal RPC bypass are denied.
- Focused tests, TypeScript, lint, build, docs check, secret scan, diff check,
  local migration apply/reapply, rollback-only replay, and independent boundary
  review pass.

## External Approval Gate

Before any persistent Airtable, Supabase, GitHub, deployment, or activation
action, present:

- exact target environment and allowlisted workspace IDs;
- candidate commit, migration, dataset, and rendered SQL SHA-256 values;
- expected inserted/updated/reviewed row counts;
- before/after/retry semantic fingerprints and foreign-control proof;
- clinical-review status and non-clinical exposure boundary;
- rollback or forward-fix plan and explicit stop conditions.

## Verification

- Deterministic fixture checks: 510 existing presets, 12 system-exam orders,
  and 522-order final release PASS.
- Final release artifact: 689 records, SHA-256
  `1eeb5035d70d5f28035df49d1d32c3689ffe79a4bb28062e5606256802572e0c`.
- Existing-order preset artifact: 510 entries, SHA-256
  `02c4ad67463545fa502e263fd7681b203b3e866702d23cbf364edbfe6276f6c0`.
- Frozen live 510-row lineage SHA-256:
  `b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb`.
- All 14 changed specs with the normal Next server: 179/182 PASS. The three
  failures are the pre-existing 56px expected versus 44px current Hospital
  Admin header geometry; all preset/catalog/chart/fulfillment specs pass.
- The chart draft route server suite is 20/20 PASS and the four current-main
  billing/retry-focused chart checks are 4/4 PASS under isolated normal server
  ports.
- Final clinical-master/security focused specs after the permission fix: 52/52
  PASS.
- Isolated local DB: 522 current presets; 522 catalog rows in each of the three
  allowlisted workspaces; empty defaults 0; retry mutation counts 0; foreign
  workspace rows 0; all presets `synthetic_unreviewed` and
  `clinicalUseAllowed=false`.
- Isolated local customization/re-adoption: edited defaults and paused state
  preserved; review row created; stale CAS `40001`; immutable preset mutation
  `55000`.
- Six PR-022 migrations apply and reapply; compatibility-backfill audit remains
  exactly 324; required-default/resolver and preset-identity negative gates
  reject invalid inputs.
- Performance migration static spec 6/6 and related publisher regression
  24/24 PASS;
  exact rollback-only publish returns 689 records with preset version/current
  `630/522`, manifest 689, review events 1070, unsafe/lineage mismatch 0, and
  restores the `108/108` baseline with no release or manifest residue.
- The expanded rehearsal checks actual function owner/security-definer/search
  path/ACL state, old/new validator equivalence across all nine supported
  clinical order types, negative clinical gates, digest-marker absent/wrong/
  exact paths, and GUC/data residue after normal, retry, and timeout rollback.
  On an ownership-preserving clone with the current-main billing, realtime,
  and SOAP migrations applied in chronological order around PR-022, the latest
  run returned marker-absent fallback 3.581s, wrong-digest fallback 2.927s,
  first publish 2.888s, retry 1.296s, and no residue after the forced 1.5s
  timeout (`57014`).
- A fresh chronological clone and a current-main-first incremental clone both
  apply the final compatibility migration and converge on function-definition
  MD5 `a85f22b4af1e2cb1e5262b3ce0993a30`, owner `supabase_admin`,
  `SECURITY DEFINER`, empty `search_path`, authenticated-only public execute,
  and no authenticated execute on any retained base writer. Both rollback-only
  compatibility rehearsals pass, including individual and set-child clinician
  normalization, nullable-primary-veterinarian handling, billing summary,
  Realtime, and update-only nonexistent-encounter denial with `42501`.
- The consultation runtime compatibility migration static/rehearsal contract
  spec is 7/7 PASS; the independent resolver-and-route replay is 27/27 PASS.
- Buffer-cold exact-baseline benchmark: old publisher
  `6.122/5.703/5.646s` (median 5.703s), candidate
  `3.477/3.082/3.136s` (median 3.136s), candidate 3/3 under 60s.
- A hospital-admin membership assigned a permission role without
  `service_catalog:manage` is denied for both `accept_source` and `dismiss` with
  SQLSTATE `42501`; the test transaction rolls back.
- Independent security hard gate before the current-main rebase: feature
  candidate APPROVE with P0/P1 0; performance candidate LOCAL APPROVE with
  High/Medium/Low 0/0/0 and related publisher spec independent replay 24/24
  PASS. The post-rebase review then found two Medium issues in the final
  consultation writer composition and permission ordering. Migration
  `20260831120100` closes both, and the final exact-file review is
  High/Medium/Low 0/0/0, LOCAL APPROVE. No verdict approves a remote operation.
- Performance candidate working-tree SHA packet: migration
  `aaa9795baf380e16d24973e344e5e3be2bf2b6696ef614326520cc8885b0a495`,
  exact payload file
  `834812eaea2afb2fafb93ea3b0a23efb5bc7df54ea3ac8977983683523c4e278`,
  rollback-only rehearsal
  `746afecaea71f157ecf4f250d9c0b343d7536cf2364c78bf432522d12aacbb03`,
  static spec
  `a21815e3d662b10430432d61f67550d989dd37533046708f467db5b97a2f2427`.
  These hashes remained identical after the current-main rebase. They are file
  content hashes, not a PR/merge SHA or remote approval.
- Final consultation compatibility packet: migration
  `6a952519fb7c762d1f5da931b166b7605ddbb54deff58a567ef98091f44f788f`,
  rollback-only rehearsal
  `744673aef64ff67dae7239a21fb781f8a487d49dedc0951283e9e66fe2083fb7`,
  and static spec
  `92e04acdb2f7268654f5df29c680d2bfff92cf98d9fafaadb75717a6d1af6f6e`.
- Approved remote performance-candidate packet on commit
  `4549c6fd36b9347e05361b0d63a610ac33dfd10f`: performance and compatibility
  migrations applied as history `20260831122808` / `20260831122838`; post-apply
  function owner/config/ACL, public writer MD5, `510/108/108`, audit `324`, and
  frozen stable-key/lineage SHA gates PASS.
- Exact payload SHA
  `834812eaea2afb2fafb93ea3b0a23efb5bc7df54ea3ac8977983683523c4e278`
  was verified as 1,982,060 bytes, 689 records / 522 orders, with unsafe preset
  count 0. Its single remote publisher call timed out at 60 seconds with
  SQLSTATE `57014`.
- Immediate authoritative readback at 2026-08-31 12:37:27 UTC: target release
  0, manifest 0, execution preset version/current `108/108`, master orders 510,
  active publisher/adopter backends 0. Independent boundary verdict:
  **COMPLETE ROLLBACK / SAFE STOP**. Adoption was not called.
- Post-apply read-only advisors returned security `INFO 91 / WARN 187` and
  performance `INFO 402 / WARN 13`; no clean-advisor claim is made. Master
  release/current-preset covering-index notices are investigation inputs, not
  a proven timeout cause.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS with one pre-existing PRD-viewer NFT trace warning.
- `npm run docs:check`: PASS.
- `npm run security:secrets`: PASS.
- `git diff --check`: PASS.

Implementation report:

- [Human-readable HTML report](../../completed/clinical-master/2026-08-31-clinical-master-execution-preset-implementation-report.html)
- [AI-readable Markdown report](../../completed/clinical-master/2026-08-31-clinical-master-execution-preset-implementation-report.md)

## Current Status

The implementation and local verification remain complete. The first approved
remote packet applied the six PR-022 foundation migrations; both earlier
publisher calls returned Cloudflare 524 and were proven fully rolled back.

A separate approval then authorized the exact performance candidate at commit
`4549c6fd36b9347e05361b0d63a610ac33dfd10f`. Project
`qmerxgzrwaaahpkhjqlc` now has the performance and consultation runtime
compatibility migrations applied as history `20260831122808` and
`20260831122838`. All post-apply security and frozen baseline gates passed.
The exact 689/522 payload was called once under a 60-second statement timeout
and returned SQLSTATE `57014`. Immediate readback showed target release 0,
manifest 0, preset version/current `108/108`, master orders 510, and no active
publisher/adopter backend, proving complete rollback. Adoption was not called.

Status remains **BLOCKED / NEW PERFORMANCE CANDIDATE APPROVAL REQUIRED**. The
two new migrations remain applied, but publisher replay, workspace adoption,
migration/history repair, deletion, staging/pg_cron workaround, push/PR/merge,
deployment, and clinical activation are prohibited. Local 3-second timing did
not resolve the remote 60-second behavior. The next attempt requires read-only
remote bottleneck analysis, a different candidate, new exact SHA packet,
isolated verification, independent security review, and separate approval.
