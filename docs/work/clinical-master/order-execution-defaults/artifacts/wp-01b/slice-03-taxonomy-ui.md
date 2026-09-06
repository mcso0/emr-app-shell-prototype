---
title: WP-01B taxonomy UI local checkpoint
status: in_progress
last_updated: 2026-09-06
---

# WP-01B Slice 03 — Taxonomy UI checkpoint

## Outcome and boundary

Local implementation, not deployed. WP-01B and full clinical-default inheritance
remain in progress. No remote mutation, master publication, adoption, commit or push
was performed in this slice. Preserve the existing dirty checkout and unrelated WIP.
The frozen 522-row mapping and separate 13-row legacy reconciliation remain non-applied.

Approved operating model: primary agent integrates; Spark performs bounded read-only
exploration, Luna handles test triage, and Astra high independently reviews boundary
risks. All three delegated reviews completed without source edits. Do not infer that
the parent task's configured model or effort was changed.

## Implemented behavior

- Author subtype and lab family with the explicit vocabulary, constrained by existing
  clinical execution type. Missing fields remain missing; no name/master fallback.
- Taxonomy-only save sends only the two fields, not price or execution defaults.
- New order creation includes the explicitly selected taxonomy pair.
- Master reset requires confirmation and sends only `resetTaxonomyFields`; cancellation
  sends nothing. Read-only users cannot edit/reset. Detached and wildcard-customized
  source handling remains bounded by the existing reset contract.
- Show validated merge-conflict metadata without substituting the proposed values.
  Malformed metadata fails closed. Do not copy conflict metadata into chart defaults.
- Keep explicitly cleared rows in the category-wide and unresolved lists; navigation
  adds explicit vocabulary entries without deriving categories from order data.
- Preserve returned updater/time metadata on save instead of replacing it with local
  placeholder author labels.
- Pin the drawer's opening source snapshot and CAS revision. A same-ID background
  refresh cannot lend a newer revision to stale draft values. Mutation construction
  rejects mismatched item/workspace identity.

## Review finding and resolution

Independent review found that R1 draft inputs could be compared against refreshed
R2 store data, generate a broader patch, and borrow R2's CAS revision. The drawer and
mutation builder now use the pinned source snapshot. Regression coverage combines an
R1 taxonomy edit with R2 price/default changes and verifies a two-field patch with R1
CAS. Foreign-workspace construction is rejected. Reviewer rechecked this fix and
reported the finding resolved; this is not a claim of full security certification.

## Changed sources

- `src/features/hospital-admin/module.tsx`: controls, reset, conflict display, navigation.
- `src/features/hospital-admin/data.ts`: explicit creation/patch mapping and pinned CAS.
- `src/features/hospital-admin/order-taxonomy.ts`: conflict metadata parser.
- `src/features/hospital-admin/server-order-catalog-core.ts`: validated read transport.
- `src/features/hospital-admin/store.ts`: returned metadata preservation.
- `tests/hospital-admin-taxonomy-read.spec.ts`: parser, creation and stale-draft regressions.
- `tests/hospital-admin-taxonomy-ui.spec.ts`: six browser cases with a synthetic catalog API.
- `tests/hospital-admin.spec.ts`: deterministic loading/retry fixtures; no runtime seed fallback.
- Three chart persistence/execution test files: explicit fail-loud result narrowing only.

## Verification

| Check | Result and limit |
| --- | --- |
| `npx playwright test --config playwright.catalog-contract.config.ts --reporter=dot` | 147 passed |
| Chart dispensing/action/draft persistence suites | 45 passed; type-guard changes only |
| Six taxonomy UI cases plus four loading/empty/error/denied cases | 10 passed, Chromium, local Next app with synthetic catalog HTTP responses |
| `npx tsc --noEmit` | Passed |
| Focused ESLint on the 11 touched source/test files | Passed |
| `npm run build` | Passed; NFT tracing warning through `next.config.mjs` → PRD doc reader remains |
| Visual inspection | Desktop 1440×1000 and narrow 390×844; controls visible, narrow viewport reachable, no runtime-error overlay |
| `git diff --check` | Passed |
| `npm run docs:check` | Failed only on two existing references to a missing persona guide, in the old August run summary and Slice 01 record; neither was deleted or fabricated |
| HTML report browser check | Title and next-step anchor present; no page errors or narrow-screen horizontal overflow; desktop/mobile screenshots inspected |

UI command:

```sh
npx playwright test tests/hospital-admin-taxonomy-ui.spec.ts tests/hospital-admin.spec.ts --project chromium --reporter=dot -g 'taxonomy|new order editor sends|explicit clear stays|stale reset keeps|skeleton rows while loading catalog|Order no-data uses|Order read error hides|Order permission denial'
```

The UI test permits only exact mock-session HTTP 401 console messages from
`/api/workspaces` and `/api/workspaces/clair-demo/app-shell/workspace-tabs`.
All other console errors and all page errors fail. This is not a console-clean
authenticated session claim. The catalog route itself is explicitly mocked; UI
reload proves readback through that mock, not a remote DB round trip.

Prior local PostgreSQL rollback evidence remains in
[the storage checkpoint](slice-03-taxonomy-fields-local.md); it was not rerun in this
UI-only slice. Browser screenshots are local temporary files:
`/tmp/wp01b-taxonomy-ui-desktop.png` and `/tmp/wp01b-taxonomy-ui-mobile.png`.
The dev server started for this slice was stopped before the successful production build.

## Remaining gates and next exact task

1. **Slice 04 — Chart trace/parity:** inspect individual candidate eligibility and
   source IDs; prove Admin row → candidate → new draft → confirmed snapshot uses the
   same workspace row and effective defaults. Verify all/dispensing/treatment counts,
   species filters, explicit missing values and no fallback.
2. **Slice 05 — Full acceptance:** all-category counts and core details; use-stop and
   reactivation; real authenticated read/write readback; foreign-workspace invariance.
   Add delayed-response coverage for drawer/workspace switches before claiming full
   asynchronous UI boundary acceptance. Existing source-before-send checks and pinned
   CAS tests do not alone prove response-after-navigation behavior.
3. **Remote preflight:** re-read target identities/revisions, freeze exact targets,
   review migration/publish/adopt payloads and rollback. Apply only within current
   repository authorization rules. Do not publish stale generated SQL or silently
   regenerate the old frozen 522-row proposal after source changes.
4. Resume full WP-02 execution-default inheritance and approved CBC-first LAB work
   only at their documented gates. Do not treat this classification editor as the
   requested lab set/individual-item/result implementation.

Update source status and the work item together after each bounded slice. Never
mark the package done based only on mocked UI or local SQL tests.

## Reports

- [Korean HTML report](../../../../../completed/clinical-master/2026-09-06-wp-01b-taxonomy-ui-report.html)
- Korean report wording reviewed with humanize-korean fast run `2026-09-06-011`.
  Automatic metrics unavailable because the installed script is missing; manual
  meaning/register/numeric-preservation checks passed.
