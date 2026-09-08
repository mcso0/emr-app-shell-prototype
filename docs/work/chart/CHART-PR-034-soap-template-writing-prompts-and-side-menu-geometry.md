---
id: "CHART-PR-034"
status: "implemented"
area: "chart"
priority: "P1"
target_pr: "PR #703"
source_docs:
  - "docs/work/chart/CHART-PR-030-blocknote-soap-live-persistence.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/qa/interaction-accessibility-audit.md"
dependencies:
  - "CHART-PR-030"
updated: "2026-09-03"
---

# Editable SOAP Writing Prompts And Side-Menu Geometry

## Goal

Make the existing BlockNote SOAP editor easier to start and safer to operate without adding a new template UI, block type, field, or persistence path.

## Approved Scope

- Put concise, directly editable veterinary writing prompts into the existing S/O/A/P paragraph blocks used by a new note, reset, and the default slash-menu template.
- Keep the existing four `soapSection` blocks and one paragraph per section.
- Hide only the indentation guide drawn for a SOAP section's direct child block.
- Expand the grab control from 16x24px to 24x24px while preserving the existing 8px gap to the writing block.
- Preserve deeper nested-block guides, add/drag/menu behavior, legacy-note hydration, and the canonical BlockNote document contract.

## Out Of Scope

- New template selectors, chips, structured clinical fields, autocomplete, AI, or placeholder APIs.
- Schema, API, RPC, database, permission, autosave, conflict, audit, or downstream projection changes.
- Prefilled claims such as `WNL`, `normal`, or `이상 없음` that could be mistaken for observed findings.
- Changes to system-specific templates such as the musculoskeletal template.

## Research Basis

- University of Wisconsin Veterinary Medical Teaching Hospital, *SOAP Writing Guide*: S/O/A/P content, problem list, differentials, diagnostic plan, and treatment plan.
- University of Minnesota, *Client Encounters*: history and client communication context.
- College of Veterinarians of Ontario, *Medical Records Guide to the Standard*: concise and complete problem, assessment, plan, and client-communication records.
- Australian Small Animal Veterinarians, *Manual of Hospital Standards and Accreditation*: problem-oriented records using SOAP or HEAP.

## Done Criteria

1. New/reset/default-template S/O/A/P paragraphs contain the approved editable prompts.
2. Existing note content remains unchanged when hydrated.
3. Direct SOAP child guides do not intersect the add/grab controls; deeper nested guides remain visible.
4. Add and grab controls are both 24x24px and keep 8px clearance from the writing block.
5. The sectioned template remains editable and does not overflow at 320, 420, 566.5, or 720px.
6. Focused tests, lint, typecheck, build, Storybook build, docs check, secret scan, and diff check pass before release.

## Verification Plan

- Focused SOAP document unit test for prompt hydration and no prefilled normal findings.
- Focused Storybook browser tests for direct-child guide suppression, deeper guide preservation, 24px controls, editable content, and responsive widths.
- Existing SOAP Storybook interaction suite and relevant chart regression tests.
- Standard production preflight and exact-candidate manual Release Check.

## Verification Evidence

- `npx playwright test tests/chart-soap-document.spec.ts`: 8 passed.
- Focused `tests/chart.spec.ts` SOAP editor, slash menu/template, and growing-content checks: 4 passed.
- `npx vitest --project=storybook --run src/features/chart/components/chart-soap-live-block-editor.stories.tsx`: 35 passed.
- Focused ESLint and `npx tsc --noEmit`: passed before the final release preflight.
- Final production preflight, exact-candidate `Release Check`, PR merge, deployment readiness, and production smoke are recorded on PR #703 and in the final release result.

## Result Report

- `docs/completed/chart/2026-09-03-chart-soap-writing-prompts-geometry-report.html`

## Rollback

- Revert the application commit and redeploy the previous production deployment.
- No database or persisted schema rollback is required.

## Follow-up: Compact Grab Control (2026-09-06)

User-approved geometry supersedes the original 24px grab width and 8px writing-block gap above:

- Add control remains 24x24px; grab control becomes 18x24px with the existing 14x14px icon and vertical alignment.
- Controls retain their 2px gap, for a total menu width of 44px.
- Menu-to-block clearance becomes 4px for both SOAP sections and ordinary blocks.
- Editable left padding becomes 56px: 8px outer clearance + 44px controls + 4px block gap.
- Existing Storybook geometry checks cover the revised width, outer clearance, and paragraph gap, including SOAP sections at 320, 420, 566.5, and 720px.
- Focused SOAP Storybook suite: 35 passed. Local secret scan, docs links, lint, typecheck, and production build passed. Release evidence belongs in the follow-up PR.

## 2026-09-08 Local Follow-up: Empty Default Template

- User requested the basic S/O template to show only the four section headings and empty input paragraphs, matching the diagnosis-system layout. This supersedes the writing-prompt requirement above for new/reset/default-template content.
- Default prompt values are now empty. Existing persisted notes and explicitly requested sample templates retain their content; no stored notes are rewritten.
- On editor initialization, move a leading SOAP section's node selection to its first paragraph using BlockNote 0.54.0 `setTextCursorPosition`, without calling focus. The initialization guard preserves subsequent user selections.
- Verified: SOAP document tests 11/11, editor Storybook browser tests 35/35, and focused ESLint. Browser coverage includes no initial selected-node highlight or editor focus, empty paragraphs, direct typing, and responsive widths.
- Release scope approved by the user on 2026-09-08: commit, push, PR, merge to `origin/main`, and Production deployment after passing checks. Candidate contains only this follow-up plus its focused tests.
- Clean `origin/main` worktree verification: SOAP document/chart tests 20/20; Storybook browser tests 35/35; lint, typecheck, UX copy, docs, and secret checks passed. Initial shared-dependency symlink failed tooling startup; independent `npm ci` resolved it. The toolbar test now explicitly selects paragraph text rather than clicking the editor background.
- Production smoke: `/login`, scoped Cheongdam chart load and initial selection display. No clinical content is entered or rewritten in Production.
- Rollback reference: previous main `8df4fc0436f9d81f024cc1faeb54f9943d5f2acf`, Ready deployment `dpl_ExjiykEPAHpiaEeQyuzPT3TkQW1t`. Stop if exact-candidate checks or deployment readiness fail. Exact release SHA, remote checks, and delivery evidence are recorded in the PR.
