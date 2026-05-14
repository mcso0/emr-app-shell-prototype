---
id: "DESIGN-SYSTEM-PR-017"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 17"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-016-shell-chrome-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-016"
updated: "2026-05-14"
---

# Shared EMR Components Semantic Token Cleanup

## Goal

Convert the remaining direct Clair/local color usage in shared EMR secondary components to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in shared EMR components under `src/components/emr/**`.
- Change shared content history, order queue side panel/summary, patient context bar, subpanel list, and EMR data table text/status fallback colors to semantic/EMR aliases.
- Add focused source audit coverage so shared EMR component work does not reintroduce direct local color tokens.
- Preserve feature behavior, interaction semantics, table selection/editing behavior, queue grouping, session-only mock behavior, and status color meaning.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing feature screen behavior or session-only data flows.
- Changing auth/login behavior, live Supabase validation, package/env setup, DB/API persistence, migrations, RLS policies, or server permission enforcement.
- Cleaning `src/components/ui/**`, PWA manifest/theme metadata, generated icon assets, or demo-only button gallery in this PR.
- Redesigning shared EMR component layout, density, animation, or accessibility behavior.

## Done When

- The shared EMR component source audit in `tests/design-tokens.spec.ts` passes for scoped shared EMR files.
- Status semantics are preserved: fallback queue status remains neutral, diff current values remain warning, canceled rows remain muted/line-through, and selection surfaces remain neutral.
- Existing related feature/shell tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/customer.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-017-shared-emr-components-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-shared-emr-components-token-cleanup.md`.
