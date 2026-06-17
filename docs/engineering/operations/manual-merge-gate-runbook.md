---
id: ENGINEERING-OPERATIONS-MANUAL-MERGE-GATE-RUNBOOK
status: approved
area: engineering
doc_type: runbook
related_work:
  - DEN-450
supersedes: []
superseded_by: []
last_updated: 2026-06-09
---

# Manual Merge Gate Runbook

This runbook defines the manual checks required while the CLAiR EMR working repository remains private on the current GitHub free/Hobby setup.

GitHub Actions can run `CI` and `Secret Scan`, but the current plan cannot enforce required checks for this private repository. Until branch protection is available, merge discipline is an explicit human and Codex responsibility.

## Environment Model

```text
work branch / PR = Vercel Preview
staging branch = fixed staging
main branch = Vercel Production
```

Key rule:

- Merge to `staging` means fixed staging review.
- Merge to `main` means production release.
- Do not merge to `main` as a routine integration step.

## Roles

| Role | Responsibility |
| --- | --- |
| Work thread | Implements scoped issue/work bundle, opens PR, verifies PR preview, and stops before fixed staging or production. |
| Release thread | Reviews included PRs/issues, checks merge gates, updates `staging` or prepares production release only after explicit approval. |
| 승욱 | Reviews fixed staging or production approval packet and gives explicit approval when needed. |

## Gate 1: Work PR Before Merge To `staging`

Use this gate when a work branch or PR is ready to enter the fixed staging review line.

Required evidence:

| Check | Required result |
| --- | --- |
| PR target | Targets `staging` unless 승욱 explicitly approves another integration branch. |
| Included work | Linear issue(s), work item(s), and report are listed. |
| `CI` | GitHub check is successful, or local equivalent is reported if GitHub check is unavailable. |
| `Secret Scan` | GitHub check is successful and `npm run security:secrets` has passed for local release review when relevant. |
| Vercel Preview | Preview deployment is Ready and linked in the PR/review note. |
| Scope check | PR does not change fixed staging alias, production alias, Vercel production settings, or secrets. |
| Product check | The changed workflow was smoke-tested in preview or locally with the active issue's focused verification. |
| Dirty-worktree check | Release thread confirms it is not accidentally merging unrelated local files. |

Minimum local commands for a release thread before integrating to `staging`:

```bash
npm run security:secrets
npm run docs:check
git diff --check
```

Add app verification when the PR changes application behavior:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Stop before merge when:

- `CI`, `Secret Scan`, preview readiness, or required local verification is failing or unknown;
- the PR contains secret/env values or `.env*` files;
- the PR changes production settings, production aliases, Vercel project settings, or fixed staging alias;
- the PR mixes unrelated work that cannot be reviewed as one change;
- the source branch is stale in a way that changes the review result.

## Gate 2: `staging` Before Fixed Staging URL Update

Use this gate when `staging` has changed and the fixed staging URL should show the latest integrated state.

Required evidence:

| Check | Required result |
| --- | --- |
| Source branch | `staging` or 승욱-approved integration branch only. |
| Source commit | Exact commit SHA is recorded. |
| Included work | Included PRs/issues are listed. |
| Secret gate | `npm run security:secrets` passed. |
| Docs gate | `npm run docs:check` and `git diff --check` passed. |
| App gate | Relevant `lint`, `tsc`, `build`, and focused tests passed when app code changed. |
| Deployment target | Vercel deployment is Preview, Ready, and tied to the intended source. |
| Alias target | Fixed staging URL points to the intended deployment after update. |
| Production non-change | Production URL and production aliases are inspected and not changed. |

If Vercel does not automatically create a branch preview for `staging`, the approved fallback is:

1. deploy a clean `staging` worktree as a Vercel Preview;
2. attach the fixed staging URL to that Preview deployment;
3. inspect the fixed staging alias;
4. inspect production aliases for non-change.

The fixed staging report must include:

- fixed staging URL;
- deployment URL and deployment id;
- source branch and commit SHA;
- included PRs/issues;
- verification commands and result;
- production non-change evidence;
- rollback candidate or stop condition.

## Gate 3: `staging` Before Merge To `main`

Use this gate only for production release preparation. Merging to `main` is production exposure because Vercel production branch is `main`.

Required approval from 승욱 must name:

- target environment: production;
- source branch and commit SHA;
- included PRs/issues;
- env/secret source without values;
- preflight commands;
- smoke path;
- rollback candidate;
- stop condition.

Minimum preflight:

```bash
npm run security:secrets
npm run docs:check
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

Production release packet must include:

| Field | Required content |
| --- | --- |
| Source | `staging` commit SHA and comparison target. |
| Work included | PRs/issues/reports included in the release. |
| Verification | Commands, GitHub checks, preview/fixed staging smoke, and result. |
| Secret/env safety | Confirmation that no secret values were exposed and no production env values are printed. |
| Production action | Exact merge/promote/deploy operation to run after approval. |
| Smoke plan | Production URL and path(s) to verify after release. |
| Rollback | Previous production deployment id or revert candidate. |
| Stop condition | Clear condition that cancels the release. |

Stop before production when:

- 승욱 has not explicitly approved production;
- source commit is not named;
- included PRs/issues are unclear;
- fixed staging was not reviewed;
- secret scan or app verification failed;
- rollback candidate is missing;
- production smoke path is missing;
- remote Supabase, real data, provider, email, payment, or RLS operations are implied but not separately approved.

## Codex Request Templates

For work threads:

```text
이 작업 묶음을 구현해줘.
PR preview까지만 공유하고, fixed staging alias와 production은 건드리지 마.
```

For fixed staging integration:

```text
릴리즈 통합 작업을 진행해줘.
대상 PR/이슈 목록을 확인하고 staging 브랜치 기준 fixed staging에만 반영해줘.
main/production은 건드리지 마.
```

For production release:

```text
승인: staging commit <SHA>를 production release로 main에 반영해줘.
포함 PR/이슈는 <list>이고, production smoke와 rollback 후보를 보고해줘.
```

## Linear And Report Handoff

For every meaningful merge-gate operation, record in Linear:

- target branch/environment;
- source branch and commit SHA;
- included issues/PRs;
- verification results;
- fixed staging or production URL;
- deployment id or URL;
- stop condition or rollback candidate.

Move the issue to `Human Review` after evidence is recorded. Move to `Done` only when 승욱 explicitly accepts or asks.
