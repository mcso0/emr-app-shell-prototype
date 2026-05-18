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
- In final result reviews, start with a brief non-developer explanation of what changed and why it matters before listing technical details.
- Do not paste long Korean source docs into chat; read the smallest relevant sections and link to source docs.

## Work Routing

- Before PR-scoped work, check `docs/work/index.md` and reuse an existing item when possible.
- Route planning, docs, and work-management changes through `docs/_meta/intake-rules.md`.
- Follow `docs/_meta/coding-discipline.md` for non-trivial implementation work.
- After meaningful work, update affected source docs/work items and add a `docs/completed/` closeout when useful.
- Give the final result review using `docs/_meta/result-review-rules.md`.

## Core Safety

- Keep changes inside the user request and active work item scope.
- Do not treat client-only permission gating as complete security.
- Do not implement live Supabase validation, migrations, RLS, or server enforcement unless explicitly scoped.
- For OpenAI, Codex, or API questions, use official OpenAI docs or configured Docs MCP and cite sources.
