---
id: "LAB-PR-003"
status: "human_review"
area: "lab"
priority: "P1"
source_docs:
  - "docs/work/lab/LAB-PR-002-result-sheet-figma-phase-1.md"
  - "2026-09-27 approved phase-2 implementation report and interactive prototype"
dependencies: []
updated: "2026-09-29"
---

# Lab Result Sheet Phase 2

## Goal

Implement the approved phase-2 result sheet: item findings, an independent overall finding, revision history, and result attachments on the phase-1 table.

## Scope

- Keep each item finding on its own frozen result row and the overall finding on the result entry. Preserve values and findings across retests and expose read-only prior revisions.
- Add card/list attachments for result rows, while pre-existing result-level attachments remain common. Use a 144px viewport, scroll fade, keyboard access, and the approved loading, failure, retry, preview, download, and deletion behavior.
- Enforce workspace, result, row, and revision selectors plus lab read/write permissions on the server and database. Use private storage, a hidden deletion tombstone, and a durable audit record.
- Keep the existing result-value save, profile evaluation, and atomic retest contracts intact.

## Boundaries

- Remote Supabase migration replay and Production require explicit approval. The migration was approved and applied to the linked staging project; the PR and Production release still follow the exact candidate gates in the release runbook.
- No chart-copy implementation, provider delivery, or upload of real patient files.
- The exact backup retention period is an operations setting and is not invented here.

## Done Criteria

- Findings and attachments survive reload and respect result/retest ownership.
- Prior order, result values, findings, actor, and timestamp can be read before retest; later changes do not overwrite earlier snapshots.
- Read/download and edit/upload/delete permissions are enforced beyond the client, with denied and failure states.
- Focused type, lint, database, and browser checks cover the changed behavior.

## Authorization

승욱 approved the phase-2 report decisions and local implementation on 2026-09-27, then requested commit, push, PR, `origin/main` merge, and deployment. After the explicit staging migration target and scope were presented separately, 승욱 approved deployment, including the migration. A changed PR head still requires the exact candidate Production gate.

## Local Candidate

- Item findings continue through the phase-1 row `note` save contract. A separate result-level overall finding uses compare-and-set revisions and an immutable change event. The retest request captures the previous order, rows, item findings, and overall finding; a new result reads its prior retest chain without copying the prior overall finding.
- Result-row attachments use a private bucket and scoped metadata, a 144px card/list viewport with scroll fade, a delayed upload indicator, two concurrent uploads with a queue, manual retry, and an inset viewer. The API verifies session, workspace, result, row, and `lab:view`/`lab:complete` boundaries. Deleted files are immediately hidden and blocked by a tombstone. Cancelled upload metadata remains until a bounded, dry-run-default reconciliation script removes any late object after the two-hour signed token expires; its pending-file cutoff is three hours.
- Existing result-level attachment presentation stays in the common section. In the current live lab detail, that legacy collection is empty; its previous fixtures have no persisted storage object or deletion API. The new upload path creates row-owned files only, and does not silently assign a legacy fixture to a row.

## Verification (2026-09-27)

- TypeScript, changed-file ESLint, production build, docs links, secret scan, and `git diff --check` passed. The build reported the existing unrelated `next.config.mjs` NFT trace warning.
- Focused Chromium tests passed: lab result entry/detail layout and two attachment metadata/content checks.
- The migration applied to an isolated local PostgreSQL clone with stubbed newer prerequisite columns/table because the shared local schema predates the atomic retest migration. A rolled-back synthetic transaction verified row change history, overall-finding save, retest snapshot lookup from the new result, and blank new overall finding. This is local SQL behavior evidence, not a remote replay or full storage integration test.
- `npm audit` currently reports 30 dependency advisories; none target the two added viewer packages or `pdfjs-dist`. No dependency-wide update was attempted in this scoped change.
- Migration `20260927124324_lab_result_sheet_phase2` was applied to the linked staging Supabase project after approval. Read-only checks confirmed all three new tables, attachment RLS, service-role read/write/delete grants, no anonymous table read, and the private storage bucket. Security advisor findings for two internal RPC-only tables report intentional no-policy RLS; performance advisor findings are informational foreign-key and unused-index notices on the new tables.

## Production Checkpoint (2026-09-29)

- Exact head `fc384ebdcdddcbb9146db7e52c5757cdaffe2f68` passed Release Check `36320114374` and was approved, then squash-merged as PR #848. `origin/main` was exactly merge SHA `e249463c3bf81ba22fc7057b2d43bedfad1299e2` at the checkpoint.
- Production `dpl_9poef6xbv7wQhHgK4wNJk4ieTUkF` is Ready and serves the official alias. Build logs show `main` / `e249463`; `/login` returned HTTP 200. Prior Ready rollback candidate: `dpl_7i9B2LVuBgYx33if87kx8YY2aPaX`.
- Authenticated synthetic smoke displayed the new item finding, overall finding, history, and upload surfaces. Item-finding save succeeded. A 179-byte synthetic PNG reached the delayed uploading UI, then prepare returned HTTP 409. No attachment metadata or object was created. Preview, download, deletion, overall save, and retest integration were not completed after that failure. The synthetic item finding was cleared through the UI and a scoped read verified no synthetic marker remains. Its save/clear audit events remain, and result status is now entered; this is not a full state rollback.
- Root cause: attachment APIs directly selected RPC-only result tables; both `authenticated` and `service_role` have no direct SELECT grants there. Signed upload preparation must also use the server-only storage client because its prior authenticated metadata policy depended on those unreadable tables.

## Forward-Fix Candidate

- Migration `20260929055945_lab_attachment_scoped_context.sql` adds an authenticated, permission-checked context RPC and an atomic prepare RPC. Both enforce workspace/canonical-result/row ownership; prepare locks the result and checks editable status, permissions, actor, metadata constraints, and derived object path. Existing direct table grants and RLS remain unchanged.
- The API resolves result/row ownership through the session RPC, commits pending metadata through the atomic prepare RPC, and creates the signed upload URL with the existing server-only client. Read/download/delete use the same resolver. No new dependency or permission-policy change.
- Four focused server regression tests pass: RPC-only resolution, trusted signing, denied/foreign selectors, and a concurrent status rejection that prevents signing. A rolled-back fixture in a disposable local PostgreSQL database verified authorized RPC execution, denied direct reads, foreign workspace/result/row rejection, closed-result rejection, viewer-upload rejection, anonymous rejection, and immutable actor/path. The fixture uses representative constrained tables and permission stubs, not a full Supabase replay.

- Local release preflight passed: lint (0 errors, 5 unrelated warnings), TypeScript, production build, secret scan, docs links, UX copy, and diff checks. The approved migration was applied as `20260929055945` to the linked project on 2026-09-29. Remote definitions and authenticated-only EXECUTE were verified; anonymous/service EXECUTE and direct result-table reads remain denied.

## Scoped Preparation Fix Release (2026-09-29)

- Approved exact head `6046a9885e6dde42f8cf87748add1d08ec740fb8` passed Release Check `36528902245` and was squash-merged as PR #851. Merge SHA / `origin/main` at the checkpoint: `debcfca58c2226ef17dcbd72962e1fe97f8daddf`.
- Production `dpl_G6kXHXm3ja1v76CBuF8z6zPsywSy` was Ready and served the official alias at that checkpoint. Build logs confirm `main` / `debcfca`; `/login` returned HTTP 200. A subsequent unrelated main release may advance the alias.
- The approved synthetic PNG (179 bytes) passed preparation and private storage upload, but finalize failed and its automatic discard also failed. A scoped read confirmed one pending metadata record and matching private object; it is not a ready attachment. No new finding, overall finding, or retest was submitted in this attempt. Further product smoke stopped at this failure.
- Root cause: the UUID regular expressions in both attachment routes omit the end of the fourth group and its following hyphen. Therefore IDs generated by preparation fail finalize/discard validation and also fail preview/download/delete validation. No DB or storage-policy change is needed for this correction.

## Attachment Lifecycle Follow-Up

- Branch `codex/lab-attachment-lifecycle-uuid` corrects only the two route validators. Existing authentication, workspace/result ownership, actor, byte verification, tombstone, and storage cleanup guards remain intact.
- Seven additional route-level tests use IDs returned by actual preparation to exercise finalize, idempotency, preview/download, delete, discard, malformed IDs, uploader mismatch, invalid bytes, storage removal failure, permissions, and foreign result rejection. The suite failed before the validator fix (six failures) and passes after it. Together with the four scoped-context tests, 11 focused server tests pass. Metadata/storage are simulated; this is not authenticated Production integration evidence.
- Local lint (0 errors, 5 unrelated warnings), TypeScript, production build, secret scan, docs links, UX copy, and diff checks passed for the code-only follow-up. The existing NFT trace build warning remains unrelated. Exact-candidate CI and Ready Preview are required before the new Production approval packet.
- The private synthetic pending upload still requires cleanup through the corrected, authorized test workflow. Pending-object reconciliation remains manual with a three-hour cutoff; no scheduled runner is introduced.

## Remaining Release Boundary

- Run authenticated upload, reload, preview, download, delete, and retest smoke against synthetic data. Verify the private bucket policies in that workflow and arrange bounded reconciliation for pending/tombstoned objects before considering remote delivery complete.
- The scoped-context migration is approved and applied; its preparation fix is deployed. The code-only lifecycle follow-up still requires exact-candidate release verification and Production approval. Full authenticated storage/retest smoke remains pending. Human acceptance is not inferred from Ready deployment. The reconciliation script remains manual; no scheduled runner or real-file upload is approved.
