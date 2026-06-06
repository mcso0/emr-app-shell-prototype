---
id: DESIGN-SYSTEM-PR-045
status: human_review
area: design-system
priority: P1
target_pr: Project common UX/UI / DEN-434
created: 2026-06-06
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/global-feedback-ui-audit.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/component-ownership-rules.md"
dependencies:
  - "Linear project: 공통 UX/UI 기준 정리 및 화면 적용"
  - "DESIGN-SYSTEM-PR-044"
---

# DESIGN-SYSTEM-PR-045: Empty State And Info Box Contract

## Owner OS Route

- Task type: `docs` with `linear` secondary.
- Depth level: `L3` because this creates a source-of-truth design-system contract and repo work item.
- Autonomy level: `local_edit`; Linear status/comment updates are allowed only for the active issue.
- Approval gates: none for local docs. Remote Supabase, migration, RLS, server enforcement, production deploy, real data, payment, email, provider integration, and role/permission policy changes remain forbidden.
- Subagent policy: none. The scope is narrow enough for direct work.

## Goal

Define how CLAiR EMR distinguishes `Empty state` and `Info box` patterns so dense clinical screens do not confuse no data, no results, permission/scope boundaries, loading, errors, system boundaries, and passive guidance.

## Scope

- Review existing feedback, empty, alert, and design-system source docs.
- Add a canonical empty/info state contract under `docs/design/system/`.
- Update design-system navigation and changelog entries.
- Link the work item from `docs/work/index.md`.
- Create a Korean completion report for Linear `DEN-434`.

## Out Of Scope

- Application code changes.
- Applying empty/info patterns across all screens.
- Creating new shared React components.
- Actual permission/server security policy changes.
- DB/API error handling contract changes.
- live DB, Supabase, migration, RLS, server enforcement, production deploy, real data, payment, email, provider integration, or role/permission policy work.

## Done Criteria

- `docs/design/system/empty-info-state-contract.md` defines empty state types, info box types, copy rules, visual rules, ownership rules, and implementation acceptance criteria.
- `docs/design/system/DESIGN.md` points future agents to the new contract.
- `docs/design/system/README.md`, `docs/design/changelog.md`, and `docs/work/index.md` reference the work.
- A Korean HTML report is saved under `docs/completed/design/`.
- Linear `DEN-434` can move to Human Review with the docs path, verification result, and follow-up recommendations.

## Verification

- Passed: `npm run docs:check`

No frontend lint, typecheck, or browser visual QA is required because this issue changes docs only.

## Handoff Notes

- Empty states must name the missing object and next useful action when one exists.
- Info boxes are passive/contextual unless risk or recovery makes `EmrInlineAlert` the right primitive.
- Enabled actions inside empty/info states use E1 click affordance from the DEN-433 contract.
- Report: `docs/completed/design/2026-06-06-den-434-empty-info-state-contract-report.html`
