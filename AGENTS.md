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

## Token Budget Discipline

- Keep startup and routing reads bounded. Prefer `rg` and small `sed` ranges over full-file output for large docs, work indexes, logs, generated files, and test output.
- Load skills only when the user names them or the task clearly requires them. Avoid opening broad reference folders unless blocked.
- For token-budget investigations, report high-output commands and files before making changes, then trim the recurring source of overhead.

## Core Safety

- Keep changes inside the user request and active work item scope.
- Do not treat client-only permission gating as complete security.
- Do not implement live Supabase validation, migrations, RLS, or server enforcement unless explicitly scoped.
- If a prohibited or approval-gated action is the correct or necessary path for the active work, do not work around it with a weaker solution. Stop, explain why the gated action is needed, and ask the user for explicit approval before proceeding.
- For OpenAI, Codex, or API questions, use official OpenAI docs or configured Docs MCP and cite sources.
- For external API/SDK/library coding, use the repo-local `context-hub-docs-router` skill when available; treat Context Hub (`chub`) as an optional agent documentation tool, not an app dependency.
