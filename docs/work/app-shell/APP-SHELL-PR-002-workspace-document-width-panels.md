---
id: APP-SHELL-PR-002
status: human_review
area: app-shell
priority: P1
target_pr: User-approved PR candidate preparation; Production approval pending
updated: 2026-09-30
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
