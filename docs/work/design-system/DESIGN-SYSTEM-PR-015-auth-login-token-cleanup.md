---
id: "DESIGN-SYSTEM-PR-015"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 15"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/mvp-auth-transition-roadmap.md"
  - "docs/engineering/auth-security/auth-login/README.md"
  - "docs/engineering/auth-security/auth-login/status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-014-home-workspace-token-cleanup.md"
dependencies:
  - "DESIGN-SYSTEM-PR-003"
  - "DESIGN-SYSTEM-PR-014"
updated: "2026-05-14"
---

# Auth/Login Semantic Token Cleanup

## Goal

Convert the login/auth entry surfaces and auth shell controls' remaining direct Clair/local color usage to shadcn semantic tokens and EMR alias tokens.

## Scope

- Audit direct color usage in `src/app/login/page.tsx`, `src/features/auth/login-form.tsx`, `src/features/auth/auth-gate.tsx`, `src/shell/top-menu.tsx`, and `src/shell/auth-profile-menu.tsx`.
- Change login fallback/loading surfaces, login form panels, mock role/storage option states, provider error surface, mock session status panel, workspace selector, top menu icon buttons, and auth profile trigger/menu labels to semantic/EMR color tokens.
- Add focused source audit coverage so future auth/login UI work does not reintroduce direct local color tokens.
- Preserve `/login`, safe `next`, mock session storage, provider error, Supabase adapter boundary, top menu role display, and logout behavior.
- Update design-system/auth status tracking and completion docs.

## Out Of Scope

- Editing generated Clair token output.
- Changing primary feature screens already cleaned up.
- Changing live Supabase validation, package/env setup, callback routes, DB/API persistence, migrations, RLS policies, server permission enforcement, OAuth, MFA, refresh tokens, email verification, or password validation behavior.
- Redesigning login flow, auth provider behavior, or app shell navigation.
- Broad app chrome cleanup outside the scoped auth/profile controls.

## Done When

- The auth/login source audit in `tests/design-tokens.spec.ts` passes for scoped auth/login files.
- Semantic status meaning is preserved: provider errors remain danger, selected mock options remain selected/info, active user indicators remain success, and neutral surfaces stay neutral.
- Existing auth behavior tests pass.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/auth.spec.ts --reporter=line`

## Handoff Notes

Started from branch `codex/design-system-pr-015-auth-login-token-cleanup`.

Completed on 2026-05-14. Closeout: `docs/completed/design/2026-05-14-auth-login-token-cleanup.md`.
