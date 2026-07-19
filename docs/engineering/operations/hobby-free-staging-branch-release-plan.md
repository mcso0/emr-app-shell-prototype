---
id: ENGINEERING-OPERATIONS-HOBBY-FREE-STAGING-BRANCH-RELEASE-PLAN
status: approved
area: engineering
doc_type: operating-plan
related_work:
  - DEN-445
supersedes:
  - ENGINEERING-OPERATIONS-FIXED-STAGING-MAIN-ONLY-EXECUTION-PLAN
superseded_by: []
last_updated: 2026-06-09
---

# Hobby/free Staging Branch Release Plan

This is the target release model for the current GitHub/Vercel Hobby/free setup.

## Current Setup Result

Executed for DEN-449 on 2026-06-09 after 승욱 approval:

| Item | Result |
| --- | --- |
| Source commit | `d543f91fa7adb027a294d7747540e6cf151fee44` |
| Remote `staging` branch | Created at the same commit as `origin/main` |
| Vercel deployment | `dpl_HiPcj1BwCzZPRDhMYQSdPcyfsg47` |
| Deployment URL | <https://emr-app-shell-prototype-ht6n0jz6k-mcso0s-projects.vercel.app> |
| Deployment target | `preview` |
| fixed staging URL | <https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app> |
| production URL | <https://emr-app-shell-prototype.vercel.app> unchanged |
| production deployment | `dpl_6mWWNZcuKyRhVFaUA4FdqxBayAFj` unchanged |

Important implementation note:

- Pushing `staging` at an already-deployed `main` commit did not automatically create a Vercel Git deployment.
- The initial fixed staging setup therefore used a clean local `staging` worktree, a manual Vercel Preview deployment, and an alias update for the fixed staging URL.
- Future `staging` updates should verify whether Vercel creates automatic branch previews for new `staging` commits. If not, repeat the explicit Preview deploy plus fixed staging alias update flow.
- Production aliases were not changed.

## Final Target Model

```text
work branches / PRs = Vercel Preview
staging branch = fixed staging
main branch = Vercel Production
```

Meaning:

- Work happens on feature or `codex/*` branches.
- Every PR gets an automatic Vercel Preview.
- Approved work is integrated into the long-lived `staging` branch for fixed staging review.
- Production remains the Vercel production branch, currently `main`.
- Merging to `main` is a production-release action and requires explicit approval.

## Why This Model

This matches the common Vercel model for Hobby/free projects:

- Vercel treats `main` as the production branch by default.
- Branches other than the production branch become Preview deployments.
- Hobby/free users can create a long-lived `staging` branch and attach a staging domain/branch alias to it.
- Pro/Enterprise custom environments are not required for this v1.

This also avoids making the working repository public or upgrading GitHub only for branch protection.

## Current Constraints

| Constraint | Decision |
| --- | --- |
| GitHub repo stays private | Yes. Do not make the working repo public. |
| GitHub required checks unavailable on current private/free setup | Run one combined `Release Check` manually for the exact merge candidate and keep the local secret gate mandatory. |
| Vercel production branch is `main` | Keep `main` as production. |
| fixed staging needs a stable URL | Use a long-lived `staging` branch and staging branch alias/domain. |
| public portfolio need | Use a future sanitized public repo, not this working repo. |

## Operating Flow

1. Create work on a feature or `codex/*` branch.
2. Open a PR to the intended integration branch.
3. Verify:
   - the manually dispatched `Release Check` succeeded for the exact candidate commit;
   - `npm run security:secrets` succeeded locally;
   - Vercel Preview is Ready;
   - the PR did not touch fixed staging alias, production aliases, production deploy settings, or secrets.
4. Merge approved work into `staging` for fixed staging review.
5. Verify the fixed staging URL after the `staging` branch deployment is Ready.
6. After explicit production approval, merge or promote the approved release commit to `main`.

Use [Manual Merge Gate Runbook](manual-merge-gate-runbook.md) for every merge or staging URL update while GitHub required checks cannot be enforced on the current private/free setup.

## Setup Issues To Track

Use the existing Linear project `CLAiR EMR Release & Deployment Operations`.

Recommended issue changes:

1. `02-05 Redefine Hobby/free staging branch release model`
   - Supersede the main-only fixed staging plan.
   - Adopt `PR Preview -> staging branch -> main Production`.
   - No remote settings change.

2. `02-06 Create staging branch and connect fixed staging URL`
   - Create long-lived `staging` branch from the chosen source commit.
   - Configure Vercel branch alias/domain for the `staging` branch.
   - Verify fixed staging URL points to the `staging` branch deployment.
   - Requires explicit approval before remote branch/domain/alias changes.

3. `02-07 Define manual merge gate for staging and production`
   - Completed as `manual-merge-gate-runbook.md`.
   - Documents required manual checks because GitHub cannot enforce required checks on the current private/free setup.
   - Define who runs the combined `Release Check`, verifies Vercel Preview, fixed staging, and production non-change.
   - No remote settings change.

4. `03-02 Define production release from staging to main`
   - Completed as `production-release-staging-to-main-runbook.md`.
   - Define approval packet for moving from `staging` to `main`.
   - Confirm production smoke, rollback target, and included PRs/issues.
   - Do not deploy production until explicitly approved.

## Required Approval Before Remote Changes

Do not create/push the long-lived `staging` branch, move fixed staging aliases, configure Vercel domains, or touch production without explicit approval.

Acceptable approval wording for staging setup:

```text
승인: staging 브랜치를 <source SHA> 기준으로 만들고,
fixed staging URL을 staging 브랜치 Preview에 연결해줘.
production과 main production alias는 건드리지 마.
```

Acceptable approval wording for production release:

```text
승인: staging commit <SHA>를 production release로 main에 반영해줘.
포함 PR/이슈는 <list>이고, production smoke와 rollback 후보를 보고해줘.
```

Detailed production release procedure:

- [Production Release From `staging` To `main` Runbook](production-release-staging-to-main-runbook.md)

## Stop Conditions

Stop when:

- target source commit is not named;
- the manual `Release Check` or local secret gate is failing or unknown;
- Vercel Preview is not Ready;
- fixed staging alias would point to a feature branch instead of `staging`;
- production alias would change without production approval;
- any secret/env value would be exposed in docs, chat, Linear, screenshots, or logs.

## References

- Vercel Git deployments: <https://vercel.com/docs/deployments/git>
- Vercel custom environments: <https://vercel.com/docs/deployments/custom-environments>
- Vercel staging environment guide: <https://vercel.com/kb/guide/set-up-a-staging-environment-on-vercel>
