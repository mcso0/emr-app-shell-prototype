---
id: "DESIGN-SYSTEM-PR-016"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 16"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-015-auth-login-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-015"
updated: "2026-05-14"
---

# Shell Chrome Semantic Token Cleanup

## Goal

Convert the app shell chrome and global command palette's remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/shell/app-shell.tsx`, `src/shell/nav-rail.tsx`, and `src/shell/global-command-palette.tsx`.
- Change app shell background, nav rail shell/active/avatar/divider states, and global command trigger/dialog/keyboard/result-row surfaces to semantic/EMR color tokens.
- Add focused source audit coverage so future shell chrome work does not reintroduce direct local color tokens.
- Preserve shell navigation, module URL query propagation, side panel collapse behavior, global command search/filter behavior, and dialog keyboard behavior.
- Update design-system work tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing feature screens already cleaned up.
- Changing auth/login behavior, live Supabase validation, package/env setup, DB/API persistence, migrations, RLS policies, or server permission enforcement.
- Cleaning shared `src/components/emr/**`, `src/components/ui/**`, PWA manifest/theme metadata, generated icon assets, or demo-only button gallery in this PR.
- Redesigning app shell layout or global command palette behavior.

## Done When

- The shell chrome source audit in `tests/design-tokens.spec.ts` passes for scoped shell files.
- Semantic status meaning is preserved: nav active states remain selected, profile status remains success, and shell/command surfaces remain neutral.
- Existing shell behavior tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts tests/auth.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-016-shell-chrome-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-shell-chrome-token-cleanup.md`.
