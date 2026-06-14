---
name: subagent-decision
description: Decide whether a CLAiR EMR coding, docs, QA, or planning task should use subagents, one main agent, review-only subagents, parallel implementation, or separate worktrees/threads. Use after a plan is drafted or before implementation when the user asks about subagent usage, delegation, parallelization, model-split work, review agents, QA agents, codebase exploration, risk review, or whether work should be split.
---

# Subagent Decision

Use this skill as the decision gate before delegating work. It decides the execution shape; it does not replace `.agents/skills/codex-agent-router`, which maps an approved subagent route to this project's concrete agents.

Core rule:

```text
Parallelize reading, investigation, validation, and review.
Centralize final design decisions, integration, and high-risk implementation.
```

## Project Defaults

- Keep one parent/main agent responsible for final decisions, integration, verification, and the final user summary.
- Use `$codex-agent-router` only after this skill decides that project custom agents are useful.
- Prefer read-only subagents for broad search, logs, code-path mapping, risk review, security review, and test triage.
- Keep implementation in the parent thread unless file/module ownership boundaries are clear and the user explicitly wants parallel implementation.
- Do not use subagents to bypass Linear status, work item scope, branch/file ownership, approval gates, security boundaries, real-data restrictions, destructive remote operations, external publication, or Human Review rules.
- Treat subagent summaries as evidence, not authority.

Use this project's existing custom agents through `$codex-agent-router`:

- `spark-explorer`: read-only codebase or docs mapping.
- `security-boundary-reviewer`: auth, workspace, Supabase, RLS, audit, billing integrity, real data, provider, payment, or production risk review.
- `test-triage`: failing tests, logs, CI/build/lint/typecheck output, regression choice, and flaky behavior.

## Decision Flow

1. Confirm requirements are clear enough to delegate. If not, choose `CLARIFY_OR_PLAN_FIRST`.
2. Score the task using the heuristics below.
3. Choose exactly one decision category.
4. Name what stays with the main agent.
5. If subagents are recommended, provide a bounded prompt and permissions.
6. If using project custom agents, route the agent choice through `$codex-agent-router`.

## Scoring

Parallelism Score: 0-5, add 1 for each true statement.

- Work splits by file, module, domain, route, endpoint, package, or feature.
- Each part has a clear output.
- Parts can run independently.
- Interfaces between parts are clear.
- One main agent can merge the results.

Conflict Risk Score: 0-5, add 1 for each true statement.

- Multiple agents would edit the same file.
- Multiple agents would change shared state, schema, permissions, or abstractions.
- Multiple agents would make architecture decisions.
- Requirements are ambiguous.
- Existing test coverage is weak or unknown.

Noise Reduction Score: 0-5, add 1 for each true statement.

- Task requires broad repo or docs search.
- Task requires reading logs, stack traces, CI output, or test output.
- Task requires testing several hypotheses.
- Task requires inspecting many files.
- Task requires summarizing findings from several areas.

## Decision Categories

### DO_NOT_USE_SUBAGENTS

Use for small, linear, tightly coupled work:

- copy, typo, label, or narrow CSS changes
- one-file fixes
- single-function bug fixes
- simple prop additions
- tasks that can be completed safely in 10-30 minutes
- work where all agents would edit the same file
- unclear requirements

Recommendation: main agent only, plus normal verification.

### CLARIFY_OR_PLAN_FIRST

Use when delegation would force agents to guess:

- goal, scope, source of truth, or done criteria are unclear
- file/module ownership is unclear
- approval-gated actions may be required
- the user asked for a plan before implementation

Recommendation: produce a plan or ask the smallest necessary question before delegating.

### USE_SUBAGENTS_FOR_EXPLORATION

Use when the task is read-heavy, broad, uncertain, or noisy:

- large codebase exploration
- architecture or data-flow investigation
- bug root-cause investigation
- log, stack trace, CI, or test failure analysis
- migration impact mapping
- UI regression reproduction
- library/API usage verification

Project mapping: usually `$codex-agent-router` to `spark-explorer`; add `test-triage` for failures and `security-boundary-reviewer` for boundary-sensitive areas.

### USE_SUBAGENTS_FOR_REVIEW_ONLY

Use when implementation should remain centralized but independent review reduces risk:

- auth, session, workspace, role, permission, Supabase, RLS, migration, audit, or server-enforcement changes
- billing amount integrity or payment-adjacent changes
- high-risk refactors
- core business logic
- UI flows with loading, empty, error, disabled, responsive, or accessibility states
- pre-merge or final risk review

Default workflow: main agent implements, subagents review read-only, main agent applies only must-fix items unless the user approves broader cleanup.

### USE_SUBAGENTS_FOR_PARALLEL_IMPLEMENTATION

Use only when all required conditions hold:

- each subagent owns separate files, folders, modules, endpoints, packages, or feature boundaries
- subagents do not need to edit the same files
- interfaces are already defined or easy to define
- final integration can be handled by one main agent
- tests can run after integration
- the task is large enough that parallelism saves meaningful time
- the user explicitly wants parallel implementation or delegation

Each implementation subagent must report scope, changed files, tests run, results, assumptions, and unresolved risks. The main agent must review all diffs, resolve conflicts, normalize style, run final tests, and summarize the integrated result.

### SPLIT_INTO_WORKTREES_OR_THREADS_INSTEAD

Use when tasks are separate product directions, experiments, or features rather than parts of one implementation:

- alternative UI approaches
- competing architecture approaches
- unrelated features in parallel
- independent experiments that should not share a diff

Rule: use subagents inside one task; use separate worktrees/threads for separate tasks or competing directions.

## Decision Logic

Use this priority order:

1. If requirements are unclear, choose `CLARIFY_OR_PLAN_FIRST`.
2. If the task is small and linear, choose `DO_NOT_USE_SUBAGENTS`.
3. If the work is separate features or competing directions, choose `SPLIT_INTO_WORKTREES_OR_THREADS_INSTEAD`.
4. If `Parallelism Score >= 4` and `Conflict Risk Score <= 2`, choose `USE_SUBAGENTS_FOR_PARALLEL_IMPLEMENTATION`.
5. If `Noise Reduction Score >= 3`, choose `USE_SUBAGENTS_FOR_EXPLORATION`.
6. If the work is high-risk or boundary-sensitive, choose `USE_SUBAGENTS_FOR_REVIEW_ONLY`.
7. Otherwise choose main agent only, with optional final review if risk increases.

## Required Output

When invoked directly, respond in this shape:

```text
## Subagent Decision
Decision: <one category>
Reason: <brief reason covering parallelism, conflict risk, ambiguity, noise, and implementation risk>
Scores:
- Parallelism Score: x/5
- Conflict Risk Score: x/5
- Noise Reduction Score: x/5
Recommended Workflow:
- Step 1
- Step 2
- Step 3
Subagents:
- <agent or role>: scope, permissions, expected output
Main Agent Responsibility:
- final design decision
- final implementation or integration
- final tests
- final summary
Do Not Delegate:
- <files, decisions, or areas that must remain centralized>
Prompt To Use:
- <ready-to-paste prompt>
```

Load `references/prompt-templates.md` only when the user asks for a ready prompt, the delegation plan is complex, or parallel implementation/review instructions need exact wording.
