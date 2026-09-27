---
id: "LAB-PR-003"
status: "human_review"
area: "lab"
priority: "P1"
source_docs:
  - "docs/work/lab/LAB-PR-002-result-sheet-figma-phase-1.md"
  - "2026-09-27 approved phase-2 implementation report and interactive prototype"
dependencies: []
updated: "2026-09-27"
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

- Remote Supabase migration replay and production data work require their own explicit approval. The PR and Production release follow the exact candidate gates in the release runbook.
- No chart-copy implementation, provider delivery, or upload of real patient files.
- The exact backup retention period is an operations setting and is not invented here.

## Done Criteria

- Findings and attachments survive reload and respect result/retest ownership.
- Prior order, result values, findings, actor, and timestamp can be read before retest; later changes do not overwrite earlier snapshots.
- Read/download and edit/upload/delete permissions are enforced beyond the client, with denied and failure states.
- Focused type, lint, database, and browser checks cover the changed behavior.

## Authorization

승욱 approved the phase-2 report decisions and local implementation on 2026-09-27. 승욱 then requested commit, push, PR, `origin/main` merge, and deployment approval for this phase-2 scope. This does not authorize the separate remote Supabase migration/RLS/storage change.

## Local Candidate

- Item findings continue through the phase-1 row `note` save contract. A separate result-level overall finding uses compare-and-set revisions and an immutable change event. The retest request captures the previous order, rows, item findings, and overall finding; a new result reads its prior retest chain without copying the prior overall finding.
- Result-row attachments use a private bucket and scoped metadata, a 144px card/list viewport with scroll fade, a delayed upload indicator, two concurrent uploads with a queue, manual retry, and an inset viewer. The API verifies session, workspace, result, row, and `lab:view`/`lab:complete` boundaries. Deleted files are immediately hidden and blocked by a tombstone. Cancelled upload metadata remains until a bounded, dry-run-default reconciliation script removes any late object after the two-hour signed token expires; its pending-file cutoff is three hours.
- Existing result-level attachment presentation stays in the common section. In the current live lab detail, that legacy collection is empty; its previous fixtures have no persisted storage object or deletion API. The new upload path creates row-owned files only, and does not silently assign a legacy fixture to a row.

## Verification (2026-09-27)

- TypeScript, changed-file ESLint, production build, docs links, secret scan, and `git diff --check` passed. The build reported the existing unrelated `next.config.mjs` NFT trace warning.
- Focused Chromium tests passed: lab result entry/detail layout and two attachment metadata/content checks.
- The migration applied to an isolated local PostgreSQL clone with stubbed newer prerequisite columns/table because the shared local schema predates the atomic retest migration. A rolled-back synthetic transaction verified row change history, overall-finding save, retest snapshot lookup from the new result, and blank new overall finding. This is local SQL behavior evidence, not a remote replay or full storage integration test.
- `npm audit` currently reports 30 dependency advisories; none target the two added viewer packages or `pdfjs-dist`. No dependency-wide update was attempted in this scoped change.

## Remaining Release Boundary

- Apply the migration only after the exact target schema and permissions are reviewed under the release gate, then run authenticated upload, reload, preview, download, delete, and retest smoke against synthetic data. Validate the private bucket policies and schedule the reconciliation script for pending/tombstoned objects before considering remote delivery complete.
- The remote migration and authenticated storage smoke remain pending separate authorization. Human review remains pending until the exact release candidate and remote dependencies are resolved.
