---
id: "CHART-REFACTOR-PR-001"
type: "Work Item"
title: "Chart order catalog read ownership"
description: "Separate catalog transport and cache ownership from Chart UI while preserving existing authority and save behavior."
status: "human_review"
area: "chart"
priority: "P1"
tags: [chart, frontend, refactor, quick-add]
target_pr: "Separate Draft PR from main; no merge or Production approval"
source_docs:
  - "docs/design/system/ui-refactor-operating-model.md"
  - "docs/design/system/ui-debt-inventory.md"
  - "docs/work/chart/CHART-PR-035-plan-order-quick-add-design.md"
dependencies: []
updated: "2026-10-11"
---

# Chart Order Catalog Read Ownership

## Goal and selection

The existing UI refactor plan prioritizes Chart responsibility boundaries.
Quick Add and the detailed catalog dialog share transport, a 60-second cache,
and pending requests embedded in the large Chart screen module. Own those
reads in one Chart-local client, allowing direct scope/expiry/failure tests
without mounting the whole screen. No shared cache framework is introduced.

## Authorized scope

- Continue the user's project refactoring instruction in one separate PR.
- Initial baseline: main `710b810`; integrate main `247d21d` (PR #960) before
  publication. Keep PR #959 fixed at `f0937b4`.
- Move catalog HTTP loading, success cache and pending-request ownership only.
- Preserve URL, actor headers, no-store, TTL, force refresh and error metadata.
- Keep actor/workspace keys, sequence guards, UI state, saves and confirmations
  in their existing owners. Preserve original and separate UI WIP.
- Commit, push, Draft PR and the approved read-only Release Check are allowed;
  main merge, Production, remote data operations and unrelated PR changes are
  outside scope. Tests use only owned localhost and synthetic APIs.

## Done criteria and verification

- [x] Compare the moved declarations and all remaining Chart statements.
- [x] Pass 11 catalog boundary cases against original and extracted code.
- [x] Pass existing Quick Add browser cases with unchanged assertions.
- [x] Pass 22 save/flush/workspace cases and 6 tab lifecycle cases.
- [x] Complete lint, type, secrets, docs, UX copy and production build checks.
- [x] Prepare the independent Draft PR handoff; retain human acceptance pending.

Review target: [Draft PR for this branch](https://github.com/mcso0/emr-app-shell-prototype/pulls?q=head%3Acodex%2Fchart-catalog-read-boundary-20261011).

## Local result

The 7 moved declarations retain identical bodies. The other 285 non-import
Chart statements are unchanged. Only the existing two read helpers are exported;
UI state, actor/workspace cache keys and response sequence guards stay in Chart.

- Catalog unit cases: 11/11 before and after, using synthetic fetch responses.
  Reproduce with `node node_modules/vitest/vitest.mjs run -c vitest.chart-catalog.config.ts`.
- Existing `chart quick-add` browser cases: 11/11 after extraction, zero retries.
- Existing save/flush/workspace and tab lifecycle browser cases: 28/28.
- Full lint: zero errors, 5 pre-existing script warnings. Typecheck, secrets,
  docs links, Korean UX copy and production build pass. Build retains the
  existing PRD markdown tracing warning.
- Browser checks used an owned localhost, synthetic/mock APIs, no env files,
  a Node network guard and a loopback-only browser proxy. No hosted app smoke.

The final candidate's CI/Preview metadata is recorded in the linked Draft PR;
it does not establish production or real-data acceptance.

## Baseline and independent findings

On unchanged main, catalog characterization passed 11/11. Quick Add initially
passed 10/11; the first case timed out during dev startup and then raced initial
order loading. Preparing the synthetic Chart route before readiness let that
unchanged case pass within its original timeout. No assertion was relaxed.

PR #951 remains relevant to main: confirmation-history VM tests pass 6/13 and
fail 7/13 with missing `confirmationSource`. PR #959 already contains the same
fixture correction. Merging either would make the other's correction redundant.
This separate Chart refactor does not alter either PR or that test fixture.
