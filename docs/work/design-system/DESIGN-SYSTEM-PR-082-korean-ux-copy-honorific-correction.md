---
id: "DESIGN-SYSTEM-PR-082"
status: human_review
area: design-system
priority: P1
target_pr: "User request / Korean UX copy honorific correction"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
updated: 2026-07-23
---

# Korean UX Copy Honorific Correction

## Goal

Remove informal Korean speech from user-facing CLAiR EMR product copy without
changing workflow behavior, permissions, data, or the broader UX writing
system.

## Scope

- Add the temporary Korean honorific baseline to the canonical design-system
  source.
- Audit static and dynamic user-facing copy under `src/app`, `src/features`,
  `src/shell`, shared EMR component examples, and displayed mock/system
  content.
- Rewrite confirmed informal statements, requests, errors, restrictions, and
  confirmation questions using the approved honorific baseline.
- Update tests that assert the corrected accessible text.
- Add a dependency-free source check that blocks clear informal product-copy
  endings from being reintroduced.

## Out Of Scope

- Normalizing all existing polite `해요체` copy to `합니다체`.
- Defining the complete CLAiR EMR UX writing system, terminology dictionary,
  sentence-length rules, or clinical wording policy.
- Rewriting staff-authored notes, clinical records, or synthetic fixtures that
  represent authored clinical content.
- Changing API error codes, permission behavior, mock/live boundaries,
  persistence, navigation, or interaction flow.
- Refactoring adjacent components or modifying unrelated user-owned worktree
  changes.

## Inventory Baseline

The fresh `origin/main` source scan found 159 line-level candidates across 23
source files. Each candidate was reviewed by source role before editing.

Highest-volume areas:

- hospital-admin schedule, including the v1 and v2 revision flows
- reception
- chart
- demo-session reset
- shared inline-alert examples
- billing

## Done Criteria

- User-facing product copy contains no unreviewed clear informal endings in the
  audited source scope.
- Confirmed informal copy uses `합니다체`, `~해 주세요`, or
  `~하시겠습니까?` according to sentence role.
- User-authored and clinical-content fixtures remain unchanged.
- Existing polite `해요체` outside the confirmed informal sentences remains
  unchanged.
- Exact-text tests match the corrected accessible copy.
- The honorific source check, lint, type check, build, docs check, secret scan,
  and whitespace check pass.
- Focused tests pass, or a failure is reproduced unchanged on the clean
  `origin/main` baseline and recorded as a pre-existing blocker.

## Verification

- `npm run ux-copy:check`
- focused unit and Playwright tests for corrected exact-text assertions
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Verification Results

- Passed `npm run ux-copy:check`.
- Passed `npx tsc --noEmit`.
- Passed `npm run lint`.
- Passed `npm run docs:check`.
- Passed `npm run security:secrets`.
- Passed `git diff --check`.
- Passed `npm run build`.
  - The existing broad NFT source-path tracing warning for the docs reader
    remains non-blocking; the build completed successfully.
- Focused Playwright run: 14 passed, 1 failed.
  - The failing reception card-action test times out while reopening the menu
    after Escape, before it reaches the corrected copy assertion.
  - The same test fails at the same line on the clean `origin/main`
    `296089d2` baseline, so it is not a regression from this copy-only change.

## Handoff Notes

The Korean result report is
`docs/completed/design/2026-07-23-korean-ux-copy-honorific-correction-report.html`.
Broader UX writing principles remain a separate follow-up after this
honorific-only correction is reviewed.
