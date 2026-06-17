---
id: ENGINEERING-OPERATIONS-FIXED-STAGING-MAIN-ONLY-EXECUTION-PLAN
status: superseded
area: engineering
doc_type: execution-plan
related_work:
  - DEN-445
supersedes: []
superseded_by:
  - ENGINEERING-OPERATIONS-HOBBY-FREE-STAGING-BRANCH-RELEASE-PLAN
last_updated: 2026-06-09
---

# Fixed Staging Main-Only Execution Plan

> Superseded on 2026-06-09. For the Hobby/free target workflow, use [Hobby/free Staging Branch Release Plan](hobby-free-staging-branch-release-plan.md).

This document defines the safe v1 path for keeping the fixed staging URL tied to verified `main` work without touching production. It does not move any alias by itself.

## Current Read-Only State

Observed on 2026-06-09:

| Check | Result | Meaning |
| --- | --- | --- |
| Vercel Git Integration | Connected to `mcso0/emr-app-shell-prototype` | PR previews are active. |
| Vercel production branch | `main` | A naive `main` automation can collide with production behavior. |
| PR preview test | PR #97 created Preview deployment `dpl_CW3j8N7SvAwrjASnvgkxjzLFt2Yx` | PR preview is verified. |
| fixed staging alias | `emr-app-shell-prototype-staging-mcso0s-projects.vercel.app` points to `emr-app-shell-prototype-gbj5vwjhd-mcso0s-projects.vercel.app` | fixed staging is still a manual alias pointing at a Preview deployment. |
| production aliases | `emr-app-shell-prototype.vercel.app` and `emr-app-shell-prototype-mcso0s-projects.vercel.app` point to `emr-app-shell-prototype-32da67as6-mcso0s-projects.vercel.app` | production was not changed. |
| latest deployments | mostly Preview deployments | No automatic fixed staging flow exists yet. |
| GitHub required checks | cannot be enforced on the current private/free setup | Manual merge discipline remains required. |

## Decision

Do not configure fixed staging as an automatic `main` Git deployment yet.

Reason:

- Vercel currently treats `main` as the production branch.
- The product policy says `production` requires explicit approval.
- Therefore, binding routine `main` pushes directly to fixed staging through Vercel production-branch behavior risks confusing fixed staging and production.

Recommended v1:

- Keep the repo private.
- Keep PR previews automatic.
- Keep `CI` and `Secret Scan` automatic but manually verified before merge.
- Keep production untouched.
- Update fixed staging only from a clean, verified `main` checkout through an explicit release operation.

## v1 Fixed Staging Procedure

Run this only after 승욱 explicitly approves the fixed staging update for a named source commit.

Required approval shape:

```text
승인: fixed staging을 main commit <SHA> 기준으로 업데이트해줘.
포함 PR/이슈는 <list>이고, production은 건드리지 마.
```

Preflight:

```bash
git fetch origin main --prune
git worktree add /tmp/clair-fixed-staging-main origin/main
cd /tmp/clair-fixed-staging-main
git status --short
npm ci
npm run security:secrets
npm run docs:check
npm run lint
npx tsc --noEmit
npm run build
```

Deploy shape:

```bash
npx vercel deploy --scope mcso0s-projects --yes
npx vercel alias set <preview-deployment-url> emr-app-shell-prototype-staging-mcso0s-projects.vercel.app --scope mcso0s-projects
npx vercel inspect emr-app-shell-prototype-staging-mcso0s-projects.vercel.app --scope mcso0s-projects
npx vercel alias ls --scope mcso0s-projects
```

Rules:

- Use a clean worktree at `origin/main`.
- Do not deploy from a dirty local feature branch.
- Do not run production deploy/promote commands.
- Do not change production aliases.
- Record the old fixed staging target before moving the alias.
- Record the new fixed staging deployment id and URL after moving the alias.
- Record rollback target.

## Why Not Fully Automatic Yet

Fully automatic fixed staging should wait until at least one of these is true:

- Vercel production branch is moved away from `main` to an explicit production branch, with a separate production policy approval.
- A separate GitHub Action can safely deploy `main` to a Preview deployment and move only the staging alias, with token handling reviewed.
- GitHub branch protection is available for this private repo, so `CI` and `Secret Scan` can be enforced before `main` merges.

Until then, the release thread should do the fixed staging alias move manually and explicitly.

## Stop Conditions

Stop before moving fixed staging when:

- `origin/main` does not include the intended PRs/issues;
- local worktree is dirty;
- `npm run security:secrets`, `npm run docs:check`, `npm run lint`, `npx tsc --noEmit`, or `npm run build` fails;
- Vercel deploy resolves to production target instead of preview;
- production alias target would change;
- rollback target is unknown;
- approval does not name the target source commit.

## Follow-Up

The next execution step is not automatic. It requires 승욱's explicit approval naming the `main` commit that should become fixed staging.
