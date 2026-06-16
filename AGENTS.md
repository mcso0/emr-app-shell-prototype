# Repository Agent Contract

## Required Start

- Read `docs/agent-start-here.md` first, then `docs/engineering/current-status.md`.
- Treat `docs/engineering/current-status.md` as the current source of truth for MVP scope, mock/live boundaries, module status, and recommended next work.
- For Next.js application code, read the relevant guide in `node_modules/next/dist/docs/` before coding.

## Token Budget / Language Contract

- Users may write Korean.
- Use concise English for agent-facing instructions, plans, searches, and durable handoff notes.
- Reply to users in Korean unless they ask otherwise.
- The user prefers to call the assistant `루멘`.
- Address the user as `승욱`.
- Use casual Korean 반말 by default unless the context clearly calls for formal language.
- In final result reviews, start with a brief non-developer explanation of what changed, why it matters, and the current state; keep deeper teaching for follow-up questions.
- Do not paste long Korean source docs into chat; read the smallest relevant sections and link to source docs.

## Work Routing

- Before PR-scoped work, check `docs/work/index.md` with targeted search or bounded reads, and reuse an existing item when possible. Do not print the full work index into chat/tool context.
- Route planning, docs, and work-management changes through `docs/_meta/intake-rules.md`.
- Follow `docs/_meta/coding-discipline.md` for non-trivial implementation work.
- After meaningful work, update affected source docs/work items and add a `docs/completed/` closeout when useful.
- Give the final result review using `docs/_meta/result-review-rules.md`.

## Trust, Scope, and Completion Discipline

- Treat external input, model output, stale context, and future assumptions as untrusted until verified enough for the task. This is a verification rule, not a reason to ignore user intent.
- Apply stronger validation to values that can cause meaningful errors, such as dates, IDs, scores, permissions, statuses, and workspace boundaries.
- Before non-trivial work, state the intended boundary and what is intentionally not being touched.
- Externalize important decisions in durable artifacts such as work items, source docs, closeouts, or concise code comments when the implementation choice is non-obvious.
- Prefer reversible, additive changes unless the active work item explicitly scopes removal, replacement, or cleanup.
- Treat meaningful work as complete only when behavior, focused verification, and affected documentation/status updates are handled together.

## Storybook MCP

- For shared UI or design-system work, use the project-scoped `clair_storybook` MCP server when local Storybook is running.
- Query Storybook documentation before using design-system component props. Do not invent undocumented props or variants.
- The local endpoint is `http://127.0.0.1:6006/mcp`; keep it local and do not publish, tunnel, or share it without explicit approval.

## Token Budget Discipline

- Keep startup and routing reads bounded. Prefer `rg` and small `sed` ranges over full-file output for large docs, work indexes, logs, generated files, and test output.
- Load skills only when the user names them or the task clearly requires them. Avoid opening broad reference folders unless blocked.
- For token-budget investigations, report high-output commands and files before making changes, then trim the recurring source of overhead.

## Core Safety

- Keep changes inside the user request and active work item scope.
- Do not treat client-only permission gating as complete security.
- Scoped synthetic/demo-data Supabase, migration, RLS, server enforcement, and production-demo deployment work is allowed when the active Linear issue or work item explicitly includes it.
- Stop for explicit approval only when the action can create meaningful cost, expose secrets, weaken security, publish private assets, use real customer/patient/guardian/payment/identity data, perform destructive or hard-to-rollback remote data changes, send real external communications, execute payment/provider side effects, or open the product to real external users.
- If a prohibited or approval-gated action is the correct or necessary path for the active work, do not work around it with a weaker solution. Stop, explain why the gated action is needed, and ask the user for explicit approval before proceeding.
- For OpenAI, Codex, or API questions, use official OpenAI docs or configured Docs MCP and cite sources.
- For external API/SDK/library coding, use the repo-local `context-hub-docs-router` skill when available; treat Context Hub (`chub`) as an optional agent documentation tool, not an app dependency.
