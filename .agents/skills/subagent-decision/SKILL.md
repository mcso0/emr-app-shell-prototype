---
name: subagent-decision
description: Choose bounded delegation when independent investigation, review, or test triage can improve the task.
---

# Subagent Decision

Use before dispatching an agent. Choose by dependency and risk; no scorecard or formal decision report is required for routine choices.

## Decide

- Work locally when the task is small, sequential, tightly coupled, or delegation would duplicate the parent's work.
- Delegate one bounded read-only investigation, review, or test-triage task when it can run independently alongside useful parent work and improve evidence or reduce cost.
- Ask about material ambiguity before delegating dependent work; continue other authorized work.
- Use parallel implementation only on explicit user request with disjoint file/module ownership and defined interfaces. General read-only delegation permission does not authorize it.
- Keep unrelated product directions in separate workspaces when needed. Creating a user-facing task/thread requires an explicit request; subagents belong to the current task.

If the user requests a formal delegation decision, briefly explain the chosen shape, rationale, permissions, and parent responsibility. Existing category labels may be used for compatibility: `DO_NOT_USE_SUBAGENTS`, `CLARIFY_OR_PLAN_FIRST`, `USE_SUBAGENTS_FOR_EXPLORATION`, `USE_SUBAGENTS_FOR_REVIEW_ONLY`, `USE_SUBAGENTS_FOR_PARALLEL_IMPLEMENTATION`, `SPLIT_INTO_WORKTREES_OR_THREADS_INSTEAD`.

## Dispatch Contract

- Use the smallest useful count, up to four open spawned agents concurrently across the whole task tree, excluding the parent. Children coordinate capacity with the parent; no untracked fan-out.
- Give each agent a concrete question, minimal sources, permitted side effects, and expected evidence. Use native dispatch rather than creating a sidebar task.
- Keep one parent responsible for final decisions, implementation/integration, verification, and the user response. Read-only delegates report findings; they do not fix files or mutate remote state.
- Implementation workers must know they are not alone, preserve others' changes, and own explicit files/modules. Ask before material ownership/scope expansion.
- Delegation cannot bypass authorization, workspace/data/security boundaries, release gates, or human acceptance. A review recommendation grants no new permission.
- Preserve the user-selected parent model/effort. Use supported specialist roles from `.codex/agents/`; confirm actual runtime controls before claiming a model or sandbox was used.
- Treat summaries as evidence and resolve material conflicts against source. For prompt-enforced read-only work, compare affected state before/after and distinguish concurrent changes from delegate actions.

Load [prompt templates](references/prompt-templates.md) only when a ready-to-use delegation prompt or complex ownership handoff is needed. Select the relevant role; a template is not a requirement to spawn every example agent.
