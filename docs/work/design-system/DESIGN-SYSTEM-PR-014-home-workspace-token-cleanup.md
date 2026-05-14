---
id: "DESIGN-SYSTEM-PR-014"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 14"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-013-profile-drawer-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-013"
updated: "2026-05-14"
---

# Home Workspace Semantic Token Cleanup

## Goal

Convert the home dashboard, kanban workspace, and related home widgets' remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/features/home/**`.
- Change dashboard shells, widget cards, flow summaries, alert panels, task rows, kanban tabs, filters, progress bars, and status badges to semantic/EMR color tokens.
- Add focused source audit coverage so future home workspace work does not reintroduce direct local color tokens.
- Preserve existing home navigation, role dashboard copy, kanban filters, mock workflow data, and session-only behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing primary feature screens already cleaned up.
- Changing auth/login or other residual screens outside home workspace files.
- Changing live DB/API, Supabase, permissions, persistence, migrations, RLS, profile workflow enforcement, or server enforcement.
- Broad home workflow redesign or shared primitive API changes.

## Done When

- The home workspace source audit in `tests/design-tokens.spec.ts` passes for scoped `src/features/home/**` files.
- Semantic status meaning is preserved: danger/urgent remains danger, delayed/warning remains warning, info/selected remains info/selected, and neutral surfaces stay neutral.
- Focused home workspace verification passes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/home.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-014-home-workspace-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-home-workspace-token-cleanup.md`.
