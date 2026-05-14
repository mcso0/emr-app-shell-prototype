# Linear Agent Workflow

Updated: 2026-05-14

## Purpose

Linear is the work control plane for Symphony. Engineers, product, design, and security can create issues; Symphony turns eligible issues into Codex work sessions.

The manual pilot kit lives in `ops/symphony/linear/`.

## Language Contract

Use Korean for Linear-facing work management text:

- Issue titles and descriptions
- Project updates
- Review comments
- Human Review summaries
- Rework requests

Keep technical identifiers in their original form:

- Linear statuses such as `Ready`, `Human Review`, `Rework`, and `Done`
- Labels such as `team:planning`, `type:docs`, and `risk:low`
- File paths, commands, branch names, code symbols, and URLs

Repository source docs and durable handoff notes remain concise English unless the source document is already Korean. This keeps Linear readable for the operator while preserving stable repo documentation conventions.

## Statuses

Recommended statuses:

| Status | Meaning | Symphony behavior |
|---|---|---|
| `Backlog` | Idea or unscheduled work | Not active |
| `Ready` | Shaped and safe for agent pickup | Active in general workflow |
| `In Progress` | Agent or human is working | Active in general workflow |
| `Human Review` | Work is ready for human review | Not active |
| `Rework` | Needs follow-up changes after review | Active |
| `Security Review` | Security audit requested | Active only in security workflow |
| `Merging` | Human-controlled merge path | Not active for initial pilot |
| `Done` | Complete | Terminal |
| `Blocked` | Waiting on external decision or artifact | Not active |
| `Canceled` | Intentionally not doing it | Terminal |

## Labels

Team labels:

- `team:planning`
- `team:frontend`
- `team:qa`
- `team:security`
- `team:release`

Type labels:

- `type:implementation`
- `type:docs`
- `type:review`
- `type:research`
- `type:security-audit`

Risk labels:

- `risk:auth`
- `risk:supabase`
- `risk:permissions`
- `risk:data`
- `risk:low`

Security routing labels:

- `team:security`
- `type:security-audit`
- `cso`

Issues with security routing labels should use `ops/symphony/WORKFLOW.security.md`.

## General Issue Template

```md
## 목표

완료해야 하는 결과를 한 문장으로 적는다.

## 배경

- 읽어야 할 문서:
- 관련 파일:
- 관련 work item:
- 주의할 제약:

## 작업 범위

- 포함할 작업 1
- 포함할 작업 2

## 제외 범위

- 이번 이슈에서 하지 않을 작업
- 자동 merge/deploy 여부
- 보안/DB 관련 제외 조건

## 완료 기준

- 사용자 또는 문서 관점의 결과
- 필요한 검증 결과
- `Human Review` handoff

## 검증 방법

- `npm run docs:check` for docs changes
- `npm run lint` for app code changes
- `npx tsc --noEmit` when TypeScript contracts change
- Relevant Playwright tests when screen behavior changes

## 최종 보고에 포함할 내용

- 변경 내용
- 변경 파일
- 검증 결과
- 남은 리스크 또는 blocker
- `Human Review` 준비 여부
```

## Security Issue Template

```md
## Goal

Produce a CSO-style security report for the scoped area.

## Mode

Use one:

- `cso --scope auth`
- `cso --code --diff`
- `cso --supply-chain`
- `cso --infra`
- `cso --owasp`
- `cso`

## Scope

- Area to audit
- Files, docs, or branch diff to inspect

## Out of Scope

- Code changes
- Commits
- Live exploit attempts
- Secret testing against real services

## Report Requirements

- Severity
- Confidence
- VERIFIED / UNVERIFIED / TENTATIVE status
- Concrete exploit scenario
- Specific remediation
- Follow-up issue recommendation
```

## Dependency Handling

Use Linear blockers for real dependencies. A Symphony agent should not pick up a `Ready` issue if it is blocked by an incomplete issue.

Examples:

- React upgrade blocked by build tooling migration.
- RLS implementation blocked by permission resolver approval.
- CSO re-audit blocked by implementation fix.

## Team-Style Routing

The first implementation can use statuses and separate workflow files. If label-aware dispatch becomes necessary, add one of:

- Separate Linear projects by team.
- Separate active statuses by workflow.
- A custom Symphony runner that filters by labels.

Do not rely on a general implementation workflow to perform CSO audits. Security work should be routed explicitly.
