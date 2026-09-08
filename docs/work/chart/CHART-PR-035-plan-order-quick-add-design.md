---
id: "CHART-PR-035"
type: "Work Item"
title: "Plan/Order Quick Add"
description: "Approved continuous order search implemented locally using existing chart UI and persistence paths."
status: "implemented"
area: "chart"
priority: "P1"
tags: [chart, design, quick-add, prototype]
target_pr: "Refinement PR to main — production delivery approved 2026-09-08"
source_docs:
  - "docs/design/screens/chart/planning/plan-order-quick-add/spec.md"
  - "docs/work/chart/CHART-PR-027-order-draft-removal-persistence.md"
  - "docs/work/chart/CHART-PR-032-plan-order-legacy-columns.md"
dependencies: []
updated: "2026-09-08"
---

# Plan/Order Quick Add

## Goal

Append familiar catalog orders continuously through existing chart components
and persistence, preserving existing rows and entry values.

## Authorization and scope

승욱 requested planning and design on 2026-09-06 and selected an interactive
browser prototype with continuous entry after each addition. Application
implementation was initially deferred until the predecessor completed. On
2026-09-07, that task delivered the user-authorized resume instruction after
PR #711 merged/deployed. The scope now includes local implementation and focused
regression from main merge `2e40894066d4b2e4a67a83d0ccd24539baa78aa5`.
New common/UI components require prior approval; none were created.

- Canonical proposed [interaction plan](../../design/screens/chart/planning/plan-order-quick-add/spec.md).
- Isolated [interactive prototype](../../design/screens/chart/planning/plan-order-quick-add/index.html).
- Korean [review report](../../completed/design/2026-09-06-plan-order-quick-add-design-report.html).
- Preserve existing WIP in the primary checkout; app changes are isolated on
  `codex/plan-order-quick-add`. Preserve API, DB, clinical defaults and lifecycle contracts.
- Temporary sharing of the isolated synthetic prototype directory was explicitly
  authorized for remote review. The 2026-09-07 release instruction below separately
  authorizes commit, push, PR, main merge and application deployment.

## Done criteria

- [x] Compare current screen and official Airtable/Linear patterns.
- [x] Specify base, empty, long, error, duplicate, category and keyboard states.
- [x] Build a local in-memory prototype using existing CLAiR visual conventions.
- [x] Verify core flows and visual geometry in the in-app browser.
- [x] Record implementation boundaries and next-phase acceptance.
- [x] Synchronize all agreed browser amendments into the spec, embedded plan and review report.
- [x] Resume local implementation after the user-authorized predecessor handoff.
- [x] Compose existing UI without creating a new component.
- [x] Complete focused implementation verification.
- [x] User accepted the local result and authorized production delivery on 2026-09-07.

## Implementation boundary

Feature-local composer only; preserve the 25-column table and existing catalog,
draft, permission, set configuration and billing authority. Use append semantics;
the existing full dialog reconciles selections and must not receive only a new
item as a replacement selection. Reconcile latest concurrent clinical-master
changes before the next implementation slice.

Confirmed destination: `상세 오더 검색` opens the same existing
`ChartOrderCatalogDialog` as the upper-right `+ Order` button, carrying the quick
search query. The 2026-09-07 local implementation follows this destination.

## Confirmed review amendments

- Zero total orders: keep existing empty-state catalog entry and hide quick-add.
  Show after first add; hide after last removal. Category-empty is not total-empty.
- Left-align category; use `+ Order 추가` without helper text. Match button,
  input and popover to the category-start / pinned order-name-end geometry.
- Place result count beside `검색 결과` with a 6px gap. Result items contain
  category, name and price only, with no secondary description.
- Before typing: no heading, count or examples; use
  `오더명 또는 청구명을 입력해 주세요.`. Scroll only overflowing result items.
- X closes search; `상세 오더 검색` uses the CDS right chevron and the existing
  catalog dialog destination specified above.

The spec owns detailed acceptance; the embedded Korean plan and report carry
the same reviewed behavior. The following design verification remains historical;
the application implementation record is tracked separately below.

## Design verification — 2026-09-06

`node --check` on the prototype script, browser interaction/visual checks in the
linked plan, docs link validation and scoped diff whitespace check. Live API,
pricing, persistence, concurrent edits and clinical correctness are not claimed.

Result: JavaScript syntax, 12 scoped local artifact links and scoped diff whitespace
checks passed. Repository-wide `npm run docs:check` remains blocked by two
pre-existing references to the absent
`persona-qa-skill-guide.html` under business/customer-discovery in
`_workspace/2026-08-01-002/summary.md` and the WP-01B slice-01 read-boundary
artifact. Those unrelated files were not changed.

Review update: the prototype now hides quick-add when total orders are zero and
uses the existing empty-state `+ Order` catalog entry for the first add. Browser
checks passed for zero → one → zero orders and a category with zero visible rows
while other orders remain. JavaScript syntax validation passed.

Planning-sync verification: all four documents were checked against the review
amendments; the shared prototype’s `기획 보기` displays the updated sections.
Scoped local links, whitespace and script syntax passed. A fresh full
`npm run docs:check` still reports only the two unrelated missing-guide references
listed above.

## Local preview

From the repository root:

```sh
python3 -m http.server 4198 --bind 127.0.0.1 --directory docs/design/screens/chart/planning/plan-order-quick-add
```

The server exposes only this artifact directory on loopback. The prototype does
not persist changes; reset or refresh restores synthetic fixtures.


## Local implementation — 2026-09-07

- Existing chart owners compose Input/Popover/EmrPopoverShell/result options/CDS
  icons; no new React component, dependency, shared component API, backend or migration.
- Total-zero hides quick-add; category-empty retains it. Existing first-add dialog remains.
- Source-key deduplication guards continuous append; existing entry values and delta-save
  behavior are preserved. Missing defaults retain existing input-needed feedback.
- Detailed search transfers query; set cancel/apply restores input. Late set responses
  are invalidated on cancel/reset/scope change, including apply-time preview requests.
- Geometry is measured from live pinned headers and control height. Shared tokens own
  control sizes, spacing and feedback; no prototype pixel-width constant is copied.
- Read-only review identified the late-set-response bug; it was corrected and a gated
  preview/apply regression was added. Read-only re-review found no remaining defect
  in those corrections.

Boundary: local mock/synthetic verification only. No live patient data, remote
persistence, commit, PR, main merge, alias change or production release in this slice.
Predecessor production evidence is separate. Its lab/imaging direct-entry unknown-
patient limitation is outside this quick-add scope. Storybook was unavailable on
localhost:6006, so existing source/stories and browser checks were used.


### Final verification

- Fresh local mock server: **14/14 browser tests passed** (59.4s): nine quick-add
  scenarios plus pinned/scroll geometry, sort, selection totals, historical read-only
  behavior and ETag-conflict preservation.
- Earlier focused run: **27/27 passed**, including 16 delta-save/confirmation
  regression checks, eight quick-add scenarios and four related chart checks.
  Counts overlap with the final run and must not be added together.
- `npx tsc --noEmit`: passed. Scoped ESLint: passed (existing >500KB module
  code-generation notice only). `NEXT_PUBLIC_AUTH_MODE=mock npm run build`: passed.
- `npm run docs:check`: passed, 1018 markdown files. `git diff --check`: passed.
- Visual review of browser screenshots at narrow width confirmed input/popover
  alignment, category/name/price-only options and a visible billing footer.

Reproduction (start with an unused local port; do not reuse a mutated mock server):

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/chart.spec.ts --project=chromium --workers=1 -g 'quick-add|394px pinned|single sort|past charts read-only|ETag conflict|checkboxes update'
```

The reused development server initially failed two existing amount assertions.
A clean baseline checkout at `2e408940` passed both; the final clean-server run
of this change also passed both. The existing mock draft store retains submitted
seed rows separately from merged runtime rows, so repeated delta-save/restore
runs can lose legacy fixture pricing. No production/backend workaround was added.
The temporary baseline worktree was removed after comparison.

Remaining acceptance: representative-user review and authenticated live-data
smoke as part of a separately approved release. This result is local implementation,
not a production delivery or a claim of measured UX improvement.


## Release authorization — 2026-09-07

승욱 requested: `커밋, 푸시, 피알, 오리진-메인에 머지. 배포 승인` after
reviewing the local implementation result. The approved slice is CHART-PR-035:
existing chart UI composition, focused tests and its design/work artifacts.
No additional feature, remote data write, migration or permission change is included.

Target: `codex/plan-order-quick-add` → PR → `main` / Vercel Production.
Verified starting main: `2e40894066d4b2e4a67a83d0ccd24539baa78aa5`.
Delivery still requires exact-candidate Release Check, Ready Preview, local
preflight and exact-head protected squash. PR metadata records the immutable
candidate, check/deployment URLs and final merge evidence.

Production smoke: `/login` plus authenticated read-only Plan/Order quick-search,
query handoff and cancel/focus on an existing synthetic Cheongdam encounter.
Local synthetic tests provide append/save/retry evidence; this release does not
create or modify remote orders. Current PR711 Production deployment
`dpl_Cqaa1NMBn2N5kzAxE1yk2bLqzW4W` is the rollback reference, to be reverified
before merge. This UI-only slice does not change its DB contract.
Stop on changed scope/head, failed checks, non-Ready Preview/Production, source
mismatch or failed scoped smoke. Record failures before any unapproved recovery.


## Refinement — 2026-09-08

After reviewing the revised shared-component prototype, 승욱 approved actual app
implementation: `오케이 좋아. 구현 들어가자`. This refinement is local-only;
the September 7 predecessor release authorization does not authorize its delivery.
Work is isolated on `codex/plan-order-quick-add-refinement` from `f35f9a34`, preserving
the primary checkout and prototype WIP.

The accepted contract now uses a content-width idle button, pinned-column input
with 12px insets, an upper popup with compact `상세 검색`, and toolbar `오더 상세`.
Opening reveals only the table bottom and locks the input position. Dense entry
has a conditional opaque backing that clears the horizontal scrollbar; sparse
entry has no permanent dock. Cancel without additions restores prior table scroll.
Warm catalog reuse remains visible but blocks append until revalidation succeeds;
permission denial clears candidates. Existing scoped persistence, filters, sort,
set configuration, duplicate and save-conflict behavior remain authoritative.

Implementation uses existing Button, Input, EmrPopoverShell, CDS icons and the
existing table. A chart-local geometry hook owns placement and session scroll.
No new shared component API, dependency, backend or permission-policy change.


### Refinement verification

- Sixteen distinct browser scenarios verified across focused runs: eleven quick-add
  scenarios and five related checks (410px pinning/scrollbars, single sort,
  checkbox totals, historical read-only charts and ETag conflict). Repeated runs
  are not added to this count. Continuous addition explicitly verifies bottom scroll.
- The new sparse/dense regression uses synthetic GET-only 1-row and 30-row fixtures:
  idle width, no sparse dock/clearance, dense opening scroll, fixed input during
  row scroll, no page scroll, scrollbar clearance and cancellation restoration pass.
- Warm revalidation verifies retained-but-disabled results, Enter blocked while
  refreshing, failure/retry, and 403 candidate clearing. Existing tests retain
  detailed-query/set return, IME, duplicate, save retry and late-response checks.
- `npx tsc --noEmit --pretty false`, scoped ESLint and
  `NEXT_PUBLIC_AUTH_MODE=mock npm run build`: passed. Build emitted an NFT tracing
  warning through unchanged `next.config.mjs` / docs reader; no build failure.
- Browser screenshot inspected at the narrow default viewport: pinned input and
  upper result popup align; the opaque backing clears the billing footer.
- Initial new sparse assertion used four default rows, which overflow that viewport;
  corrected to an explicit one-row fixture. The prior pinning test assumed a
  permanent composer band; updated that expectation to the approved full viewport.
  ETag regression once failed at checkbox selection, then passed on a fresh-server
  isolated rerun without app changes. No recurrence evidence beyond that rerun.
- Docs references and whitespace checks passed. Local synthetic verification only;
  no remote order writes, commit, push, PR, merge or deployment for this refinement.


## Refinement release authorization — 2026-09-08

승욱 requested `구현 다하면 테스트-검증하고 통과되면 커밋, 푸시, 피알,오리진-메인에 머지. 배포 승인`.
This authorizes delivery of the reviewed refinement after successful checks:
`codex/plan-order-quick-add-refinement` → PR → `main` / Vercel Production.
The exact candidate, Release Check and deployment evidence are recorded in the PR.
Scope is the two chart source files, chart browser regressions and these two owning
docs. The implementation-stage no-delivery statements above are historical.

Baseline `origin/main`: `f35f9a34`. Previous Ready Production deployment:
`dpl_JDT4WYPsMccbUBD855pywjHuUFev` (verified current alias before release).
Smoke: `/login` and authenticated read-only quick search, detail-query handoff,
cancel/focus and input/popup geometry on the existing synthetic Cheongdam encounter.
Do not append, save, confirm or bill remote orders during this smoke. Synthetic local
browser tests own append/save/retry evidence. No migration or permission changes.
Stop on changed candidate/scope, failed exact Release Check/preflight, non-Ready
Preview/Production, deployment-source mismatch or failed scoped smoke. Rollback
reference is the previous Ready deployment; executing rollback requires approval.
