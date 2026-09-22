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
