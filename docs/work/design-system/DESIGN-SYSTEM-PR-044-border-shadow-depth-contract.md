---
id: DESIGN-SYSTEM-PR-044
status: done
area: design-system
priority: P1
target_pr: Project common UX/UI / DEN-433
created: 2026-06-06
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/design/system/arbitrary-value-token-audit.md"
  - "docs/design/system/component-ownership-rules.md"
dependencies:
  - "Linear project: 공통 UX/UI 기준 정리 및 화면 적용"
---

# DESIGN-SYSTEM-PR-044: Border And Shadow Depth Contract

## Owner OS Route

- Task type: `docs` with `linear` secondary.
- Depth level: `L3` because the work creates a source-of-truth design-system contract and a repo work item.
- Autonomy level: `local_edit`; Linear status/comment updates are allowed only for the active issue.
- Approval gates: none for local docs. Remote Supabase, migration, RLS, server enforcement, production deploy, real data, payment, email, provider integration, and role/permission policy changes remain forbidden.
- Subagent policy: none. The scope is narrow enough for direct work.

## Goal

Define where CLAiR EMR uses borders, line strength, radius, and shadow depth so later queue, patient info bar, SOAP, tab, table density, empty state, and info box issues can apply one shared visual contract.

## Scope

- Audit the existing design-system docs and current EMR token aliases for border, radius, surface, and shadow usage.
- Add a canonical border/shadow depth contract under `docs/design/system/`.
- Update design-system navigation and changelog entries.
- Link the work item from `docs/work/index.md`.
- Create a Korean completion report for Linear `DEN-433`.

## Out Of Scope

- Application code changes.
- Full screen refactors.
- New token implementation in `src/styles/tokens/emr-foundation.css`.
- Editing generated `src/styles/tokens/clair.css` or `src/styles/tokens/shadcn.css`.
- live DB, Supabase, migration, RLS, server enforcement, production deploy, real data, payment, email, provider integration, or role/permission policy work.

## Done Criteria

- `docs/design/system/border-shadow-depth-contract.md` defines line, radius, shadow depth, surface mapping, prohibited patterns, and implementation acceptance criteria.
- `docs/design/system/DESIGN.md` points future agents to the new contract.
- `docs/design/system/README.md`, `docs/design/changelog.md`, and `docs/work/index.md` reference the work.
- A Korean HTML report is saved under `docs/completed/design/`.
- Linear `DEN-433` can move to Human Review with the docs path, verification result, and follow-up recommendations.

## Verification

- Passed: `npm run docs:check`

No frontend lint, typecheck, or browser visual QA is required because this issue changes docs only.

## Handoff Notes

- Follow-up implementation issues should treat in-flow UI as flat by default and reserve shadows for floating or overlay surfaces.
- Enabled action surfaces should use the lowest E1 shadow as click affordance. Keep read-only information rows/cards flat.
- Selected and active rows/cards should not use side rails or inset stripe markers; use selected surface and full border instead.
- The contract intentionally does not add new EMR elevation tokens. Add them only in a scoped implementation issue after the repeated role is proven.
- Report: `docs/completed/design/2026-06-06-den-433-border-shadow-depth-contract-report.html`
