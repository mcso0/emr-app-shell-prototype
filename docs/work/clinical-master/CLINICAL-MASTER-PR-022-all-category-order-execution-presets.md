---
id: "CLINICAL-MASTER-PR-022"
type: "Work Item"
title: "All-category clinical-master order execution presets"
description: "Adds a generic, evidence-labeled execution-preset contract for every clinical-master order category and carries editable defaults through workspace adoption into immutable chart snapshots."
status: "human_review"
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
remote_writes: 0
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
- Starting `origin/main`: `2aa94a1f554256f7203a391412cb2965badabdbe`
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
- All 13 changed specs with the normal Next server: 168/171 PASS. The three
  failures are the pre-existing 56px expected versus 44px current Hospital
  Admin header geometry; all preset/catalog/chart/fulfillment specs pass.
- The three route tests that cannot run without a base URL: 3/3 PASS under the
  normal server configuration.
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
- A hospital-admin membership assigned a permission role without
  `service_catalog:manage` is denied for both `accept_source` and `dismiss` with
  SQLSTATE `42501`; the test transaction rolls back.
- Independent security hard gate: APPROVE, P0/P1 0. This approves the local
  boundary only, not any remote operation.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS with one pre-existing PRD-viewer NFT trace warning.
- `npm run docs:check`: PASS, 955 docs/agent Markdown files.
- `npm run security:secrets`: PASS, 3,893 tracked files.
- `git diff --check`: PASS.

Implementation report:

- [Human-readable HTML report](../../completed/clinical-master/2026-08-31-clinical-master-execution-preset-implementation-report.html)
- [AI-readable Markdown report](../../completed/clinical-master/2026-08-31-clinical-master-execution-preset-implementation-report.md)

## Current Status

The local candidate is implemented and verified through deterministic artifact
checks, focused application tests, production build, security checks, and an
isolated Supabase publish/adopt/retry/customization rehearsal. All 522 current
presets remain synthetic and clinically inactive. The item is handed off for
human review; no remote write, commit, pull request, deployment, or clinical
activation is authorized by this local work item.
