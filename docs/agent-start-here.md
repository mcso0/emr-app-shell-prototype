# Agent Start Here

Use this file as the compact routing guide for new chats, sub-agents, and future Codex sessions.

## Agent Compact Summary

- Current target: Product MVP.
- The app is a session-only frontend prototype for veterinary EMR workflows from reception through billing.
- Live DB/API persistence, live Supabase validation, migrations, RLS, and server-side permission enforcement are not complete.
- Use concise English for agent-facing plans, searches, and handoff notes. Reply to the user in Korean unless they ask otherwise.
- Read only the smallest relevant source-doc sections needed for the task.

## Current Required Reading

1. `AGENTS.md`
2. `docs/engineering/current-status.md`
3. The active Linear issue or `docs/work/` item for the task
4. `docs/_meta/agent-rag-map.md` to choose only the task-specific source docs needed next

For docs, planning, or work-routing changes, also read:

- `docs/README.md`
- `docs/_meta/README.md`
- `docs/_meta/intake-rules.md`
- `docs/work/index.md`

For auth, Supabase, permission, or RLS work, also read:

- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/README.md`
- The relevant auth-login work order or status document

Do not read `docs/archive/**`, `docs/completed/**`, long history logs, or unrelated work items by default. Open them only when the active issue or `docs/_meta/agent-rag-map.md` calls for them.

## Current Product Target

The active target is Product MVP. The prototype already covers the outpatient flow from reception through billing, but live DB/API persistence, server-side permission enforcement, migration/RLS, and live Supabase validation are not complete.

## Current Guardrails

- Do not treat client-only permission gating as complete security.
- Do not implement live Supabase project validation, migrations, RLS, or server enforcement unless a work item explicitly scopes it.
- If a prohibited or approval-gated action is the better or necessary implementation path, do not route around it with a weaker workaround. Stop, state the required gated action and the reason, then ask 승욱 for explicit approval before continuing.
- Before DB structure or migration work, check `docs/work/` issue docs and relevant `docs/product/` or `docs/engineering/` data-contract docs first.
- For screen work, check the reference screen index and actual image existence before claiming pixel-level alignment.
- For Next.js application code, read the relevant `node_modules/next/dist/docs/` guide first.

## How To Start Work

1. Find or create the PR-sized work item in `docs/work/`.
2. Confirm the PR creation gate from `docs/README.md`.
3. Use `docs/_meta/agent-rag-map.md` to pick the smallest task-specific source docs.
4. Route planning or docs changes through `docs/_meta/intake-rules.md`.
5. Keep changes inside the work item's scope.
6. Run the work item's verification commands.
7. Update the work item and any affected source-of-truth docs.
8. Add a closeout under `docs/completed/` when the work item calls for one.
9. Give the user a concise result review using `docs/_meta/result-review-rules.md`.

## Manual Linear Compact Rules

For Linear requests, prefer `$manual-linear-ops` when available. If the skill is unavailable, use these compact rules. Read `docs/engineering/agent-orchestration/manual-linear-operations.md` only when project placement, multi-Codex coordination, Rework/Done handling, PR grouping, or security/DB/payment scope is ambiguous.

- Keep `DEN` as the Linear team key; manage work order through title prefixes like `00-01` and `01-01`.
- Ask the representative before creating a new project, moving work between projects, adding milestones, or choosing between a new project and an existing one.
- Default to one Linear issue, one Codex owner, one branch, and one PR.
- Stop meaningful issue work at `Human Review`; move to `Done` only when the representative explicitly accepts or asks.
- Create Korean HTML reports for meaningful Linear issue work; skip heavy reports for tiny typo/link/wording fixes.
- Do not enter live Supabase, DB migration, RLS, payment/subscription, email delivery, production deploy, or role/permission policy changes without explicit approval.
- If that gated scope is needed to solve the issue correctly, pause the workaround path and request explicit approval with the target environment and operation named.

## Current Recommended Work

Start from `docs/work/index.md`. If no ready item matches the user's request, search existing work items before adding to `docs/work/inbox.md`.
