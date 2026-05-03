<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:karpathy-agent-rules -->
# Karpathy-inspired coding discipline

Behavioral guidelines to reduce common LLM coding mistakes. These guidelines bias toward caution over speed; for trivial one-line tasks, use judgment.

## 1. Think Before Coding

Do not assume. Do not hide confusion. Surface assumptions and tradeoffs.

Before implementing:

- State material assumptions explicitly when the request is ambiguous.
- If multiple interpretations would lead to different code, present them instead of silently choosing one.
- If a simpler approach exists, say so and push back when warranted.
- If something is unclear enough to affect implementation, stop and ask.

## 2. Simplicity First

Use the minimum code that solves the problem. Add nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility, configurability, or future-proofing that was not requested.
- No broad error handling for impossible or unsupported scenarios.
- If a smaller direct implementation would solve the same task, prefer it.

Ask yourself: would a senior engineer say this is overcomplicated? If yes, simplify.

## 3. Surgical Changes

Touch only what the task requires. Clean up only the mess created by your own changes.

When editing existing code:

- Do not improve adjacent code, comments, formatting, or naming as a side effect.
- Do not refactor unrelated code.
- Match the existing style, even if you would design it differently.
- If you notice unrelated dead code or design issues, mention them instead of changing them.

When your changes create unused imports, variables, functions, or files, remove those. Do not remove pre-existing unused code unless asked.

Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" becomes "write tests for invalid inputs, then make them pass."
- "Fix the bug" becomes "write a test that reproduces it, then make it pass."
- "Refactor X" becomes "ensure tests pass before and after."

For non-trivial changes:

- Define success criteria before editing.
- Prefer a test or focused reproduction for bug fixes.
- Verify with the narrowest useful command first, then broaden when risk requires it.
- Report what was verified and what could not be verified.
<!-- END:karpathy-agent-rules -->

<!-- BEGIN:emr-mvp-agent-rules -->
# EMR MVP working context

Before starting repository work, read `docs/agent-start-here.md` first, then `docs/engineering/current-status.md`. Treat `docs/engineering/current-status.md` as the current source of truth for MVP scope, completed PRs, mock/no-op boundaries, preserved screens, and the recommended next work.

Work is managed in repo docs. Before creating or starting PR-scoped work, check `docs/work/index.md`, reuse an existing work item when possible, and summarize the PR gate: goal, PR-sized scope, out-of-scope items, done criteria, source docs, verification, status/dependencies, and duplicate check. If the work is still vague, put it in `docs/work/inbox.md` instead of creating an execution item.

After completing work, update the relevant work item and source-of-truth docs. When the work has implementation or decision value, add or update the appropriate closeout under `docs/completed/`.

Preserve the current 조제/처치 screen design and behavior unless the user explicitly asks to change it. 입원 and full 병원관리 screens are outside the completed PR 1-6 scope, and 병원관리 Order 관리 / Order 세트 references are not implementation targets unless a new plan explicitly includes them.

For screen work, also check `docs/design/reference-screen-index.md` and confirm whether the referenced image files actually exist under `docs/design/assets/reference-screens/`. If binary reference images are missing, do not claim pixel-level alignment.

<!-- END:emr-mvp-agent-rules -->
