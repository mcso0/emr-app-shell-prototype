---
id: "CLINICAL-MASTER-PR-016"
type: "Work Item"
title: "Operational master v4 400-order catalog and demo Order Set manifests"
description: "Extends the synthetic operational catalog to exactly 400 atomic orders, expands laboratory relations, and prepares local-only adoption, pricing, and 20-set manifests."
status: "human_review"
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
remote_writes: 0
---

# Clinical Master PR-016: Operational master v4 400-order package

## Goal

Build a deterministic, synthetic sales-demo catalog with exactly 400 atomic
orders and prepare the local artifacts required to review a future Airtable
upsert, central publish, three-workspace adoption, workspace pricing, and 20
Order Sets per target workspace.

## Scope

- Preserve every V3 authoring row, stable key, classification path, diagnosis
  row, and relationship unchanged.
- Add exactly 280 atomic orders for a 400-order total across the eleven agreed
  operational areas.
- Expand lab tests from 36 to 72, panels from 10 to 18, panel links from 60 to
  120, and order profiles from 30 to 85.
- Emit deterministic V4 authoring, publisher-adapter, lab-semantics,
  workspace-pricing/adoption, Airtable delta, and Order Set manifests.
- Define 20 non-empty Order Sets for each of the three allowlisted demo
  workspaces, including the agreed fixed/range pricing distribution and three
  one-level nested-set examples.
- Add fail-closed static verification for counts, identity uniqueness,
  reference integrity, source/pricing separation, workspace allowlisting, and
  write-disabled local execution.

## Out Of Scope

- Airtable, remote Supabase, or production deployment writes.
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

The deterministic local V4 package is complete and ready for Human Review.
It preserves every V3 authoring row and produces the exact requested totals:
578 Master Records/Names, 554 publisher-supported records, 400 atomic orders,
72 lab tests, 18 panels, 120 panel links, 85 order profiles, 20 Order Set
templates, and 60 workspace operation templates.

The Airtable candidate is based on the checked-in V3 final readback hash
`e2f931eef25871131de7b78a948b3dfe1892efa9bb2d89ae6a85b30e290cb44a`.
It plans 324 additive Master creates, 324 Name creates, 60 panel links, and 55
profiles. It also retains the already-audited single legacy initial-consultation
identity fork by record ID. The manifest remains `writeAllowed: false` and
`mutationsPerformed: 0`; its rollback journal contains only null placeholders
for future created record IDs.

The Order Set package defines the agreed four fixed-price, fourteen
included-order-sum, and two range-price templates. The dog/cat neuter sets pin
the anesthesia-evaluation set, and intensive inpatient monitoring pins the
basic inpatient set. Fixed/range children default to no billing reflection.
Every runtime catalog item ID, catalog revision, child set ID, and child set
revision stays unresolved until a separately approved post-adoption run.

Passed on 2026-08-25:

- generator write and `--check` drift gate
- focused Playwright static contract tests: 5/5
- TypeScript `--noEmit`
- focused ESLint with zero warnings
- `npm run docs:check` (921 Markdown files)
- `git diff --check`

No Airtable, Supabase, API, browser, deployment, or other remote mutation was
performed. A Korean Human Review report is available at
`docs/completed/clinical-master/2026-08-25-clinical-master-v4-400-orders-report.html`.

## Current Boundary

Only local generation and verification are approved. Any Airtable write,
remote database publish/adoption, production deployment, or browser mutation
requires a fresh read-only preflight and separate explicit approval.
