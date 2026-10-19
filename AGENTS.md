# Repository Agent Contract

## Task Context

- Use `docs/agent-start-here.md` when choosing a reading path. A typo, local explanation, or isolated fix does not require the full startup stack.
- Read `docs/engineering/current-status.md` when product scope, module status, mock/live boundaries, data, permissions, or release readiness affect the task. Use the active work item for exact current evidence.
- For changes that depend on Next.js APIs, configuration, routing, rendering, caching, or framework behavior, read the relevant installed guide in `node_modules/next/dist/docs/`. Unrelated copy or styling edits do not require it.
- Search `docs/work/index.md` before PR-sized work and reuse an existing item. Do not create work items for ordinary questions or tiny one-off fixes.
- Use `docs/_meta/agent-rag-map.md` only when the owning source docs are unclear. Read the relevant sections, not every link.

## Project Boundaries

- Preserve user WIP, existing data/API/interaction contracts, and unrelated work. State the intended scope before non-trivial implementation.
- Client-only permission gating is not complete security. Preserve server/API/DB/RLS enforcement, workspace isolation, audit, and data integrity.
- Synthetic/demo Supabase, migration/RLS, persistence, and production-demo work must be explicitly scoped in an active approved work item. A work item alone grants no new permission for remote actions.
- Follow existing authorization for the same operation, target, and scope. Stop for missing approval before meaningful cost, secrets/security exposure, security weakening, private asset publication, real customer/patient/guardian/payment/identity data, destructive or hard-to-rollback remote changes, real communications/payment/provider side effects, or real external-user launch.
- Canonical role/permission policy changes require explicit approval. For CI/CD, Preview, production, `main` merge, and alias work, use `.agents/skills/release-deployment-ops/SKILL.md` and `docs/engineering/operations/release-environment-policy.md`; retain candidate, verification, approval, smoke, and rollback gates.
- Use the public-repository CI/CD contract: automatic PR Release Check is the default, with latest-candidate evidence, strict main protection, Ready Preview, and focused behavior checks. Manual dispatch is a fallback, not a mandatory duplicate. Do not infer remote configuration from policy text; read the active release work item and verify live state.
- Reuse explicit merge/Production approval, including conditional approval for a named PR or bounded task once its conditions pass. Record the final SHA and protect the merge against head changes; do not ask again merely because verification finished. SHA-pinned approval covers only that SHA. Reconfirm only missing/ambiguous authority or a material change in scope, behavior, cost, data/security impact, or operation. A no-merge/no-Production instruction remains binding.
- Preview is not proof of an isolated or synthetic-only database. Confirm its data/provider boundaries and current usage before enabling automation; do not create paid resources or change plans without explicit approval.
- If a gated action is required for correctness, finish authorized preparation and explain the exact remaining action. Do not substitute a weaker workaround.
- Ordinary requested reviews authorize read-only inspection. Use the separate Safety OS intake-and-approval flow only for an explicit gate request.

## Implementation And Completion

- Use `docs/_meta/coding-discipline.md` for non-trivial implementation; preserve focused checks for security, data integrity, accessibility, and release boundaries.
- Complete the requested behavior, relevant verification, and fixes for failures caused by the change. Update owning docs only when behavior, contracts, status, or durable decisions changed.
- When changing UI, update related Storybook stories, fixtures, and tests as needed in the same change, and verify the affected stories against actual app usage.
- Record unrelated findings separately in the existing work item or final report. Do not expand the task scope or fix them without separate authorization.
- Use `docs/_meta/intake-rules.md` for documentation/work-structure or durable-guidance changes, and `docs/_meta/result-review-rules.md` for completion and report depth.
- `Human Review` records pending human acceptance after authorized implementation and verification; it does not cancel remaining work already authorized in the same objective.

## Tools And Agents

- Preserve the user-selected parent model and reasoning effort, including Plan mode. Keep existing configuration outside this guidance change; do not claim runtime changes from file edits.
- Keep specialist role configuration in `.codex/agents/`. Apply `.agents/skills/subagent-decision/SKILL.md` before dispatch: smallest useful read-only delegation, maximum four open spawned agents across the task tree excluding the parent; parallel implementation requires explicit user request and clear ownership.
- For shared UI work, query component documentation through project-scoped `clair_storybook` when local Storybook is running. Do not invent props or variants. Keep its endpoint local and do not publish or tunnel it without explicit approval.
- For external API/SDK/library implementation, use `.agents/skills/context-hub-docs-router/SKILL.md`; Context Hub is an optional documentation tool, not an app dependency. Use official OpenAI docs for OpenAI/Codex questions.
- Prefer targeted `rg` and bounded reads for docs, logs, generated files, and tests. Load a skill only when explicitly invoked or its specific workflow applies. Report high-output sources before changing token-related settings.
