---
name: codex-agent-router
description: Use when the user asks Codex to choose, route, spawn, or coordinate custom subagents automatically, especially for Korean requests like "에이전트 골라서 써", "서브 에이전트로 나눠", "Spark로 먼저 조사", "모델 나눠서 작업", or "내가 에이전트 이름 기억 안 해도 되게". This skill maps the task to project custom agents under .codex/agents and asks the parent Codex agent to spawn the right ones before implementation.
---

# Codex Agent Router

Use this skill to let 승욱 request agent routing without memorizing custom agent names.

## Core Rule

When the user asks to use appropriate subagents, model-split work, or avoid naming agents manually:

1. Classify the task.
2. Choose the smallest useful set of project custom agents from `.codex/agents/`.
3. Ask Codex to spawn those agents explicitly and wait for summaries.
4. Keep implementation in the parent thread unless the user explicitly asks for parallel implementation.
5. Return a concise Korean summary to 승욱.

Do not spawn subagents automatically for tiny one-step answers. Subagents cost extra tokens and are most useful for read-heavy exploration, tests, triage, summarization, and independent review.

## Project Agent Roster

- `spark-explorer`: fast read-only exploration with `gpt-5.3-codex-spark`; use first for file mapping, impact analysis, rough risk spotting, and task decomposition.
- `security-boundary-reviewer`: high-reasoning read-only review with `gpt-5.5`; use for auth, workspace scope, permissions, Supabase, RLS, migrations, audit, live-data boundaries, billing integrity, and gated actions.
- `test-triage`: focused verification triage with `gpt-5.4-mini`; use for failing logs, narrow verification commands, regression coverage, and flake separation.

## Routing Matrix

Use `spark-explorer` when:

- the task is broad or the relevant files are unclear
- 승욱 asks for quick investigation, mapping, scoping, or model-split work
- a large repo/document area needs summarization before edits

Use `security-boundary-reviewer` when the task mentions or implies:

- auth, login, sessions, membership, roles, permissions, workspace boundaries
- Supabase, DB, RLS, migrations, live persistence, audit logs
- payment, billing amount integrity, real data, provider integrations, production

Use `test-triage` when the task involves:

- failing tests, logs, CI/build/lint/typecheck output
- deciding which tests to run
- adding or reviewing regression coverage
- flake or environment-specific failures

Use multiple agents only when the work benefits from independent perspectives. Good combinations:

- broad implementation task: `spark-explorer` first, then parent implements
- auth/DB/security task: `spark-explorer` plus `security-boundary-reviewer`; parent waits before edits
- failure after changes: `test-triage`, and add `security-boundary-reviewer` if boundary-sensitive
- pre-merge review: `security-boundary-reviewer` plus `test-triage`

## Invocation Pattern

When routing is useful, form the instruction like this:

```text
Spawn <agent-name> first. Have it inspect the relevant files read-only and return only:
1. relevant files
2. likely change points
3. risks/gates
4. verification needs

Wait for the summary before implementing in the parent thread.
```

For multiple agents:

```text
Spawn <agent-a> and <agent-b> in parallel. Keep both read-only. Wait for both summaries, then synthesize the result before implementation.
```

If the current Codex surface cannot invoke named custom agents directly, use the closest available generic subagent type and include the selected `.codex/agents/<name>.toml` instructions in the subagent prompt.

## Safety Defaults for CLAiR EMR

- Keep `spark-explorer` read-only.
- Do not let Spark make final security, DB/RLS, production, or clinical-data decisions.
- Keep parallel write-heavy work off by default.
- If an approval-gated action is required, stop and ask 승욱 for explicit approval instead of routing around the gate.
- Final implementation and verification stay in the parent thread unless 승욱 explicitly asks otherwise.

## User-Facing Summary

Before spawning agents, briefly tell 승욱 which agents you chose and why:

```text
승욱, 이건 <작업 유형>이라 <agent-a>로 먼저 조사하고, <agent-b>로 위험 경계를 확인하는 게 좋아. 둘 다 read-only로 돌리고 요약을 받은 뒤 메인 스레드에서 구현할게.
```
