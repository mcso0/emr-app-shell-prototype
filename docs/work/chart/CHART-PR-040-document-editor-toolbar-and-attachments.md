---
id: CHART-PR-040
status: human_review
area: chart
priority: P1
updated: 2026-09-22
source_docs:
  - docs/design/screens/chart/specs/soap-document-editor.md
  - docs/work/chart/CHART-PR-030-blocknote-soap-live-persistence.md
  - docs/work/chart/CHART-PR-033-diagnosis-system-soap-scopes.md
  - docs/work/chart/CHART-PR-034-soap-template-writing-prompts-and-side-menu-geometry.md
---

# SOAP document toolbar and attachments

## Authorization and goal

The user approved the iterated HTML v7 design and requested local implementation by GPT-5.6 Sol under parent supervision on 2026-09-22. They explicitly expanded scope to actual photo/video attachment storage, not only local preview. The later user instruction on the same date explicitly approved completing verification, committing, pushing, opening a PR, merging into origin/main and deployment. The delivery scope includes the previously disclosed additive private-storage migration and server-only configuration for this feature; synthetic verification only, with no real clinical data or unrelated release work.

Existing CHART-PR-030/033/034 own historical persistence, scope, and prompt behavior. This follow-up changes toolbar behavior and adds private attachments; preserve their existing contracts and all dirty-worktree changes.

## Scope

- Fixed single-row neutral-icon toolbar with priority overflow, named overflow actions, hover/focus tooltips, formatting states and undo/redo availability.
- Remove floating formatting, left block manipulation, and slash-menu entry points; retain SOAP sections, diagnosis-system scopes, current text and serialized autosave/conflict behavior.
- Safe writing aids, existing-record selection with date/source, list/link/divider formatting; optical-exam entry remains explicitly unconnected.
- Private image/video upload, progress/error/retry/cancel presentation, stable persisted attachment references, permission-scoped readback. No expiring signed URL or blob URL as canonical persisted content.
- Validate document/media changes at application and database boundaries; never enable unsupported blocks that make existing notes unsavable.
- Native 2 × 3 table insertion with bounded TypeScript/SQL validation and SOAP text projection (maximum 20 rows, 10 columns, 100 cells; no merged cells).

## Boundaries

No real clinical fixtures, public bucket, broad role/permission changes, unrelated migrations, or unrelated WIP cleanup. Approved targets are the current EMR Vercel production project and its verified existing Supabase project; direct main delivery follows the explicit user request, without moving the fixed staging alias. Parent owns integration/review/docs, UI worker owns editor and stories, persistence worker owns attachment API/domain/migrations/tests. Coordinate shared schema edits explicitly.

## Acceptance and verification

- Single 42px-class toolbar row at narrow/wide widths, all overflow actions accessible, keyboard/focus behavior and no hidden state divergence.
- SOAP text/scopes persist and reload, failed upload does not erase text, readonly blocks writes, undo preserves selection.
- Attachment requests reject other-workspace/encounter, unauthorized, invalid-type/size/reference inputs; successful local upload/save/reopen proof uses synthetic files.
- Focused editor browser tests, SOAP document/autosave/server tests, attachment boundary tests, typecheck/lint, affected build and docs checks.
- Report local proof separately from remote migration/deployment readiness. Finish authorized preparation before presenting any remaining gate.

## Initial local evidence (before release integration)

- Baseline `npx tsc --noEmit` passed before implementation changes.
- Implemented by GPT-5.6 Sol workers under parent review; a separate security reviewer found no remaining concrete source blocker after corrections.
- Production build (`npm run build`) passed, including TypeScript. The existing PRD viewer path-tracing warning remains; no build failure. Focused ESLint and diff whitespace checks passed.
- Combined SOAP document, autosave coordinator, note persistence server and attachment tests: **40 passed**. Focused chart browser regression: **2 passed**. The latest attachment-only run, including the added cancellation test, passed **5/5**.
- Storybook: **17 unique stories passed** across focused runs, including 320/420/720/1000px widths, formatting/undo, nested blocks, prior S/O/A/P selection, upload success/failure/retry/cancel/read-only, and native table insertion. Follow-up tests confirmed More tooltip, no empty More menu, and disabled default arbitrary-URL file panel.
- Parent layout inspection: 318px toolbar width / 44px height, one row, no document horizontal overflow; popover escapes a 260px-high panel through the shared portal.
- Parent actual isolated Storage HTTP tests with generated one-pixel PNG: **15 passed** for signed upload/readback, private access, foreign workspace denial, immutable final path, replay isolation and scoped read signing. Further **8 passed** for cancellation/replayed-token tombstone tracking, denied read/re-sign/finalize and cleanup capability.
- Worker isolated PostgreSQL checks passed for authenticated pending insert, foreign rows, denied direct ready/final writes, pending document reference rejection, ready reference and transactional audit acceptance, V1/V2 table positive/negative parity, existing nesting limits, forged creation/cleanup timestamps and premature cleanup-marker rejection.
- All task-created disposable databases and the isolated Storage container were removed after proof; shared local databases and stacks were preserved. Local Storybook remains available for review.
- Fresh current migration replay and `tests/sql/chart_soap_private_attachment_compatibility.sql` passed on a schema-only disposable DB with existing SOAP prerequisites; no live rows were copied.
- `npm run docs:check`: 1068 documents passed. Repository secret scan passed; the same scanner also passed on 13 scoped new files.
- This is composed local evidence: editor transport stories use mocks; actual Storage HTTP and SQL checks ran separately. A complete authenticated Next API + chart save/reopen on the deployment target is still required at release smoke.

## Release scope and plan

- Clean release branch: `codex/soap-document-editor-release`, based on `origin/main` `f13227a0d7d0989464cba7a06b39af5a9af9656c`. Preserve newer multi-chart IDs, amendment flow and clinical timestamps; do not wholesale-copy stale primary files.
- Work ID corrected from the primary checkout's provisional 039 to 040 because current main already owns CHART-PR-039 for consultation rooms.
- Current production rollback candidate before this release: `dpl_CM29YkDqJifRxcZ4HmgDRWXVDjxS`, Ready and serving the production alias. Keep additive DB/Storage if rolling application back. Old applications are blocked by the capability guard from overwriting image/video/table documents; prefer a compatible-reader forward fix if rich documents already exist.
- Release review found old clients could reconstruct legacy projections without rich blocks. Require explicit `editorCapability=media_table_v1` from the new UI, preserve it through the API, and enforce it at the database for writes to/from rich content. Existing RPC names, auth, lifecycle, optimistic conflict and audit contracts remain intact.
- Preflight: secret scan, docs, whitespace, full lint/typecheck/build, focused SOAP/multi-chart/browser tests, isolated SQL tests, exact-commit GitHub Release Check and Ready PR Preview.
- Before migration: catalog/grants/policies inspection and content-free fingerprints. Baseline canonical documents: V1 3, V2 8, both zero invalid. Compare unchanged document/projection fingerprints after atomic apply.
- Environment source: existing Supabase project management credentials transferred securely to Vercel Production server-only `SUPABASE_SERVICE_ROLE_KEY`; no value printed, tracked or placed in a public variable. Production URL/config target match verified. No Preview secret was added.
- Smoke: fresh production app/session, one-row toolbar and overflow, dedicated synthetic chart upload/finalize/save/reopen, stale-client rejection, foreign-scope denial, and no critical browser/runtime errors. Do not modify existing user-authored chart content.
- Stop before merge for any failed required check, unexpected source diff, migration compatibility failure, secret exposure, or missing required configuration. Use a forward fix or the guarded prior deployment if post-deploy smoke fails; retain persisted private content.
- Clean release verification: 53 SOAP/multi-chart server tests passed; 4 scoped chart browser tests passed (including chart-ID history selection and autosave/manual capability payload); full lint passed with five unchanged script warnings; typecheck, production build, docs, UX copy, whitespace and staged secret scan passed.
- Latest isolated SQL proof passed for table/privilege compatibility, old v1–v4 rich-document rejection, capable create/removal, plain legacy compatibility, marker reset and audit counts. The isolated baseline loaded the required multi-chart schema/function portion; unrelated later order-summary migration sections were not replayed there. Actual remote prerequisite signatures were separately verified present.
- Exact candidate SHA, PR, CI/deployment and final smoke evidence will be recorded in release closeout.

The manual reconciler is dry-run by default and is not scheduled or run against remote clinical content in this release. Its three-hour expiry guard assumes the current two-hour Storage signed upload lifetime. Completed final files remain tracked even when no draft references them. Optical exam is a menu-only entry as requested; media format/size and one-file-at-a-time limits are in the design contract.

## Remote migration evidence

- Applied only this candidate migration to the verified existing Supabase project on 2026-09-22 with bounded lock/statement timeouts. Ledger version: `20260922080740`; local filename aligned to that actual applied version. SQL body SHA-256 remains `bb3b312142c72dcc5b68118c69f77ed50966498be2043db20fa358daadac9a6c`.
- All 11 existing canonical documents remained valid (V1 3 / V2 8), with identical document and projection fingerprints before/after. No existing SOAP content was modified.
- Effective grants verified: authenticated SELECT/INSERT only; anonymous no access; service role SELECT/INSERT/UPDATE/DELETE, no TRUNCATE. Existing Storage policies are bucket-specific and do not open this new private bucket.
- Production server-only key is configured; current production code remains the previous Ready deployment until approved candidate checks and merge complete.


## Approved S/O panel follow-up — 2026-09-29

승욱 approved the iterated standalone S/O prototype, requested GPT-6 Luna at maximum reasoning under parent orchestration, and authorized scoped implementation, commit/push/PR and Production delivery after verification. Parent owns integration, visual/behavior review and release gates. The exact candidate packet is prepared after implementation; no remote schema or data migration is in this follow-up.

Baseline: `origin/main` `5c3db5e9696299dbf866d862015db9848df8bdbd`; branch `codex/soap-panel-fidelity`. Preserve the unrelated dirty primary checkout. Work from the isolated checkout and port no complete stale files.

### Scope and contracts

- New default/system documents start with one valid blank paragraph and `S/O 내용을 입력해주세요`. Existing V1/V2 and legacy structured notes retain their contents and section provenance. Mount/read alone must not save.
- Replace the header save icon with `+` and a searchable multi-select diagnosis-system picker using the real catalog. Existing system tabs are unavailable choices. Persist explicit empty scopes; use existing `systemId` identities to avoid duplicates when a diagnosis is later chosen. Reset clears only the current scope; tabs and other scope contents remain.
- Preserve the existing autosave coordinator, chart/workspace permissions, optimistic concurrency, amendment state and media capability guard. Keep legacy S/O/A/P projections unchanged. Read neutral freeform default-scope content for record presence, diagnosis context and previous-record insertion without inventing a clinical S/O classification.
- Match the approved reference geometry: panel reference 476.5 × 373; header38; tabs44 plus divider1; toolbar wrapper58/bar42/buttons32; body14/22 and inset4/16. Live panel resizing remains supported.
- S/O tabs scroll with directional fade; fixed ghost `더보기` appears for overflow. Its heading is `숨긴 진단계통`; selecting an item activates and reveals the existing tab.
- Preserve all 23 real toolbar commands. Use a centered content-width row when it fits; otherwise horizontal scrolling with directional fade and a fixed ghost vertical More button. Partially visible tools remain actionable. One activation executes the command and minimally reveals the tool; focus navigation does not execute it. Use actual editor selection state, preserve selection and return focus to the editor after formatting. Overflow invokes the same commands and retains a stable list while open.
- Reuse BlockNote and existing shared primitives; do not port the standalone contenteditable/execCommand demo, add dependencies or weaken attachment/record boundaries.

### Verification plan

- Document and server tests: blank default, saved empty system scopes, legacy hydration, neutral extraction, projections unchanged, save/reload, scope isolation, concurrent updates and read-only guards.
- UI/Storybook: reference/narrow/wide geometry, overflow and fades, partial-button click, arrow navigation versus Enter/Space execution, editor selection/focus, real active state, menu/Escape handling, multi-add and later diagnosis reuse, reset, existing attachments and previous-record insertion.
- Candidate gates: secrets, docs, UX copy, whitespace, lint, typecheck, production build, focused tests, exact GitHub Release Check and Ready PR Preview. Record candidate/rollback/smoke before protected main merge. Production smoke must be read-only except an explicitly scoped synthetic test chart; never edit the user's selected existing chart.

Implementation and verification evidence will be recorded here as the steps complete.


### Follow-up baseline evidence

- Before implementation, isolated Node24/mock-route SOAP autosave, persistence-server and attachment specs: 34 passed. This is local synthetic baseline proof, not production save proof.
- Initial Production baseline: source `5c3db5e9696299dbf866d862015db9848df8bdbd`, GitHub deployment6731018013 successful, Vercel `dpl_DFadJJc2VMheKTkUEeL5kSym4nLo` Ready and serving the production alias. Reconfirm the live rollback candidate before the merge packet.

### Follow-up implementation and local review

- GPT-6 Luna (maximum reasoning) implemented the two owned source slices under parent review. Only the scoped editor, document adapter, S/O panel, tests and owning docs changed; dependencies, server APIs, database schema and permission policy are unchanged.
- Document contract tests: 13 passed. Autosave coordinator, note persistence server, private attachments and chart completion persistence: 40 passed.
- Editor Storybook: 23 passed, including reference geometry, blank/cleared placeholder, 320/420/720/1000px layouts, overflow threshold, partial activation, roving keyboard, selected-text formatting/history, prior records and attachment success/failure/retry/cancel/read-only.
- Parent browser verification used the real editor component: 476.5 × 373 frame, toolbar wrapper58/bar42/button32; wide1000 frame has an818px centered toolbar with no More or fades; a physically clicked partial button executes before15px reveal; selected-text bold and overflow italic preserve range and return editor focus. Enter opens the style menu without applying its first item, and Escape restores trigger focus. These are local synthetic/component checks, not Production persistence proof.
- Full lint passed with five unchanged warnings in unrelated operational scripts. Typecheck, local secret scan (4478 tracked files), docs (1053 files), Korean UX copy and whitespace checks passed. Production build passed (existing PRD-viewer file-tracing warning only). Seven focused route-backed SOAP browser tests passed, including save/reload, response-loss retry, manual scope creation, later diagnosis reuse, reset and overflow keyboard behavior. Exact remote candidate checks follow.
- Post-build browser checks for Figma panel chrome and independent panel collapse passed (2). The Figma test had two stale Plan/Order baseline expectations: source already used10px left inset and6 buttons on origin/main. Only those test expectations were aligned; Plan/Order production code is unchanged. Total focused local coverage:53 domain/server tests,9 chart browser tests and23 editor stories.
- Rollback baseline reconfirmed before candidate creation: main source remains `5c3db5e9696299dbf866d862015db9848df8bdbd`; Vercel `dpl_DFadJJc2VMheKTkUEeL5kSym4nLo` remains Ready behind the Production alias.


### Approved toolbar overflow menu correction — 2026-09-29

승욱 requested shared-component alignment after inspecting the Production toolbar overflow and authorized implementation, commit/push/PR, main merge and Production delivery for this slice.

- Initial inspected Production source: `9aad7a92e2e71adda9cc1cb07b624627fbba1bbd`. Rebased release baseline: `origin/main` `57746bb1d37275afa7b05d691038689a73afadd1`; isolated branch `codex/soap-overflow-menu`. Preserve the dirty primary checkout.
- Root cause confirmed on Production: generic Button `justify-center` persisted inside custom menu rows; generic Popover `w-72` kept the surface at288px. The visible `가려진 서식 도구` heading was custom markup.
- Use existing DropdownMenuContent/Item/CheckboxItem for overflow only:160px, left-aligned icon/label, shared active indicator and disabled/keyboard behavior, no heading. Retain existing link/writing-aid/record popovers and all command/persistence contracts.
- Defer overflow formatting focus restoration until the menu focus manager releases the popup. Escape returns to More; opening the link panel from overflow retains its anchor and input focus.
- Local Storybook MCP documentation `design-system-ui-dropdownmenu` and installed Base UI1.4.1 declarations checked. Regression coverage extends the existing real-editor stories with geometry, arrow/Home/End/Escape, selected-text formatting, active-state readback and overflow-to-link transitions.
- Real-editor Storybook regression:24 passed. Local browser confirmed160px shared menu, left alignment and no heading. Release verification and exact candidate/Preview/Release Check evidence are recorded in the PR. Production smoke is read-only: `/login`, the existing Cheongdam treatment page, More menu geometry/heading/keyboard dismissal. Never run a formatting command on the selected saved chart.
- Initially verified rollback deployment: Ready Production `dpl_32zHzcEDUMw8wUasSLooeYFzKtGi`, source `9aad7a92e2e71adda9cc1cb07b624627fbba1bbd`. Reconfirm the live Production baseline before merging; the scoped merge-revert alternative preserves concurrent releases. Stop before merge on failed local gates, exact Release Check, Preview or candidate drift. No schema, remote data, dependencies, shared primitives or permission changes.

## Approved overflow icon and label alignment follow-up — 2026-09-30

승욱 approved consistent visual icon sizing and a common left-aligned label column, including commit/push/PR, main merge and Production delivery. Font-dependent symbols mixed with SVGs caused uneven icon footprints and label starts. Replace those symbols with existing SVG assets (16px, 1.5px stroke where applicable); use a fixed 16px leading slot and shared 6px gap for every overflow row, with a left-aligned expanding label. Preserve the shared trailing checked-state indicator and command/focus/selection behavior. No dependency, persistence, permission or shared primitive changes.

Validation: the existing real-editor Storybook suite checks all overflow labels share a left edge, every icon slot is 16 × 16px with SVG content, and existing formatting/link/keyboard/focus behavior. Required release preflight and exact remote Release Check/Preview evidence are recorded in the delivery PR. Production smoke is read-only menu geometry, icons, labels, keyboard navigation and Escape; do not format the selected saved chart.
