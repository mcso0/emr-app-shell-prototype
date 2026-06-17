---
name: manual-linear-ops
description: Manual Linear operating workflow for this EMR repo. Use when the user asks to plan, create, update, triage, execute, review, or close Linear projects, milestones, issues, or PR handoffs; says "다음 고고", "이슈로 쪼개줘", "리니어 작업", "새 프로젝트로 해야 하나"; needs new-project vs existing-project judgment; coordinates multiple Codex sessions; or handles Human Review, Rework, Done, commit, push, or PR handoff.
---

# Manual Linear Ops

Use this repo's manual Linear workflow as a lightweight Symphony replacement. Keep the skill body compact; load the full manual only when the current task needs the deeper rules.

## Compact Rules

- Keep `DEN` as the Linear team key; manage work order through sortable title prefixes like `00-01`.
- Ask 승욱 before creating a new project, moving work between projects, adding or changing milestones, or choosing new project vs existing project.
- Use Linear milestones for multi-issue projects when work has clear phases, quality gates, or review checkpoints; keep one-off issues milestone-free unless grouping improves execution.
- Default to one Linear issue, one Codex owner, one branch, and one PR.
- In 승욱's solo multi-Codex workflow, one thread may own a coherent Linear project or work bundle with multiple issues when the branch/PR strategy is stated up front.
- Individual work threads must stop at PR preview for deployment review; route fixed staging, production, Vercel alias, or promote requests through `$release-deployment-ops`.
- Stop meaningful issue work at `Human Review`; move to `Done` only when 승욱 explicitly accepts or asks.
- Create Korean HTML reports for meaningful Linear issue work; skip heavy reports for tiny typo, link, or wording fixes.
- Scoped synthetic/demo-data Supabase, DB migration, RLS, server/API, and production-demo deployment work may proceed when the active Linear issue includes it.
- Ask 승욱 before meaningful cost, secret/security exposure, private repo/public exposure, real data use, destructive remote data changes, real external communications/payments/providers, real customer launch, or canonical role/permission policy changes.
- If an approval-gated action is the better or necessary path for the active issue, do not choose a weaker workaround just to avoid the gate. Stop, explain the required gated operation, and ask 승욱 for explicit approval before continuing.

## Required Workflow

1. Read `docs/agent-start-here.md` compact rules first.
2. Check current Linear projects, issues, statuses, and labels before creating anything.
3. If project placement is ambiguous, ask 승욱 with a clear recommendation.
4. Shape PR-sized issues with goal, background, tasks, out-of-scope, done criteria, verification, and final report expectations.
5. For multi-issue projects, propose milestones before issue creation or before linking issues to milestones.
6. Use title prefixes for ordered issue lists, for example `00-01`, `01-01`, and `05-02`.
7. Start scoped work by moving the issue to `In Progress` or `Security Review`.
8. Verify with the narrowest useful command set, expanding only when risk requires it.
9. Create a Korean HTML report for meaningful work.
10. Attach or summarize the report in Linear and move the issue to `Human Review`.

## Milestone Use

Use milestones as project execution phases, not as labels. Prefer them when a Linear project has:

- 3 or more PR-sized issues.
- sequential phases such as scope, foundation, module adoption, QA, and closeout.
- explicit design, security, launch-readiness, or quality gates.
- a review point where 승욱 should inspect progress before the next phase expands scope.

Milestone rules:

- Ask 승욱 before adding, renaming, deleting, or substantially changing milestones.
- Keep milestone names short and sortable, for example `00 Scope & Metrics`, `01 Shared Foundations`, and `04 Final QA & Closeout`.
- Align issue title prefixes with milestone phases when possible: `00-01` belongs in the `00` milestone, `01-02` belongs in the `01` milestone.
- Put each issue in exactly one milestone when milestones are used.
- Do not create milestones for a single isolated issue, tiny wording fixes, or exploratory backlog ideas unless 승욱 asks.
- Use milestone progress to explain project status in reviews, for example "foundation is complete; module adoption is next."
- If the Linear tool cannot create or link milestones, state the limitation and propose manual UI steps instead of pretending the milestone exists.

## Read Full Manual When

Read `docs/engineering/agent-orchestration/manual-linear-operations.md` before:

- creating a new project or milestone
- deciding new project vs existing project
- coordinating multiple Codex sessions
- handling `Rework`, `Done`, or ambiguous status transitions
- grouping multiple issues into one PR
- planning fixed staging, production, or release handoff with Linear work
- changing priority when product tradeoffs matter
- entering security, DB, RLS, payment, email, deployment, or role-policy scope

## Linear Tool Use

- Read first: projects, issues, statuses, labels, and current placement.
- Mutate only after scope and placement are clear.
- Use Korean for user-facing and Linear-facing text; preserve technical identifiers, commands, file paths, branch names, labels, statuses, and URLs.
- Do not silently create projects, add milestones, or mark work `Done`.
- When milestones are available in the Linear tool, create or update milestones first, then link issues to the intended milestone during issue creation or issue update.

## Placement Question

Use this pattern when placement is uncertain:

```text
이건 새 프로젝트로 잡을까, 아니면 기존 <project>에 이슈로 추가할까?
내 추천은 <recommendation>이야. 이유는 <short reason>.
```

## Issue Title Order

Use two-digit phase and sequence prefixes:

```text
00-01 Define workspace auth scope, role matrix, and acceptance criteria
01-01 Build workspace creation foundation for subscribing hospital admin
05-02 Security review workspace auth and permission boundary
```

Tell 승욱 that Linear lists should be sorted by title ascending when the desired order does not match creation date.
