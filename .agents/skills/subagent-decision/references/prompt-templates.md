# Subagent Decision Prompt Templates

Use these templates after `SKILL.md` selects a decision category. Replace bracketed values before use.

## Plan Validation Before Implementation

```text
Use read-only subagents to validate this plan before implementation.

Spawn these agents and wait for all summaries:
1. explorer
- Scope: [files/modules/domains]
- Permissions: read-only
- Output: relevant files, likely change points, dependencies, and missing context
2. risk_reviewer
- Scope: [risk areas]
- Permissions: read-only
- Output: edge cases, regression risks, unclear requirements, and test needs
3. docs_researcher
- Scope: [framework/library/API/project docs]
- Permissions: read-only
- Output: relevant docs and any usage constraints

After all agents finish, the main agent must consolidate:
1. plan changes required before implementation
2. recommended implementation order
3. test strategy
4. must-fix risks
5. nice-to-have improvements

Do not modify code yet.
```

## Main Agent Implements, Subagents Review

```text
Implement this plan in the main thread.

After implementation, run read-only review subagents and wait for all summaries:
1. correctness_reviewer
- Check behavior, edge cases, regressions, and broken assumptions.
2. test_reviewer
- Check missing tests, weak assertions, flaky risks, and important scenarios.
3. security_reviewer
- Check auth, permissions, input validation, sensitive data exposure, secrets, and unsafe operations.
4. ux_reviewer
- Use only if UI is affected. Check loading, empty, error, disabled, responsive, accessibility, and copy states.

Consolidate findings into:
- must-fix before completion
- nice-to-have improvements
- tests to run

Apply only must-fix items unless the user approves nice-to-have changes.
Run final tests and summarize the final diff.
```

## Parallel Implementation With Strict Boundaries

```text
Implement this feature using parallel subagents with strict ownership boundaries.

Spawn these agents and wait for all results:
1. agent_a
- Scope: [specific files/folders]
- Task: [specific task]
- Permissions: may modify only this scope
2. agent_b
- Scope: [specific files/folders]
- Task: [specific task]
- Permissions: may modify only this scope
3. agent_c
- Scope: [specific files/folders]
- Task: [specific task]
- Permissions: may modify only this scope

Each agent must report:
1. assigned scope
2. changed files
3. tests run and results
4. assumptions
5. remaining risks

If any agent needs to edit outside its assigned scope, it must stop and ask first.

After all agents finish, the main agent must:
1. review all diffs
2. resolve conflicts
3. normalize naming, style, and abstractions
4. run final tests
5. produce the consolidated summary
```

## Bug Investigation

```text
Use read-only subagents to investigate this bug before modifying code.

Spawn these agents and wait for all summaries:
1. reproduction_agent
- Try to reproduce the issue.
- Return steps, observed behavior, expected behavior, and relevant logs.
2. code_path_agent
- Trace the likely code path.
- Return files, functions, state changes, and dependencies involved.
3. hypothesis_agent
- Generate likely root causes.
- Rank hypotheses by evidence and suggest minimal verification steps.

After all agents finish, consolidate:
1. most likely root cause
2. evidence
3. minimal fix plan
4. regression test plan

Do not modify code until the root cause is clear.
```

## PR Or Diff Review

```text
Review the current diff using read-only subagents.

Spawn one agent per review category and wait for all summaries:
1. security_reviewer
2. correctness_reviewer
3. test_reviewer
4. maintainability_reviewer
5. ux_reviewer, if UI is affected

Each agent should return:
- findings
- severity
- file references
- why it matters
- suggested fix

After all agents finish, summarize:
1. must-fix issues
2. should-fix issues
3. nice-to-have improvements
4. no-action observations

Do not apply changes unless the user explicitly asks.
```

## Role Contracts

- `explorer`: read-only; find relevant files, flows, dependencies, and likely change points; return concise paths and reasoning.
- `risk_reviewer`: read-only; identify hidden edge cases, regression risks, unclear requirements, and test needs.
- `correctness_reviewer`: read-only unless told to fix; focus on behavior, data flow, edge cases, and regressions.
- `test_reviewer`: check coverage, weak assertions, flaky risks, and minimal high-value tests.
- `security_reviewer`: check auth, authorization, workspace scope, RLS, input validation, sensitive data exposure, secrets, unsafe operations, and injection risks.
- `ux_reviewer`: check loading, empty, error, disabled, optimistic, accessibility, responsive, and copy states.
- `worker`: bounded implementation only; modify assigned scope, avoid unrelated refactors, run relevant tests, and report changed files plus risks.

## Anti-Patterns

- Do not make multiple agents edit the same file.
- Do not let each agent choose its own architecture.
- Do not parallelize unclear requirements.
- Do not use subagents for tiny text or CSS changes.
- Do not use subagents to avoid planning.
- Do not use subagents without one final integration owner.
- Do not let review agents apply nice-to-have changes automatically.
