# Manual Linear Operations

Updated: 2026-05-18

This document is the operating rule for running this project through Linear manually, without a live Symphony daemon. It keeps the useful parts of Symphony discipline: small issues, clear scope, predictable status handoff, Korean CEO-facing reports, and safe multi-Codex coordination.

## Executive Summary

Use manual Linear operations as the default for the current Product MVP phase.

Reasons:

- Product judgment is still more important than automation.
- The representative can give short natural-language direction, and Codex should shape it into PR-sized Linear work.
- A live Symphony daemon adds runner setup, key management, duplicate pickup risk, and workflow maintenance that are not yet worth the overhead.
- Multiple Codex sessions can still work together safely if Linear is treated as the control plane and each session owns exactly one issue and one branch.

## Current Linear Shape

Observed on 2026-05-18:

- Workspace team: `Deny-93`
- Team key: `DEN`
- Active product project example: `워크스페이스 인증·권한 시스템 구축`
- Completed orchestration pilot project: `EMR Agent Orchestration Pilot`
- Primary workflow statuses:
  - `Backlog`
  - `Todo`
  - `Ready`
  - `In Progress`
  - `Security Review`
  - `Human Review`
  - `Rework`
  - `Blocked`
  - `Done`
  - `Canceled`
  - `Duplicate`

Current observed labels include:

- Team: `team:planning`, `team:design`, `team:qa`, `team:security`
- Type: `type:docs`, `type:review`, `type:security-audit`, `type:design-system`
- Risk: `risk:auth`, `risk:low`
- Special: `cso`, `pilot`, `Feature`, `Improvement`, `Bug`

Recommended future labels, create only when needed:

- `team:frontend`
- `team:release`
- `type:implementation`
- `type:research`
- `risk:data`
- `risk:supabase`
- `risk:permissions`

## Linear Identifier Rule

`DEN` is the Linear team key for the `Deny-93` team. It appears automatically in issue identifiers such as `DEN-27`.

Keep `DEN` as the team identifier unless the team itself is intentionally renamed in Linear. Do not use `DEN` to communicate product area, priority, or sequence. Use title prefixes, milestones, labels, and project placement for that.

Issue title order is the primary manual ordering tool. Use sortable prefixes so Linear lists can be sorted by title and still read in the intended work sequence.

## Roles

### Representative

The representative does not need to write detailed engineering instructions every time.

Good inputs:

- "다음 단계 잡아줘."
- "이 기능 구현 계획 세워줘."
- "이거 Linear 이슈로 쪼개줘."
- "다음 고고."
- "이건 보안 관점으로 봐줘."
- "PR 올려."

### Lead Codex

The active Codex session acts as CTO/PM/operator.

Responsibilities:

- Interpret the representative's goal.
- Check existing Linear projects/issues before creating new work.
- Create or update projects, milestones, and issues.
- Keep issue scope PR-sized.
- Mark status changes.
- Implement or coordinate implementation.
- Attach Korean HTML reports for meaningful completed work.
- Stop at `Human Review` unless the representative asks to commit, push, PR, or mark done.

### Additional Codex Sessions

Additional Codex sessions may work in parallel only when each one has:

- A distinct Linear issue.
- A distinct branch.
- A distinct file/module ownership boundary.
- A clear status and handoff comment in Linear.

They must not silently work on the same issue or same files.

## Status Rules

| Status | Manual meaning | Codex action |
| --- | --- | --- |
| `Backlog` | Idea, not shaped | Do not start. |
| `Todo` | Known work, not ready | Shape before implementation. |
| `Ready` | Scoped and approved to start | Codex may start when asked. |
| `In Progress` | Implementation or report work active | Exactly one owner session should work. |
| `Security Review` | CSO/security review active | Use security-review posture; code changes only if explicitly approved. |
| `Human Review` | Waiting for representative review | Stop and report. |
| `Rework` | Representative requested fixes | Continue from existing context. |
| `Blocked` | Waiting on product, credential, design, or dependency | Do not guess through the blocker. |
| `Done` | Representative accepted the work | Terminal. |
| `Canceled` | Intentionally abandoned | Terminal. |
| `Duplicate` | Replaced by another issue | Terminal; link the canonical issue. |

## Default Manual Workflow

1. Representative gives a goal.
2. Codex checks existing Linear projects/issues and repo work docs.
3. Codex reports a short plan in Korean.
4. Codex asks the representative before creating a new project, moving work into a different project, or choosing between a new project and an existing project.
5. Codex creates or updates a Linear project/milestone/issue only after the placement decision is clear.
6. Codex moves the active issue to `In Progress` or `Security Review`.
7. Codex implements or writes the scoped report.
8. Codex runs the narrowest useful verification, then broader checks when risk requires.
9. Codex creates a Korean HTML report for meaningful project work.
10. Codex attaches the report to Linear through a document/comment/attachment when possible.
11. Codex moves the issue to `Human Review`.
12. Representative decides `Done` or `Rework`.

## Issue Shaping Rules

Use ordered titles when sequence matters:

```text
00-01 Define ...
00-02 Plan ...
01-01 Build ...
02-01 Implement ...
05-02 Security review ...
```

Title prefix convention:

- First number = milestone or phase.
- Second number = sequence inside that milestone.
- Use two digits for both numbers.
- Keep the product verb after the prefix.
- Use English technical terms when they are clearer for code search.

Examples:

```text
00-01 Define workspace auth scope, role matrix, and acceptance criteria
01-01 Build workspace creation foundation for subscribing hospital admin
05-02 Security review workspace auth and permission boundary
```

To make issues appear in order in Linear, prefer a project or issue view sorted by title ascending. If a view is sorted by creation date, create issues in sequence and still keep title prefixes as the durable order signal.

Every implementation issue should include:

- `## 목표`
- `## 배경`
- `## 해야 할 것`
- `## 제외 범위`
- `## 완료 기준`
- `## 검증 방법`
- `## 최종 보고에 포함할 내용`

Use Korean for Linear-facing text. Keep code symbols, commands, file paths, labels, statuses, branch names, and URLs in their original form.

## Priority Rules

Codex may recommend priority, but should not silently treat product importance as decided when the tradeoff is meaningful.

Default priority guidance:

| Priority | Use when |
| --- | --- |
| Urgent | Production breakage, data loss, security incident, or a blocker for active work. |
| High | Auth/security, data boundaries, core workflow, or decision-critical MVP work. |
| Medium | Important product work that is not blocking the current path. |
| Low | QA report, polish, documentation cleanup, or deferred improvement. |

Ask the representative before changing priority when:

- Multiple active projects compete for attention.
- A feature is strategically important but not technically urgent.
- The work could pull focus away from the current MVP path.
- The priority would promote or demote security, data, billing, or clinical workflow work.

## Work Size Rules

Keep issues PR-sized.

Split or ask before proceeding when a proposed issue likely includes:

- More than one user-visible workflow.
- More than one major module.
- More than 6 to 8 files of expected changes.
- More than 2 to 3 meaningful verification commands.
- More than one database/API/security boundary.
- Work that cannot be explained in one concise completion report.

If an issue becomes too large during implementation, stop and recommend either:

- Narrowing the current issue.
- Creating follow-up issues.
- Moving the remaining work to `Backlog` or `Todo`.

## Representative Approval Gates

Ask the representative before:

- Creating a new Linear project.
- Moving work into a different project.
- Adding or changing milestones.
- Changing product role/permission policy.
- Entering live Supabase, DB migration, RLS, payment, subscription, email delivery, or production deployment scope.
- Making broad UI direction changes.
- Combining unrelated issues into one PR.
- Marking an issue `Done` without an explicit request.

If the work is low-risk and clearly inside an existing issue's scope, Codex may proceed without asking.

## Rework and Done Rules

Codex normally stops at `Human Review`.

Representative decisions:

- Move to `Done` when the result is accepted.
- Move to `Rework` when the same issue needs correction.
- Create a follow-up issue when the new request is adjacent but not part of the accepted scope.

Use `Rework` when:

- Acceptance criteria were not met.
- The implementation has a bug.
- The report is missing required information.
- The representative asks to change the delivered result before accepting it.

Use a follow-up issue when:

- The original work is acceptable.
- The new request expands scope.
- The next step belongs to a later milestone.
- The change would require different verification or different file ownership.

## PR Grouping Rules

Default: one Linear issue maps to one branch and one PR.

Multiple issues may share one PR only when:

- The representative approves the grouping.
- The issues are tightly coupled.
- The changed files overlap naturally.
- The PR body lists every included issue.
- Verification covers the combined risk.

Do not combine:

- Security-sensitive implementation with unrelated UI polish.
- DB/RLS work with frontend-only work.
- Product scope decisions with implementation unless the issue explicitly includes both.

## Reporting Depth Rules

Use `docs/_meta/result-review-rules.md` and this shortcut:

| Work type | Report depth |
| --- | --- |
| Tiny typo, link, wording fix | Final chat summary only. |
| Small docs update with durable guidance | Update source doc and run `docs:check`; no HTML report unless tied to Linear issue. |
| Linear issue, product decision, implementation, QA, or security review | Korean HTML report required. |
| PR publish work only | PR description and final chat summary are enough unless a Linear issue requires a report. |

Do not create heavy reports for every tiny maintenance change. Do create reports for meaningful representative-facing work.

## Project and Milestone Rules

Use a Linear project when work has more than three related issues or a durable product objective.

Before creating a new project, ask the representative for confirmation. Do not silently create a project from an inferred theme.

Ask when any of these are true:

- The work could reasonably fit an existing project and a new project.
- The work changes the product area or strategic objective.
- The work needs new milestones.
- The work may split attention across multiple active projects.
- The work is a one-off but might become a larger sequence.

Default question shape:

```text
이건 새 프로젝트로 잡을까, 아니면 기존 `<project name>`에 이슈로 추가할까?
내 추천은 `<recommendation>`이야. 이유는 `<short reason>`.
```

If the representative gives a broad goal without a clear project, Codex should first list the closest existing project candidates and recommend one. Only create a new project after explicit approval.

Use milestones for phases, such as:

- `00 Scope & Decisions`
- `01 Foundation`
- `02 UI & Workflow`
- `03 Server/API Boundary`
- `04 Persistence & RLS`
- `05 Security Review`

Do not create a new project for a single small fix. Use the existing project or an issue without a project.

## Multi-Codex Coordination

### One Issue, One Owner

Only one Codex session owns a Linear issue at a time.

Ownership signal:

- Issue is `In Progress`.
- Linear comment says who owns it, what branch is used, and what files/modules are expected to change.

### One Branch Per Issue

Default branch name:

```text
codex/<short-issue-purpose>
```

For Linear issue work, prefer:

```text
codex/den-<number>-<short-purpose>
```

Do not stack multiple unrelated Linear issues into one branch unless the representative explicitly asks for a combined PR.

### File Ownership

Before parallel work, assign ownership by module:

- Auth/session files
- Reception module
- Chart module
- Billing module
- Shared EMR components
- Docs/work items
- Tests

If two sessions need the same file, sequence the work instead of parallelizing.

High-conflict files require extra caution:

- `docs/engineering/current-status.md`
- `docs/work/index.md`
- `docs/agent-start-here.md`
- shared components under `src/components/`
- shell files under `src/shell/`
- broad regression tests under `tests/`

When two Codex sessions both need one of these, one session should own the edit and the other should provide notes or wait.

### Handoff Comment

When a Codex session stops before completion, add a Linear comment with:

- Current branch
- Files changed
- Verification already run
- Remaining steps
- Known risks/blockers

If no Linear issue exists yet, leave the handoff in the final chat response and recommend whether to create an issue.

## When To Use Sub-Agents Inside One Codex Session

Use sub-agents only when the user explicitly asks for parallel agents or delegation. Otherwise the lead Codex should do the work locally.

Good delegated subtasks:

- Independent codebase exploration.
- Report-only review.
- Disjoint implementation files.
- Parallel verification while lead continues implementation.

Bad delegated subtasks:

- The immediate blocking task.
- Work that touches the same files as the lead.
- Vague "review everything" tasks without a specific question.

## Security Routing

Use `Security Review` status and labels such as `team:security`, `type:security-audit`, `cso`, or `risk:auth` when the work is security-sensitive.

Security review defaults:

- Report-only unless implementation is explicitly approved.
- Include severity, confidence, verified/tentative status, exploit scenario, impact, remediation, and follow-up issue recommendation.
- Do not run live exploit attempts.
- Do not touch production secrets.

For auth, Supabase, permission, RLS, or server enforcement work, read:

- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/README.md`
- Relevant auth-login work/status docs

## Verification Rules

Choose checks by blast radius:

| Change type | Minimum verification |
| --- | --- |
| Docs only | `npm run docs:check` |
| TypeScript contract | `npx tsc --noEmit` |
| App code | `npm run lint -- --ignore-pattern '.worktrees/**'` and `npx tsc --noEmit` |
| Next.js route/app shell | Read relevant `node_modules/next/dist/docs/`, then `npm run build` |
| UI behavior | Relevant Playwright spec |
| Auth/security boundary | Auth/security specs plus CSO review when risk is high |

If verification cannot run, state why in the Linear comment and final user report.

## Reporting Rules

For meaningful Linear work, create a Korean HTML report under:

```text
docs/completed/<area>/YYYY-MM-DD-<issue-or-slug>-report.html
```

The report should be representative-friendly:

- Requested goal
- What changed or was decided
- Why it matters
- Files/docs changed
- Verification
- Risks and out-of-scope items
- Recommended next step

Then add the report to Linear through:

- Linear document when useful
- Linear comment with local path
- Attachment when supported

## Commit, Push, PR Rules

Do not auto-commit, push, or open a PR unless the representative asks.

When asked:

1. Check `git status --short --branch`.
2. Confirm the intended scope if unrelated changes exist.
3. Create a `codex/` branch when on `main`.
4. Stage only intended files.
5. Run relevant verification.
6. Commit with a concise message.
7. Push the branch.
8. Open a draft PR by default.
9. Report branch, commit, PR URL, and verification.

## When Manual Linear Is Enough

Use manual Linear operations for the current project phase:

- Product discovery and founder review.
- PR-sized implementation.
- Design/system polish.
- Docs and planning.
- Security review reports.
- Work where the representative's judgment changes the next step.

## When To Reconsider Symphony

Reconsider a live Symphony daemon only when:

- There are many already-shaped `Ready` issues.
- Work is repetitive and low-ambiguity.
- The team needs unattended issue pickup.
- Mac mini or another machine will act as a stable worker.
- The repo scripts are portable across machines.
- Duplicate pickup and status ownership rules have been tested.

Until then, manual Linear operations are the default.
