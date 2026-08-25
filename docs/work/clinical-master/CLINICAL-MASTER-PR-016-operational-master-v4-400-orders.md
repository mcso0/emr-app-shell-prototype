---
id: "CLINICAL-MASTER-PR-016"
type: "Work Item"
title: "Operational master v4 400-order catalog and demo Order Set manifests"
description: "Extends the synthetic operational catalog to exactly 400 atomic orders, expands laboratory relations, and records the guarded Airtable and Supabase V4 rollout."
status: "completed"
area: "clinical-master"
priority: "P0"
tags: ["clinical-master", "orders", "laboratory", "order-sets", "synthetic-demo"]
target_pr: "Deterministic operational master v4 package"
source_docs:
  - "docs/engineering/data-model/clair-clinical-master-data-target-architecture.md"
  - "docs/engineering/data-model/clair-clinical-master-airtable-authoring-export-contract.md"
  - "docs/product/demo-data/order-catalog-v1.md"
  - "docs/product/demo-data/order-pricing-rules-v1.md"
  - "docs/product/demo-data/lab-test-items-v1.md"
  - "docs/product/demo-data/order-sets-and-templates-v1.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-013-airtable-operational-master-v3.md"
dependencies:
  - "CLINICAL-MASTER-PR-013"
  - "CLINICAL-MASTER-PR-014"
updated: "2026-08-25"
remote_writes: 2
---

# Clinical Master PR-016: Operational master v4 400-order package

## Goal

Build and publish a deterministic, synthetic sales-demo catalog with exactly
400 atomic orders, adopt it into three allowlisted workspaces with workspace
pricing, and create 20 active Order Sets per target workspace.

## Scope

- Preserve every V3 authoring row, stable key, classification path, diagnosis
  row, and relationship unchanged.
- Add exactly 280 atomic orders for a 400-order total across the eleven agreed
  operational areas.
- Expand lab tests from 36 to 72, panels from 10 to 18, panel links from 60 to
  120, and order profiles from 30 to 85.
- Emit and execute deterministic V4 authoring, publisher-adapter, lab-semantics,
  workspace-pricing/adoption, Airtable delta, and Order Set manifests.
- Define 20 non-empty Order Sets for each of the three allowlisted demo
  workspaces, including the agreed fixed/range pricing distribution and three
  one-level nested-set examples.
- Add fail-closed static verification for counts, identity uniqueness,
  reference integrity, source/pricing separation, workspace allowlisting, and
  write-disabled local execution.

## Out Of Scope

- Production application deployment before the exact release candidate gate.
- Real customer, hospital, patient, guardian, staff, or price data.
- Clinical recommendations, medication doses or frequencies, reference ranges,
  controlled-drug content, or claims of veterinary review.
- A new database schema, RPC, API contract, or automatic customer provisioning.
- Changes to the existing Order Set management UI worktree.

## Done When

- The authoring fixture contains 578 Master Records and 578 preferred Korean
  Names, including exactly 400 atomic orders in the agreed category totals.
- The publisher payload contains exactly 554 supported records and no pricing,
  weight-tier, or Order Set authority.
- Laboratory counts are exactly 72 tests, 18 panels, 120 panel links, and 85
  profiles, with every reference resolvable.
- Workspace pricing covers the same 400 master keys with positive integer
  synthetic KRW amounts and targets only the three approved demo workspaces.
- The Airtable manifest is additive, based on the checked-in V3 final readback,
  and remains `writeAllowed: false` with `mutationsPerformed: 0`.
- The Order Set manifest contains 20 templates and 60 workspace create
  operations, uses the current `OrderSetDefinition` contract, and leaves all
  runtime IDs as resolver tokens until a separately approved adoption run.
- Generator drift check, focused tests, typecheck, lint, docs check, and diff
  check pass without any remote mutation.

## Verification

- `node --experimental-strip-types scripts/generate-clinical-master-operational-v4.ts --check`
- `PLAYWRIGHT_BASE_URL=https://emr-app-shell-prototype.vercel.app node_modules/.bin/playwright test tests/clinical-master-operational-v4.spec.ts --project=chromium --reporter=line`
- `node_modules/.bin/tsc --noEmit --pretty false`
- `node_modules/.bin/eslint --max-warnings=0 scripts/generate-clinical-master-operational-v4.ts tests/clinical-master-operational-v4.spec.ts`
- `npm run docs:check`
- `git diff --check`

## Implementation And Verification Status

The deterministic V4 package and the approved Airtable/Supabase rollout are
complete.
It preserves every V3 authoring row and produces the exact requested totals:
578 Master Records/Names, 554 publisher-supported records, 400 atomic orders,
72 lab tests, 18 panels, 120 panel links, 85 order profiles, 20 Order Set
templates, and 60 workspace operation templates.

The Airtable additive upsert and exact readback completed with 578 Master
Records, 578 Names, 13 Classification Paths, 120 Lab Panel Items, 85 Lab Order
Profiles, and 12 Diagnosis Category Links. The existing release draft is now
`cm.release.airtable.operational-master.v4`; no existing row was deleted.

The Order Set package defines the agreed four fixed-price, fourteen
included-order-sum, and two range-price templates. The dog/cat neuter sets pin
the anesthesia-evaluation set, and intensive inpatient monitoring pins the
basic inpatient set. Fixed/range children default to no billing reflection.
Runtime catalog and nested-set identities were resolved only after adoption.
For Cheongdam sets, a paused collision master is replaced by its reviewed,
active workspace-custom equivalent; the paused master and custom row remain
unchanged.

Supabase committed immutable release `61ddac7c-b06e-4ea9-81df-c4fe4c2feb21`
as release number `12`, `recordCount: 554`, `adoptionScope: payload`, source
fingerprint `3bba1b06cd5334d77852b85b0ef0bd2654c0f308e034ea3e191198a12da36e6b`.
The first remote attempt failed inside the transaction on an unavailable
Cheongdam set member and left no V4 release or workspace rows; because release
numbers use a nontransactional sequence it consumed number 11. The corrected
candidate SHA-256 was
`d4635a11fa60739ba34bb97768b10db026dc205d6b3260923ec42e415e7e8bd5`.

| Workspace | Total catalog | V4 payload | Active | Paused | Active V4 sets | Total sets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `workspace-clinical-master-pilot-v1` | 402 | 400 | 400 | 0 | 20 | 20 |
| `workspace-clair-cheongdam` | 413 | 400 | 389 | 11 | 20 | 24 |
| `clair-demo` | 419 | 400 | 400 | 0 | 20 | 20 |

Every workspace has zero pending V4 payload reviews. Each new set distribution
is fixed 4, included-order-sum 14, range 2, with three one-level nested items.
`clair-foreign-demo` remains zero across catalog, lab item/version/link,
workspace update, notification, audit, and Order Set surfaces.

Passed on 2026-08-25:

- generator write and `--check` drift gate
- focused V4 and Phase C Playwright contract tests: 6/6
- local full publish/adopt/price/set rehearsal followed by rollback and four
  zero-residue checks
- TypeScript `--noEmit`
- focused ESLint with zero warnings
- `npm run docs:check` (921 Markdown files)
- `git diff --check`

The wider hospital-admin run exposed only pre-existing shared content-top
expectation drift (`56px` expected versus `44px` current); the Order Set-focused
scenarios passed. A Korean completion report is available at
`docs/completed/clinical-master/2026-08-25-clinical-master-v4-400-orders-report.html`.

## Current Boundary

Airtable and Supabase V4 data work is complete. Application code delivery still
requires PR checks, fixed staging verification, and the repository's exact-SHA
production approval packet before merge/deployment.
