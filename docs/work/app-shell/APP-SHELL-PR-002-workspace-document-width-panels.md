---
id: APP-SHELL-PR-002
status: human_review
area: app-shell
priority: P1
target_pr: User-approved five-module document alignment follow-up to main and Production
updated: 2026-10-03
source_docs:
  - docs/design/system/workspace-document-width-contract.md
  - docs/design/system/ux-ui-research-before-implementation.md
---

# Workspace document width and internal panels

## Goal and approved scope

Implement the researched width toggle and internal bilateral panels, beginning with 임상검사. Approval is recorded in the chat on 2026-09-29. Existing primary-checkout WIP is preserved; implementation uses the attached `workspace-width-panels` worktree from HEAD.

Next adoption approved on 2026-09-30: 승욱, “오케이 다음 단계로 넘어가보자.” Continue with 진료/차트 using the researched 1040px cap, existing history panel, full-width action toolbar, and contained SOAP/Order scrolling. No new reference feature or clinical workflow change.

Third adoption approved on 2026-09-30: 승욱, “오케이 이어 가자.” Continue with 조제/처치 using the researched 1120px cap, existing execution history, full-width instruction actions, and unchanged execution-detail drawer. Existing status/persistence/table contracts remain in scope for regression verification only.

Fourth adoption approved on 2026-09-30: 승욱, “오케이 다음 고.” Continue with 영상 report using the researched 1280px cap, existing history and summary/attachments inside the work surface, and full-width report actions. Actual PACS/viewer integration is absent and remains out of scope; no diagnostic-image width limitation or new viewer is introduced.

Fifth adoption approved on 2026-09-30: 승욱, “다음 수납 진행하자고.” Continue with 수납 using the researched 1120px cap, existing guardian ledger and payment summary, full-width title/assignment/summary controls, and unchanged invoice/payment APIs and nested preflight dialogs. Verification uses only loopback synthetic fixtures.

Duplicate check: APP-SHELL-PR-001 is workspace tabs; DESIGN-SYSTEM-PR-081 explicitly excluded outer slot changes. Neither covers this scope.

## Scope

Shared opt-in document layout, measured conditional width button, workspace/module session preference, 180ms/reduced-motion behavior, full-width toolbar, internal Lab receipt placement, narrow modal fallback, independent outer profile. Second adoption: 차트 width/history and existing panel/table constraints. Third adoption: 조제/처치 width/history and existing execution table/drawer constraints. Fourth adoption: 영상 report width/history/summary and stable Order detail table data. Fifth adoption: 수납 width/history/payment-summary placement and unchanged financial contracts.

## Out of scope

Real PACS/viewer integration, new reference features, API/DB/RLS/data writes, matching, result save/confirmation logic, clinical policy, real payment/provider actions, remote data writes. PR preparation is authorized below; main/Production remains subject to the exact-candidate release gate.

## Done criteria

Requested layouts work with synthetic inputs preserved; accessibility/focus and nested receipt confirmation work; non-opt-in layouts retain their contract; focused tests and lint/type/build pass; contract and evidence are updated.

## Dependencies and verification

Existing Emr panels and Base UI dialog are reused. No new dependency. Link the [research report](../../completed/design/2026-09-29-workspace-width-proposal/report.html) and [canonical contract](../../design/system/workspace-document-width-contract.md).

## Implementation and verification

Shared `WorkspaceDocumentLayout` measures unrestricted center space, preserves the document subtree and preferences, and reuses existing feature panels with Base UI focus handling. Lab moves its title/actions into the full-width toolbar and places the receipt inside the work surface. Opt-in layout-only URL updates use Next-integrated native history to preserve fields and avoid server-navigation races; other modules retain their routing.

The closing dialog portal can remain mounted briefly; a closed panel is explicitly hidden immediately. Outer profile availability does not enable an unavailable inner receipt panel.

- Final production-build Chromium run: **18 passed (13.9s)** — 9 document-layout tests, 5 shared right-panel tests and 4 selected Lab regressions. Tests use synthetic fixtures and intercepted synthetic live-shaped/empty responses, not authenticated production data.
- Profile containment assertion added after visual review: **1 passed (1.3s)**. The screenshot waits for the existing outer-profile layout transition to settle before capture.
- `npx tsc --noEmit --pretty false --incremental false`: passed; final build TypeScript also passed.
- Changed-file ESLint: passed, including the new layout, shell/store/registry/header changes and relevant test files.
- `NEXT_PUBLIC_AUTH_MODE=mock npm run build -- --webpack`: passed. Webpack is used for this isolated worktree because the reused node_modules symlink is outside Turbopack's filesystem root. No package/config change was made.
- `npm run docs:check`, `git diff --check`, tracked secret scan and changed/untracked text credential-pattern scan: passed.
- Visual review: captured and inspected 1920 narrow/bilateral panels, 1440 modal and 2560 profile coexistence. Width matrix covers 1366/1440/1600/1920/2560 and a 960 CSS-px zoom-equivalent layout. This is not a native browser zoom or real clinical usability test.

Local preview runs on loopback port 4310 with explicit mock auth. No environment credentials were copied. In-app browser opening was not confirmed because the app tool did not return; automated Chromium verification and local screenshots completed.

[Korean implementation report](../../completed/app-shell/2026-09-29-workspace-document-width-panels-report.html). Source baseline is `f564a493`; no commit, push, merge or deployment was performed. The active primary checkout's WIP is untouched.

## Review and next adoption

Human Review covers all five implemented adoptions: Lab, chart, dispensing, imaging report and billing. 수납 retains its existing financial actions and nested preflight; no real provider action or new payment feature is introduced. Actual PACS/viewer integration remains a separate feature boundary. Any delivery uses the project release gates separately. Keep the worktree and local preview available for this review.

Generated `.omo/` screenshot evidence from the existing Lab test is local validation output; exclude it from any future implementation staging.

## Chart adoption — 2026-09-30

The approved second adoption uses the researched 1040px cap. `ChartActionBar` moves into the full-width toolbar with the shared width toggle; the existing history panel uses the shared inline/modal presentation. Optional right-panel metadata supports this real history-only caller without inventing a reference feature. Outer patient/guardian profiles retain their slot.

The clinical group uses its actual container width for existing 360px minimum panel tracks and contained horizontal scrolling. Wide mode preserves the original panel proportions. SOAP/Assessment/History collapse, Order columns/pinning/density/selection, consultation actions, clinical persistence and permissions are preserved. Width-toggle focus returns to history when no right trigger exists. Inline panel roots ignore Escape intended for unrelated central controls; modal dismissal and focus return remain intact.

Verification on the final explicit-mock production build:

- Chromium coverage: **94 cases validated** — all 73 chart tests, 6 new chart-layout tests, 1 Order-density test, 9 shared document-layout tests and 5 right-panel tests. The full run passed 93 cases in 3.4m; its sole failure was the new SOAP-scroll probe selecting a descendant instead of the labeled scroll owner. After correcting that test selector, the focused case passed in 1.3s. No implementation change followed the successful final build.
- Inputs, Content mount identity, Order selection/columns/pinning/horizontal scroll, SOAP vertical scroll, per-module preference, width-button visibility/focus, modal Tab/Escape, inline search dismissal, profile containment and reduced motion verified. Layout matrix: 1366/1440/1600/1920/2560 and 960 CSS px. This remains a zoom-equivalent layout check, not native browser zoom or clinical usability research.
- Existing Figma panel widths/row geometry and Assessment screenshot remain verified in wide mode. The wide-document snapshot replaces the obsolete content snapshot because the action bar now lives outside the document. Functional flows explicitly use a viewport supporting inline history; narrow/modal cases retain explicit viewport coverage.
- Changed-file ESLint, final build TypeScript and `NEXT_PUBLIC_AUTH_MODE=mock npm run build -- --webpack`: passed. Webpack still accommodates the existing dependency symlink; no package/config change.
- `npm run docs:check`, `git diff --check`, tracked secret scan and changed/untracked text credential-pattern scan: passed. The docs checker was rerun after a concurrent browser runner removed temporary failure artifacts during an earlier scan.
- Captured and inspected 1920 narrow/wide, 1440 history modal and 2560 history/profile screenshots. All data is synthetic; tests intercept synthetic live-shaped responses or use local mock route behavior. The layout input probe stubs SOAP autosave to avoid modifying the server fixture. Authenticated production or remote Supabase verification is not claimed.

[Korean chart implementation report](../../completed/app-shell/2026-09-30-chart-document-width-report.html). Local preview remains on loopback port 4310. No commit, push, merge, deployment, real-data or remote DB action was performed. The primary checkout WIP remains untouched. The next 조제/처치 adoption is recorded below.

## Dispensing / treatment adoption — 2026-09-30

The approved third adoption uses the researched 1120px cap. Existing instruction title, history trigger, PDF/print controls and lifecycle actions move into the full-width toolbar with the shared width toggle. Instruction information, filters and execution tables remain in the document. Existing execution history uses the shared inline/modal presentation; the existing order-detail drawer retains its workspace drawer slot. No reference feature or persistence implementation is added.

Verification on the final explicit-mock production build:

- Final focused run: **40 passed (28.7s)** — 7 new dispensing-layout tests, all 8 dispensing-fulfillment regressions, 6 chart-layout tests, 9 shared Lab document-layout tests, 5 right-panel tests and 5 chart/dispensing order-contract cases. The initial 15-case run passed 14; the existing standalone fulfillment test opened history at 1280px and then attempted a background action. It now verifies the history modal, dismisses it with Escape, and continues claim/unassign/start. No implementation change followed the successful build.
- Instruction Content mount identity, row selection, table columns/compact density, horizontal/vertical scroll, 조제 and 처치 titles, per-module preference, hidden-trigger focus restoration, history group state, modal Tab/Escape, inline Escape and outer-profile containment verified. Matrix: 1366/1440/1600/1920/2560 and 960 CSS px with reduced motion. The 960px case is zoom-equivalent, not native browser zoom.
- Existing drawer dose input retains `0.75 ml` across width/history/viewport changes. This is a local synthetic UI input-retention probe; it does not claim new prescription persistence or clinically valid dosing. Existing fulfillment tests intercept synthetic live-shaped responses and verify lifecycle request/revision/readback, immutable reviewed facts, empty queue, permission denial and failed mutation behavior.
- Final changed-file ESLint, TypeScript and `NEXT_PUBLIC_AUTH_MODE=mock npm run build -- --webpack`: passed. The dependency symlink still requires Webpack; no package/config/environment credentials changed.
- Inspected 1920 narrow/wide, 1440 history modal/detail drawer and 2560 history/profile screenshots. Legacy synthetic instruction screenshots intentionally show the existing empty-fulfillment warning; the standalone synthetic live-shaped flow is covered separately. No authenticated production or remote Supabase verification is claimed.
- `npm run docs:check`, `git diff --check`, tracked secret scan and changed/untracked text credential scan: passed. Report images, interactive width comparison and 1440px containment also passed. The report open request was queued by the app; opening is not claimed as confirmed.

[Korean dispensing implementation report](../../completed/app-shell/2026-09-30-dispensing-document-width-report.html). Local preview remains on loopback port 4310. No commit, push, merge, deployment, real-data or remote DB action was performed. The primary checkout WIP remains untouched. The next 영상 report adoption is recorded below.

## Imaging report adoption — 2026-09-30

The approved fourth adoption uses the researched 1280px report cap. Existing title, PACS placeholder and reading-status actions move into the full-width toolbar with width and summary triggers. Existing 280px history and 336px summary/comment/attachments use the shared work-surface inline/modal presentation. Patient context stays above the toolbar; the outer patient profile remains independent. Summary has an explicit close control and returns focus to its toolbar trigger.

The current module has a PACS placeholder and attachment cards, not an integrated diagnostic-image viewer. No new viewer, image cap, upload or reading/comment persistence is introduced. Future diagnostic-image viewing must use unrestricted available space rather than the report cap.

The first browser run exposed an existing unstable `data: [detail]` array in `ImagingOrderDetailTable`: a parent rerender caused TanStack row-model resets to repeatedly update table state and block the browser event queue. Memoizing the one-row array fixes width/panel/density interactions without changing columns, values or density defaults. Real pointer and keyboard actions verify the fix; the existing reading-status test now uses real clicks instead of dispatching synthetic events past interaction checks.

Verification on the final explicit-mock production build:

- Final focused Chromium run: **46 passed (37.9s)** — 8 new imaging-layout tests, all 11 Lab/imaging regressions, 5 right-panel tests, 9 shared Lab-layout tests, 6 chart-layout tests and 7 dispensing-layout tests.
- First 45-case attempt was stopped after 13 passes, 2 imaging click timeouts and 1 interrupted case to diagnose the table loop. After the source fix and rebuild, the intermediate 46-case run passed 42; four test expectations needed updates: dismiss the density radio menu before background interaction, use the inspected navigation label `영상검사`, dismiss the default summary modal before asserting central live-shaped content, and use still-non-opt-in billing for the unchanged-layout check. All four pass in the final full run. No implementation change followed the successful final build.
- Inputs: main reading/impression, mounted Content identity, summary comment DOM identity across inline/modal changes, history group state, table columns/comfortable default and compact density retention, vertical/horizontal scrolling. Panel checks include toolbar alignment, latest-panel ownership, modal Tab/Escape/focus return, hidden-width-trigger focus and per-module preference.
- Layout matrix: 1366/1440/1600/1920/2560 and 960 CSS px; reduced motion and simultaneous history/summary/outer profile containment. This is a zoom-equivalent check, not native browser zoom or clinical usability research.
- Existing imaging reading-status, attachment list, empty queue and synthetic live-shaped fulfillment adoption remain verified. Tests use existing local fixtures or intercepted synthetic responses. Actual PACS zoom/comparison, authenticated production, real data and remote Supabase validation are not claimed.
- Final `NEXT_PUBLIC_AUTH_MODE=mock npm run build -- --webpack`, standalone TypeScript and changed-file ESLint: passed. Webpack accommodates the existing dependency symlink; no package/config or environment credentials changed. A temporary Webpack dev server was used for diagnosis and stopped before the final build.
- Captured and inspected 1920 narrow/wide/bilateral, 1440 summary modal and 2560 bilateral/profile screenshots. The Korean report preserves the distinction between report layout and absent PACS integration.
- `npm run docs:check`, `git diff --check`, tracked secret scan and changed/untracked text credential scan: passed. Report images, interactive width comparison and 1440px containment passed. The app queued the report-open request; opening is not claimed as confirmed.

[Korean imaging report](../../completed/app-shell/2026-09-30-imaging-document-width-report.html). Local preview remains on loopback port 4310. No commit, push, merge, deployment, real-data or remote DB action was performed. The primary checkout WIP remains untouched. Next adoption is 수납, beginning with amount/table/payment-action constraints.

## Fifth adoption: 수납

User approval on 2026-09-30: “다음 수납 진행하자고.” The fifth adoption uses the researched 1120px document cap. Billing title, assignment, width and summary controls render in the full-width toolbar. Existing guardian ledger (280px) and payment summary (336px) render below it; the outer profile keeps its own slot. Invoice information, selected checkout, line quantities and invoice status actions stay in the document. Payment actions retain their existing fixed 105px summary footer and nested financial preflight.

The actual-space threshold, module/session preference, stable content subtree, modal fallback, focus/Escape, reduced-motion and contained scrolling reuse the shared opt-in contract. No new payment feature, data/API/DB/RLS policy, dependency, or provider integration is added.

Inspection found that fresh checkout ID arrays triggered repeated prepare effects during render, repeatedly recreating quantity cells. The two existing checkout preparation effects now memoize IDs by their serialized value and refresh on amount/status changes as well as selection, method, memo and explicit retry. Width-only changes produce no extra checkout requests. No amount formula or API behavior changed.

Verification on the final production mock build:

- 82-case Chromium run: **81 passed (51.2s)**; the remaining case initially expected the edited table total to equal the independent mock checkout snapshot. The assertion was corrected to verify both existing boundaries and re-run: **1 passed (2.2s)**. Together all **82 distinct cases passed** on the same production source/build. Counts: billing layout 8; existing billing UI 13; checkout/invoice-line/payment/security contracts 26; shared right-panel 5; Lab layout 9; chart layout 6; dispensing layout 7; imaging layout 8.
- New billing coverage checks width and table columns, controlled quantity, row/group amount, assignment, no extra layout-only checkout request, bilateral placement, visible fixed payment footer, memo/adjustment retention across presentation changes, ledger filters/selection, modal focus/Escape, nested unpaid preflight cancellation and reason retention, scroll, actual-space matrix and profile coexistence.
- Existing UI and server cases verify status actions, unpaid reason enforcement, error recovery, permissions and workspace boundaries, server-owned prices, amount-tampering rejection, and exclusion of completed/cancelled invoices. Mock IDs and loopback synthetic fixtures only; no real external payment.
- Visual review: inspected 1920 narrow/wide/bilateral, 1440 summary modal and 2560 profile coexistence. Tests cover 1366/1440/1600/1920/2560 plus 960 CSS-px zoom-equivalent layout. This is not native browser zoom or real financial usability acceptance.
- Final production build `NEXT_PUBLIC_AUTH_MODE=mock npm run build -- --webpack`: passed (11.2s compile, 17.0s TypeScript). Changed-file ESLint passed; final standalone TypeScript passed.

Existing synthetic financial boundary: CBC quantity 2 produces 156,500원 in the edited table/group, while the separate mock guardian-checkout API returns its fixed 121,500원 amount snapshot, which the checkout summary prioritizes. This existing mock boundary is explicitly asserted and reported; no live amount freshness or real payment correctness is claimed. Memo/adjustment retention concerns presentation changes only; summary close/reopen keeps its existing component lifecycle without new draft persistence.

[Korean billing implementation report](../../completed/app-shell/2026-09-30-billing-document-width-report.html). All five planned local adoptions are ready for Human Review. Separate clinical/financial usability acceptance and release gates remain. No commit, push, merge, alias change or deployment. Preserve the worktree and loopback preview for review.

Final billing closeout checks: changed-file ESLint, standalone TypeScript, 972-doc link check, `git diff --check`, tracked 4009-file secret scan and changed/untracked 39-text-file scan passed. Billing HTML was checked directly in Chromium: all four displayed images plus the alternate wide image loaded, the comparison control worked, and the 1440px report had no page overflow. In-app open request returned queued, so a visibly opened app tab is not claimed.


## Latest main integration and release preparation — 2026-09-30

승욱 requested “ㅇ오케이 1,2,3 가자.” after the proposed final five-module review, PR preparation and release flow. This authorizes scoped review, commit, push, PR Preview and Production preparation. Exact candidate Production approval is pending under the current release skill; the work item records scope and does not independently grant remote authorization.

Integration uses a new attached `workspace-width-release` worktree and `codex/workspace-document-width-release` branch from `0bca112ab30a88ca46edcd8a0ef76c8280534ea8`. Both the initial pilot and primary WIP remain untouched. The latest main contains 195 intervening commits relative to the pilot; conflicts were resolved by retaining current module source and porting only the approved layout behavior. Preserve the latest profile-panel restoration, author/link/output controls, actual fulfillment execution, live/demo guards and financial contracts. Imaging's current memoized table-data implementation is retained.

Current Ready Production rollback evidence: deployment `dpl_3TjPK3UnQ2mRYkouDePuXJKYTnxN`, source `0bca112ab30a88ca46edcd8a0ef76c8280534ea8`, target Production, Ready. Its verified source matches the integration base. The active flow uses PR Preview directly to main; no staging branch or alias is created.

The loopback release preview uses port 4312 with explicit mock auth and installed dependencies. The original loopback 4310 preview is preserved. No env credentials are copied; no API/DB/RLS/payment implementation changes are included. Old pilot verification above describes its original source and does not establish current release verification.

[Final Korean integration report](../../completed/app-shell/2026-09-30-workspace-document-width-release-report.html).

### Integrated local verification

- **119 distinct focused cases passed** on the final explicit-mock production build: **114 / 114** in the focused module/server regression run and **5 / 5** current chart geometry/visual/pinning/collapse cases. Final visual review removed duplicate vertical padding from the common toolbar while retaining each existing title row and chart toolbar geometry. The final build passed (12.8s compile / 28.0s TypeScript), followed by both successful runs; no production source changed after that build. Lab capture waits for initial requests and tooltip dismissal.
- New width/panel cases cover all five modules, retained inputs/mount/selection/scroll, actual-space button visibility, 1366/1440/1600/1920/2560/960 CSS px, reduced motion, nested receipt/financial dialogs and independent outer profile. Existing live-shaped execution, result persistence, financial server/permission/amount and right-panel regressions are included.
- Broad chart audit is **not green**: initial candidate 67 passed / 34 failed; unchanged Production-source main 69 passed / 32 failed. **31 failures match by title**. The baseline's old visual reference also fails. The three additional candidate layout assertions (toolbar inset, container overflow and the renewed visual case) are resolved and pass the final focused check. The new visual fixture freezes synthetic GETs so earlier mock persistence tests do not change the screenshot. Existing broad failures are not hidden or repaired by changing unrelated clinical behavior.
- The existing dispensing context/vital-editor test also fails on unchanged main because its synthetic fixture does not supply current vital settings. Its source is retained unchanged; this specific test is explicitly excluded from the focused release command. No vital permission or dialog behavior is weakened.
- Full lint: 0 errors, 5 pre-existing warnings in WP10 scripts; final changed-test lint and standalone TypeScript pass. UX copy check passes. Final main-based Turbopack build passes; the inherited NFT warning in the docs reader remains.

[Machine-readable validation and baseline failure inventory](../../completed/app-shell/2026-09-30-workspace-document-width-validation.json). Broad audit failures remain a documented residual test/fixture backlog and are not presented as a successful full-suite result. Human clinical/financial acceptance and authenticated Preview/Production interaction evidence are separate from these loopback synthetic checks.

Final candidate preparation checks: docs checker passed **1057** docs/agent Markdown files; tracked secret scanner passed **4555** staged/tracked files; staged diff whitespace check passed. The final integration HTML loaded all ten module/mode images and all comparison controls at 1440px with no document overflow. All five latest-main module screenshots and the renewed chart pixel baseline were inspected. Loopback synthetic server state was reset for settled visual evidence; the temporary unchanged-main comparison checkout was removed after recording its results. `.omo/` remains excluded from staging.

The broad audit above preceded the final toolbar spacing adjustment. Both unchanged-main and candidate audit harnesses use the same 1920px default functional viewport with each test's explicit viewport overrides retained. Runtime source at the comparison checkout is unchanged main. The final spacing change was reverified through all 119 focused cases; the full chart suite is still not claimed green.

### Current main refresh before exact candidate

While the PR was prepared, main advanced to `252bfb25af3d6dd62dce3f62ef29400de6a1df46` through #880 (reception calendar drawer overlay). Rebase retained its reception-only outer-panel exclusion together with this feature's opt-in inner-panel exclusion. The earlier `0bca112a` broad-audit evidence remains explicitly scoped to its recorded source. The rebased build passed (9.7s compile / 18.1s TypeScript). Rebase validation passed **53 distinct cases**: 38 document layouts, five shared right-panel cases, five reception overlay cases and five chart geometry/visual/pinning/collapse cases. The first 48-case run passed 46; two old reception-drawer assertions were updated to target the #880 overlay, then all three targeted right-panel cases plus the five chart cases passed (8 / 8). Both updates preserve the new main behavior. Changed-file lint, standalone TypeScript, docs (1057) and secret checks (4556) pass. The previously inspected settled synthetic screenshots remain unchanged.

Updated Ready Production rollback candidate: `dpl_EJjPQWVeYbFFU2s9VSuk9HayCT7C`, source `252bfb25af3d6dd62dce3f62ef29400de6a1df46`, URL `https://emr-app-shell-prototype-eowjrlp7e-mcso0s-projects.vercel.app`. Vercel metadata confirms Ready Production with that source. The first Release Check for the superseded candidate was cancelled; only the refreshed exact head is eligible for approval.


### Profile integration refresh before final approval

Main advanced again through #882 to `6f70a24583bde034b84ed4f913e614d9cf988463` (shared patient/guardian/staff profile UI). The clean rebase retains its profile enter/exit and reduced-motion behavior and this feature's independent document-panel placement. The earlier 119-case verification and 53-case reception refresh remain tied to their stated bases.

On the new production mock build (9.4s compile / 19.5s TypeScript), **61 distinct cases pass**: all 56 document-layout/shared-panel/reception-overlay/profile cases plus five chart geometry/visual/pinning/collapse cases. The first run passed 55/56; one screenshot guard rejected multiple already-closing tooltips. The corrected zero-visible-tooltip guard and chart cases passed 7/7, followed by 2/2 settled billing/dispensing captures and a final dispensing viewport/content check (1/1). No runtime changes were made for these assertions. All five current profile-coexistence images were inspected; settled source images replace only the relevant profile captures.

Current Ready Production rollback: `dpl_H5hqKUBpQ9aNazwjP8NDthe7h1TS`, source `6f70a24583bde034b84ed4f913e614d9cf988463`, URL `https://emr-app-shell-prototype-nmxm0iqlz-mcso0s-projects.vercel.app`, confirmed by Vercel source metadata. The earlier exact candidate's Release Check and Preview were successful, but that source was superseded by this profile refresh. Run the check and verify Preview for the final refreshed head before requesting approval. Production smoke scope is matching Ready source/alias plus login and authentication boundary; app-authenticated clinical/financial acceptance remains unverified.

Final profile-refresh preparation checks: changed frame/test ESLint, standalone TypeScript, **1057** Markdown docs, **4559** tracked secret-scan files, UX copy and diff whitespace all pass. The production source is unchanged after the successful rebased build.

## 2026-10-01 chart initial wide preference

User approved local implementation in this chat: “오케이 좋아. 수정에 들어가자. 기본 넓게 보기여야한다는 의미알지?” Scope: treatment defaults to wide when no workspace/module preference exists; manual choices remain respected during navigation, full reload returns to wide, and other modules retain narrow defaults. No durable storage or data/API change. Prepared in the isolated chart-default-wide worktree because the primary and previous width checkout contain unrelated WIP.

Verification: TypeScript and targeted ESLint passed. The chart/shared-layout run passed 15 existing tests; the new reload probe initially reloaded a module-navigation URL without an encounter selection, so the probe was corrected to reload the original selected-chart URL before testing navigation. That probe passed on rerun. Five affected chart geometry/table tests passed. An intermediate overlapping test run lost its owned dev server; rerunning those five tests with an independent server passed. All verification used loopback synthetic fixtures. Production deployment and main merge were not performed.

Delivery approval: 승욱, 2026-10-01, “다하면 커밋,푸시,피알, 오리진-메인에 머지. 배포 승인”. This covers the scoped chart default-wide candidate through PR/main/Production. Source: codex/chart-default-wide from origin/main e4d382a76e52943193524c0e9a2d944c77b49838. Existing Vercel environment configuration is reused without secret changes. Required preflight: secrets/docs/diff/UX copy/lint/type/build and manual exact-candidate Release Check; scoped tests are recorded above. Smoke: Production shell/login and treatment default width when authenticated access is available, otherwise report the authentication boundary. Rollback: prior Ready Production dpl_FCrzH56ci7Qz9TALfLkyMhtkDMaP or revert this scoped PR. Stop on failed required checks, unexpected candidate scope, deployment failure or critical smoke failure.

## Approved chart alignment correction — 2026-10-01

승욱 approved implementation of the reviewed standalone HTML preview: “일단 수정 시안을 대로 수정을 진행하자.” The clean attached release worktree now uses `codex/chart-document-alignment` from current main `e4d382a7`; the original width-release branch and primary-checkout WIP are preserved.

The shared center's 16px inset had compounded the chart's existing 16px inset. A geometric regression comparing S/O/History and Plan/Order outer edges to the action bar's inner edges failed before the fix with an exact 16px discrepancy. The chart now omits its own horizontal inset only inside the document layout; the fallback keeps it. The shared toolbar omits its added bottom border only for 진료/차트. Other modules retain their separators. The 1040px cap, minimum clinical panel tracks, contained scrolling, input state, history/profile placement and data/API contracts are preserved.

The focused geometric regression passes after the fix. Removing the 1px toolbar separator changes the existing 1540px-wide visual fixture's content height from 919px to 920px. The approved extra 32px of usable width changes its panel widths to 573 / 573 / 379px while keeping the 452 / 8 / 452px vertical tracks. Plan/Order's pinned span remains 408px; its reference scroll region grows from 1098px to 1130px. Matrix assertions compare the visible clinical group and Plan/Order edges to the document edges, including profile/history coexistence.

The optimized local mock build and TypeScript pass. Changed-file ESLint, documentation links (1057 Markdown files), secret scan (4565 tracked files), and **43 distinct focused Playwright tests** pass: 38 document-layout cases across chart/shared shell/dispensing/imaging/billing plus five chart alignment/chrome/geometry/pinning/collapse cases. The regenerated 1540×920 baseline and actual wide/narrow/profile-history captures were visually reviewed. Local synthetic preview captures are saved outside the repository at `/Users/iseung-ug/.codex/visualizations/2026/10/01/chart-alignment-implementation/`; historical release captures remain unchanged. No commit, push, new PR, main merge or Production write is part of this local correction.

Delivery approval: 승욱, 2026-10-01, “수정 다했으면, 커밋, 푸시, 피알,오리진-메인에 머지. 배포 승인”. This explicitly covers the reviewed chart alignment correction through commit/push/PR/main/Production. The candidate was rebased onto `a4ec1f02e351a23eb7f47a76cbcf049dba05aa81` (#888); its chart default-wide behavior and original verification history are retained. Rebased verification passes full lint, standalone TypeScript, optimized mock build, secret/docs/UX-copy gates and **44 distinct focused tests** (39 document-layout cases including the new default-wide/reload case, plus five chart geometry/chrome/pinning/collapse cases). Only this alignment source, focused tests, refreshed visual baseline and owning documentation are included.

The final head is recorded in the PR and release packet; its manual Release Check and Ready Preview must pass before an exact-head-protected squash merge. Smoke: Production `/login`, treatment route/authentication boundary, and read-only wide/narrow alignment when the existing authenticated synthetic session is available. Rollback: the prior Ready Production deployment identified immediately before merge, or a reviewed revert of this scoped PR. Stop for an unexpected head or scope, a failed required check/Preview, unexpected Production source, or a critical smoke failure. Existing environment configuration is reused; no DB, migration, credential, provider or clinical-data write is included.

PR #890's first candidate `5a571437cc61f6cda2f3a8ac005b5979a739c2ab` passed Release Check `36829190635` and Ready Preview `dpl_3axMWhjtFXHsSVRgE9D6QVJ2UMRd`, but main advanced through #889 before merge. A clean rebase onto `fc60044399e06f0a5103cb88acefb35f1608a056` preserves its waiting-surface background, full-width center exception and hover-scrollbar behavior without expanding this alignment diff. The refreshed source passes full lint, standalone TypeScript, optimized mock build and **45 distinct tests**: all 39 document-layout cases and six chart cases including the waiting-to-start consultation regression. The refreshed exact head requires its own successful Release Check and Ready Preview. The existing session can access the synthetic Cheongdam chart for read-only post-deploy geometry verification. Current rollback: Ready Production `dpl_9ES6xz37CVREnBbPpdoosB4UADiE`, URL `https://emr-app-shell-prototype-6ux9f09xw-mcso0s-projects.vercel.app`, source `fc60044399e06f0a5103cb88acefb35f1608a056`.

## 2026-10-01 all document layouts default wide

승욱 clarified that every screen with the narrow/wide button must start wide, and approved implementation plus commit/push/PR/origin-main merge/Production delivery in this chat. The shared fallback is now wide for all opted-in layouts: 임상검사, 진료/차트, 조제/처치, 영상, 수납. Explicit workspace/module choices remain respected during app navigation and reset to the wide default on full reload. Existing responsive width-button visibility, panel behavior, mounted input state, table columns and density are preserved. No durable storage, API, DB, security or environment changes.

Source: codex/all-document-default-wide from origin/main 906a118b41e760adf2dc274f1e3df4895a4adc32, reusing the clean managed worktree. Scope: common width fallback, five existing layout test files and this contract/work evidence. The user's scope-specific delivery approval is retained; exact candidate Release Check and Ready Preview are required before exact-head-protected merge. Existing Vercel configuration is reused without exposing or changing secrets. Smoke: Production /login and workspace route responses plus authenticated width controls only if a signed-in session is available. Rollback candidate: current Ready Production dpl_FQi7esMxFAQbJMJnWbCdRi2NkPpG or scoped merge revert. Stop on required gate failure, candidate drift, unexpected scope, failed deployment or critical smoke.

Focused verification: all 43 layout tests passed on loopback synthetic fixtures. Local secrets/docs/UX copy/lint/type gates passed; lint retained five pre-existing script warnings. Production build and remote exact-candidate gates are verified before merge.

## Five-module alignment completion — 2026-10-01

After PR #890's chart-only correction, 승욱 clarified the missed scope: “하.. 진료/차트 쪽 만했구나..”. The active objective remains the approved document-alignment correction and its requested commit/push/PR/main/Production delivery. This follow-up applies the same reviewed borderless toolbar and single outer-inset rule to the remaining opted-in modules: 임상병리검사, 영상검사, 조제/처치 and 수납. It uses `codex/document-alignment-all-modules` from #890's merge `906a118b41e760adf2dc274f1e3df4895a4adc32`; primary WIP and `.omo/` are preserved.

The shared toolbar no longer adds a bottom separator. Lab/imaging result sections and dispensing notices/execution sections omit their duplicate 16px outer inset only when the document layout owns that inset; standalone fallback padding remains. Billing already omits duplicate content padding and needs only the common toolbar change. Module caps remain 1040 / 1120 / 1280px; default modes, card inner padding, clinical/persistence/financial APIs and panel interactions remain unchanged.

The new alignment assertions in the existing Lab, dispensing and billing width cases reproduced the remaining 1px toolbar separator on the unchanged #890 build. Imaging is included in the final focused checks. Verification and exact delivery evidence will be recorded below before release. Smoke covers `/login`, the four module routes and reversible document-width/panel presentation when the existing authenticated synthetic session supplies selected documents. No clinical, result, payment, provider, DB, migration or credential write is authorized by this visual follow-up.

Initial loopback verification on base `906a118b`: all **39 document-layout cases** passed, including the added visible narrow/wide edge comparisons for the remaining four modules. Optimized mock build, full lint (five pre-existing warnings), standalone TypeScript, secret scan, docs and UX-copy checks passed. Main then advanced through #891 (vital insertion synchronization) and #892 (all document layouts start wide). The final candidate retains both changes and requires fresh build/focused verification. Historical report images generated by tests are copied outside the repository and restored before staging.

Final rebase onto `6e09f0f9bc151acb3dcc66227da7d7591627916e` retains #891 and #892, including every document module's wide default and full-reload behavior. All **49 distinct focused cases** pass on the final optimized mock build: 43 document-layout tests across all five modules plus six chart alignment/chrome/geometry/pinned-column/collapse/waiting-to-start cases. Full lint passes with five pre-existing script warnings; standalone TypeScript, tracked-secret scan (4571 files), docs (1057 Markdown files), UX-copy and whitespace checks pass. Actual narrow/wide edges and module caps, input/selection/scroll retention, bilateral/profile placement, modal focus/Escape and nested confirmation remain covered. All four affected wide screenshots were inspected; the five-module comparison HTML and captures live outside the repository under the local `document-alignment-all-modules` visualization folder.

The prior delivery instruction covers this completion of the intended five-module alignment scope. Required exact-candidate Release Check and Ready Preview remain mandatory. Production action is an exact-head-protected squash merge to main followed by deployment/source/alias proof and the scoped authenticated synthetic read-only smoke above. Rollback is the immediately preceding Ready Production deployment recorded in the release packet; no rollback, remote migration, field save, status transition or payment action is included. Stop on head/scope drift, required check failure, unexpected deployment source or critical smoke failure.


## Approved history/title slide restoration — 2026-10-03

승욱 accepted the reviewed HTML slide interaction, expanded the scope to 진료/차트, 임상, 영상, 조제/처치 and 수납, and authorized implementation plus “다하면 커밋, 푸시, 피알, 오리진-메인에 머지. 배포 승인”. This authorization covers the same five-module history placement/motion change through PR/main/Production. Primary-checkout WIP stays untouched; the attached clean worktree uses `codex/history-panel-slide` from current origin/main.

The common document layout now places history beside the title, immediately below patient context. The title/actions and body share one document container. Pointer opening/closing slides history from/to the left and translates the mounted document to its final position using existing 180/140ms motion tokens. Rapid reversal starts from the visible position. Keyboard, reduced motion, restoration, resize and automatic presentation changes remain immediate. Existing narrow/wide transitions stay independent. Stable history mounting retains group/filter state; closing history is inert and excluded from accessibility before its visible exit finishes, and returns focus from its controls to the title trigger. Right reference panels retain their below-title placement using measured, wrapped toolbar height. Profile/queue, inputs, scrolling, data/API/permission/financial actions and non-opt-in modules retain their existing contracts.

Focused checks cover all five document layouts and pointer midpoints, exit visibility, reversal continuity, keyboard/reduced motion, restored routes and retained history/input DOM. Required local gates and the exact-candidate manual Release Check plus Ready Preview must pass before an exact-head-protected squash merge. Existing Vercel configuration is reused without credentials or environment changes. Production smoke: `/login`, the five scoped routes, and reversible history/width controls on authenticated synthetic documents where the existing session supplies them. HTTP probes alone do not prove authenticated interaction. Rollback is the immediately preceding Ready Production deployment recorded in the release packet, or a reviewed scoped revert. Stop on head/scope drift, required gate failure, unexpected deployment source or critical smoke failure. No DB, clinical/result save, payment, provider, migration, credential or role-policy write is included.


## Imaging width discoverability correction — 2026-10-03

승욱 approved the investigated correction and requested commit, push, PR,
origin/main merge and Production delivery. The clean `codex/imaging-width-control`
branch starts from `0ea42732655ed8947df77d1d099ccf748bc234aa`; primary WIP is preserved.
The final candidate is rebased onto `f6c0f281afe62679536943197b31e6f66ac57231`
and retains #901's mounted title/body and history slide behavior.

The existing imaging width control was already wired, but the 1280px report cap
hid it on narrower work surfaces. Imaging now uses a 1120px narrow cap and keeps
the existing shared control visible when space is insufficient. The disabled
control remains keyboard-focusable and explains the identical effective widths
through the existing tooltip. Other modules keep their current hidden-button
policy and caps. Default-wide/session preference, panel presentation, mounted
inputs, table density and contained scrolling remain unchanged. No clinical
data, API, DB, migration, permission, dependency or environment change is included.

Verification: all 48 focused cases pass on the final optimized local mock
build: 44 document-layout cases across imaging, lab, chart, dispensing and
billing plus four history-motion cases. The imaging
matrix covers 960, 1366, 1440, 1600, 1920 and 2560px viewports; keyboard focus,
accessible tooltip description, disabled activation, re-enabled narrow mode,
mounted input retention and existing panel behavior pass. TypeScript and full
lint pass (five existing script warnings); build passes with the existing docs
reader trace warning. Required secrets/docs/UX-copy gates pass before commit.
Generated historical report captures are saved outside the repository and
restored before staging. The exact candidate must pass
manual Release Check and Ready Preview before exact-head-protected merge.
Production smoke: `/login`, the synthetic Cheongdam imaging route, and read-only
width/control verification. Rollback: the immediately preceding Ready Production
deployment or a reviewed revert of this scoped merge. Stop on candidate drift,
failed required checks, unexpected deployment source or critical smoke failure.

## Approved Lab receipt hierarchy and slide — 2026-10-03

승욱 requested that 장비 검사 수신함 share the history panel hierarchy, starting beneath patient context beside the title, while remaining on the right and entering from right to left. The follow-up authorizes source investigation, a concrete plan, implementation, commit/push/PR and origin/main merge. This scope adds only Lab receipt placement/motion; imaging and billing right references retain their existing behavior.

Cause: the common right-panel position added measured toolbar height and immediately hid closing panels. Plan: use the full work-surface position for Lab receipt, mirror the existing clipped CSS slide at 180/140ms, and extend measured document translation to its pointer toggles. Preserve keyboard/reduced-motion/restoration/resize instant handling, focus return, nested confirmation, input/scroll retention, and existing receipt unmount/reset after exit. No new dependency, data write, device integration, or API/permission change.

Verification must cover aligned bilateral panel tops/heights, right-edge anchoring, visible exit completion, rapid reversal, narrow document continuity, keyboard/reduced motion, route restoration, modal focus/nested confirmation and regression checks for unchanged consumers. Delivery reuses the release gates: local checks, exact-candidate Release Check, Ready Preview, exact-head-protected merge, origin/main proof and scoped Production smoke. Smoke uses reversible receipt/history/width controls on an authenticated synthetic Lab document and /login. Rollback is the immediately preceding Ready Production deployment or a reviewed revert. Stop on candidate/scope drift, failed required checks or unexpected deployment/smoke results.

Local result: 51 focused browser tests passed across Lab/history motion and all five document-layout consumers. Full lint (five pre-existing script warnings, zero errors), TypeScript, mock production build, secret scan, docs links, UX copy and diff checks passed. In-app browser synthetic Lab proof measured history/receipt/title top at 109px and bilateral panel height at 960px in a 1920×1080 viewport. Existing generated report captures were preserved outside the repository and restored before staging. Release SHA/deployment/smoke evidence is recorded in the PR and task release packet.
