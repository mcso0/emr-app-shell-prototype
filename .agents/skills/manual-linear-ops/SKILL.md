---
name: manual-linear-ops
description: Manual Linear operating workflow for this EMR repo. Use when the user asks to plan, create, update, triage, execute, review, or close Linear projects, milestones, issues, or PR handoffs; says "다음 고고", "이슈로 쪼개줘", "리니어 작업", "새 프로젝트로 해야 하나"; needs new-project vs existing-project judgment; coordinates multiple Codex sessions; or handles Human Review, Rework, Done, commit, push, or PR handoff.
---

# Manual Linear Ops

Use this repo's manual Linear workflow as a lightweight Symphony replacement. Keep the skill body compact; load the full manual only when the current task needs the deeper rules.

## Compact Rules

- Keep `DEN` as the Linear team key; manage work order through sortable title prefixes like `00-01`.
- Ask 승욱 before creating a new project, moving work between projects, adding or changing milestones, or choosing new project vs existing project.
- Default to one Linear issue, one Codex owner, one branch, and one PR.
- Stop meaningful issue work at `Human Review`; move to `Done` only when 승욱 explicitly accepts or asks.
- Create Korean HTML reports for meaningful Linear issue work; skip heavy reports for tiny typo, link, or wording fixes.
- Do not enter live Supabase, DB migration, RLS, payment or subscription, email delivery, production deploy, or role and permission policy changes without explicit approval.

## Required Workflow

1. Read `docs/agent-start-here.md` compact rules first.
2. Check current Linear projects, issues, statuses, and labels before creating anything.
3. If project placement is ambiguous, ask 승욱 with a clear recommendation.
4. Shape PR-sized issues with goal, background, tasks, out-of-scope, done criteria, verification, and final report expectations.
5. Use title prefixes for ordered issue lists, for example `00-01`, `01-01`, and `05-02`.
6. Start scoped work by moving the issue to `In Progress` or `Security Review`.
7. Verify with the narrowest useful command set, expanding only when risk requires it.
8. Create a Korean HTML report for meaningful work.
9. Attach or summarize the report in Linear and move the issue to `Human Review`.

## Read Full Manual When

Read `docs/engineering/agent-orchestration/manual-linear-operations.md` before:

- creating a new project or milestone
- deciding new project vs existing project
- coordinating multiple Codex sessions
- handling `Rework`, `Done`, or ambiguous status transitions
- grouping multiple issues into one PR
- changing priority when product tradeoffs matter
- entering security, DB, RLS, payment, email, deployment, or role-policy scope

## Linear Tool Use

- Read first: projects, issues, statuses, labels, and current placement.
- Mutate only after scope and placement are clear.
- Use Korean for user-facing and Linear-facing text; preserve technical identifiers, commands, file paths, branch names, labels, statuses, and URLs.
- Do not silently create projects, add milestones, or mark work `Done`.

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
