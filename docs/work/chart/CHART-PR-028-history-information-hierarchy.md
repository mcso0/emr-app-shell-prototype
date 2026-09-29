---
id: "CHART-PR-028"
status: "in_progress"
area: "chart"
priority: "P0"
target_pr: "Browser comments / diagnosis and chart history information hierarchy"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
dependencies:
  - "CHART-PR-025"
updated: "2026-09-29"
---

# Diagnosis And Chart History Information Hierarchy

## Goal

Give the inline `History / 진단이력` panel and the expanded `차트이력` aside distinct clinical information priorities while preserving the existing live patient-history read model and read-only historical-chart workflow.

## Approved Scope

- Keep the shared `EmrContentHistoryItem` visual primitive unchanged.
- Render inline diagnosis history from prior encounters only, with visit time, primary-first diagnosis summary, additional-diagnosis count, and veterinarian.
- Render the chart-history aside with current and prior encounters, using visit time, visit purpose, encounter status, and veterinarian.
- Remove encounter number and duplicated full date-time metadata from both compact history cards.
- Keep historical selection presentation-only so the active queue encounter and URL remain unchanged and historical charts stay read-only.
- Align diagnosis-history search and empty states with the prior-diagnosis purpose.
- Add focused browser regression coverage for both representations.

## Ownership Decision

- Supabase and the existing chart history route remain the owner of the workspace-scoped patient encounter set.
- `ChartHistoryItem` remains the feature-local adapter from one history record to the shared card primitive.
- The inline panel owns diagnosis-history filtering and diagnosis-focused search.
- The content aside owns visit-history presentation and keeps the full current-plus-prior encounter set.

## Out Of Scope

- Supabase schema, RPC, RLS, permission, or paging changes.
- Editing or reclassifying historical diagnoses.
- Changing encounter lifecycle, queue membership, or the historical read-only guard.
- Heuristically hiding numeric or malformed visit-purpose values.
- Correcting synthetic Cheongdam `visit_purpose` values in the remote database.
- Changing shared history cards used by lab, imaging, or dispensing.

## Done Criteria

1. Inline diagnosis history excludes the active writable encounter and shows prior diagnosis records grouped by date.
2. Diagnosis cards show `HH:mm`, the first server-ordered diagnosis plus `외 N건`, and veterinarian only; they do not show encounter number, duplicated date-time, or status badge.
3. Chart-history aside keeps the current and prior encounter set and shows `HH:mm`, visit purpose, status, and veterinarian only.
4. Missing diagnoses and visit purposes use honest, semantic empty labels instead of falling back to encounter numbers or unrelated clinical fields.
5. Historical selection preserves the current encounter URL/queue and all historical mutation guards.
6. Focused lint, typecheck, server history, browser history, build, docs, secret, and diff checks pass.

## Verification

- `npx eslint src/features/chart/module.tsx tests/chart.spec.ts`
- `npx tsc --noEmit --pretty false`
- `npx playwright test tests/chart-patient-history-server.spec.ts --reporter=line`
- `npx playwright test tests/chart.spec.ts --grep "live patient chart history" --reporter=line`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Verification Result

- PASS — focused and repository-wide ESLint
- PASS — TypeScript `--noEmit`
- PASS — chart patient-history server boundary tests, 5 cases
- PASS — focused browser history regression, including secondary-diagnosis search, current-encounter exclusion, active URL/queue preservation, and historical read-only behavior
- PASS — production build, docs links, secret scan, and diff whitespace check
- BASELINE — the broader chart history grep also reaches an unrelated Assessment locator assertion that fails unchanged on `origin/main`; the rendered diagnosis is present, but the legacy locator expects a retired cell-text attribute

## Closeout

- `docs/completed/chart/2026-08-31-chart-history-information-hierarchy-report.html`

## Remote Boundary

This work changes only client presentation and focused regression coverage. The existing live history RPC, route permission boundary, database rows, and production deployment remain unchanged until separately authorized delivery work.


## 2026-09-08 Approved B Layout Follow-up

This section supersedes the inline diagnosis-summary/date-group presentation above; the completed aside/read-only/data boundary work remains unchanged.

- Approval: user selected the B prototype and explicitly requested implementation, tests, commit/push/PR, merge to origin/main, and production deployment after passing checks.
- Canonical design: [History B specification](../../design/screens/chart/specs/diagnosis-history-list.md).
- Scope: per-encounter flat records with clock/date/time, explicit 차트 보기, up to three Neutral 100 secondary diagnosis badges, inline ghost expand/collapse, one real primary veterinarian, and straight 1px dividers.
- Preserve History title/toolbar, query matching (including hidden diagnoses and veterinarian), active-encounter exclusion, current URL/queue, historical read-only behavior, and all server/DB boundaries.
- Deferred: multiple participant names/+N명 because the actual history projection exposes only one primary veterinarian; no synthetic names or inferred participants enter app code.
- Isolation: clean worktree from origin/main; original checkout and unrelated WIP preserved. No migration, role, permission, provider, or remote data writes.
- Delivery target: production/main for this exact UI scope, using the existing Vercel project/environment configuration without printing values. Stop on failing mandatory checks, preview readiness, scope drift, or smoke failure. Rollback candidate: pre-release origin/main / prior Ready production deployment, to be recorded with the candidate.
- PASS: focused browser History regression, including three-chip disclosure/collapse, Neutral 100 styling, long/empty diagnoses, hidden-diagnosis/veterinarian search, keyboard access, preserved toolbar, active URL/queue, historical read-only mode, and draft autosave before history transition with restoration on return.
- PASS: history server and SOAP autosave coordinator tests (13 cases); SOAP response-loss reconciliation and order autosave conflict/failure browser regressions (3 cases).
- PASS: repository lint, focused lint after test changes, TypeScript, production build, docs links, Korean UX copy, and whitespace checks. Secret scan is required again against staged files before commit.
- Rollback baseline: origin/main `f35f9a347c0ec9dcdc46c95802b55e048780aa7e`; Ready production deployment `dpl_JDT4WYPsMccbUBD855pywjHuUFev`.
- Delivery checks pending: exact-candidate Release Check, Ready Preview, protected PR merge, matching Ready Production, `/login` route probe, and available authenticated read-only History smoke. No production clinical writes are part of smoke.

## 2026-09-08 Compact Figma Follow-up

This supersedes the earlier B-layout visual contract, following the user's reviewed HTML refinements and explicit request to implement, commit, push, create a PR and merge to origin/main.

- Source: Figma `28308:107517` and [compact History specification](../../design/screens/chart/specs/diagnosis-history-list.md).
- Scope: one-line date/diagnosis rows, adaptive hover action reservation, adjacent `+N` tooltip, matched diagnosis priority/bold emphasis, long-name truncation, keyboard/touch access, and scoped toolbar geometry.
- Preserve existing history data and veterinarian search, same-day encounters, aside presentation, active URL/queue, autosave and historical read-only guards. No DB, role, environment or shared-component changes.
- Isolation: branch `codex/history-compact-rows`, clean worktree based on `origin/main` `74dcfe53ab7954a85dccf6390c35edb2d61aaf6d`; original dirty checkout preserved.
- Target: main / production for this UI scope. Existing Vercel project environment only; no secret values printed. Stop on mandatory check failure, unexpected scope, failed Preview or scoped smoke.
- Rollback: pre-release main `74dcfe53ab7954a85dccf6390c35edb2d61aaf6d` or revert this PR after verification.
- PASS: focused History browser regression (date-only rows, adaptive badge/count fit, hover tooltip transfer, long-name tooltip, query emphasis/order, keyboard/coarse-pointer access, same-day and empty records, veterinarian search, historical read-only mode, and draft autosave/restore). Clinical panel collapse regression and five history server/permission cases also pass.
- PASS: staged secret scan, docs links, Korean UX copy and whitespace checks. Full final-candidate lint/type/build and remote Release Check/Preview evidence are recorded in the PR before production approval.
- Expanded panel minimums: History 305px and S/O/Assessment 240px to prevent the action area from overlapping and avoid squeezing adjacent panels; existing narrow-screen 360px tracks and internal scrolling remain.
- Pending: exact-candidate remote checks, Ready Preview, production approval/merge and scoped deployment smoke.

## 2026-09-13 History Navigation And Scroll Follow-up

- Base: `origin/main` `c2c40cdb82705ae4215ae91fff478b3b772ba23c`; isolated branch `codex/chart-history-scroll-badges`.
- Figma evidence: chart-aside group node `27946:58909` uses a 14px outline calendar, and compact History node `28308:107517` preserves the date/diagnosis row and divider hierarchy.
- Left chart-history aside: label the date modes `진료일 기준` and `작성일 기준`, remove only the divider below the mode control, and override the shared history-group calendar through a backward-compatible optional icon slot. The default shared glyph and every other caller remain unchanged.
- Inline History: render the date and calendar with the existing Ghost `Badge`, apply the existing `scroll-fade-y scroll-fade-8` contract to the vertical viewport, and space each row as row → 4px → 1px divider → 4px → next row.
- Preserve selection, date-mode switching, group collapse, `차트 보기`, query ordering, draft-save-before-switch, historical read-only, API, permission, and workspace contracts.
- No new token, dependency, schema, API, permission, provider, or remote-data change. Human visual and usage acceptance remains pending after the integrated deployment.
- PASS: focused History browser regression 2 cases on isolated port 3018, patient-history server/permission contracts 8 cases, TypeScript, focused and repository ESLint (0 errors; 5 pre-existing WP10 script warnings), docs links, secret scan, diff check, and webpack production build. The default Turbopack build was stopped after remaining in its optimization phase without output for more than seven minutes; the integrated exact-candidate Release Check remains the remote build gate.

## 2026-09-17 Figma Date Alignment Follow-up

- Approval: the user reviewed the live History panel against Figma `28382:97577` and approved implementation, commit/push/PR, merge to `origin/main`, and production delivery for this exact visual slice.
- Scope: keep the 12px list inset and 8px row padding; replace only the Ghost date Badge with a plain 12px calendar icon plus date text, use Neutral 500, and set the date-to-diagnosis gap to 20px.
- Preserve diagnosis Badge sizing, adaptive `+N`, hover/focus/touch `차트 보기`, search ordering/emphasis, history navigation, draft-save-before-switch, historical read-only behavior, and every API/permission/workspace boundary.
- Isolation: branch `codex/chart-history-date-alignment`, clean worktree from `origin/main` `b000e0d338d54c1435cac7b806918c2dad045e02`; the original clinical-master checkout and unrelated WIP remain untouched.
- Delivery target: `main` / production using the existing Vercel project configuration without printing env values. No DB, role, permission, schema, provider, or remote-data change.
- Verification requires focused History browser geometry/behavior, focused lint, TypeScript, production build, docs links, secret scan, diff check, exact-candidate Release Check, Ready Preview, merged PR, Ready Production, route probes, and an available authenticated read-only History smoke.
- Stop on mandatory check failure, unexpected scope, failed Preview/Production readiness, or failed scoped smoke. Rollback candidate is pre-release `origin/main` `b000e0d338d54c1435cac7b806918c2dad045e02` and its previous Ready production deployment, recorded before merge.
- PASS locally: isolated-port History browser regression 1 case, patient-history server/permission boundary 8 cases, focused ESLint, TypeScript, docs links, secret scan, diff check, repository lint with 0 errors and 5 pre-existing WP10 script warnings, and the default Turbopack production build. The existing broad NFT trace warning remained non-blocking. Remote exact-candidate and deployment evidence remains the delivery gate.
- Rollback deployment baseline: Ready production `dpl_GwyCFZnVwQPFH9coMUP5WKgWPJzY`, aliased to `https://emr-app-shell-prototype.vercel.app` before this release.

## 2026-09-29 Approved Row Spacing Reduction

- The user approved reducing both spaces around the inline History divider from 4px to 2px, then requested commit, push, PR, and merge to `origin/main` for this scope.
- Keep each row 40px high and the divider 1px high; set row margin-bottom to 5px and divider bottom to -3px for a 45px repeat interval. The current screen specification supersedes the earlier 49px spacing.
- The existing focused History browser regression passed with the updated geometry assertions. Exact-candidate release checks and deployment evidence belong in the PR.
