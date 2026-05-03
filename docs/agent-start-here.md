# Agent Start Here

Use this file as the short routing guide for new chats, sub-agents, and future Codex sessions.

## Current Required Reading

1. `AGENTS.md`
2. `docs/engineering/current-status.md`
3. `docs/README.md`
4. `docs/_meta/README.md`
5. `docs/_meta/intake-rules.md`
6. `docs/work/index.md`
7. The specific work item for the task

For auth, Supabase, permission, or RLS work, also read:

- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/README.md`
- The relevant auth-login work order or status document

## Current Product Target

The active target is Product MVP. The prototype already covers the outpatient flow from reception through billing, but live DB/API persistence, server-side permission enforcement, migration/RLS, and live Supabase validation are not complete.

## Current Guardrails

- Preserve the current 조제/처치 screen unless the user explicitly asks to change it.
- Do not treat client-only permission gating as complete security.
- Do not implement live Supabase project validation, migrations, RLS, or server enforcement unless a work item explicitly scopes it.
- For screen work, check the reference screen index and actual image existence before claiming pixel-level alignment.
- For Next.js application code, read the relevant `node_modules/next/dist/docs/` guide first.

## How To Start Work

1. Find or create the PR-sized work item in `docs/work/`.
2. Confirm the PR creation gate from `docs/README.md`.
3. Route planning or docs changes through `docs/_meta/intake-rules.md`.
4. Read the work item's source docs.
5. Keep changes inside the work item's scope.
6. Run the work item's verification commands.
7. Update the work item and any affected source-of-truth docs.
8. Add a closeout under `docs/completed/` when the work item calls for one.
9. Give the user a concise result review using `docs/_meta/result-review-rules.md`.

## Current Recommended Work

Start from `docs/work/index.md`. If no ready item matches the user's request, search existing work items before adding to `docs/work/inbox.md`.
