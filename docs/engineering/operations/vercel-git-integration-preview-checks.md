---
id: ENGINEERING-OPERATIONS-VERCEL-GIT-INTEGRATION-PREVIEW-CHECKS
status: superseded
area: engineering
doc_type: verification-plan
related_work:
  - DEN-447
supersedes: []
superseded_by:
  - ENGINEERING-OPERATIONS-RELEASE-ENVIRONMENT-POLICY
last_updated: 2026-10-20
---

# Vercel Git Integration And Preview Checks

> Historical evidence only. Use [Release Environment Policy](release-environment-policy.md) and the active release work item for current CI/CD configuration, checks, and approval.

This document records the read-only DEN-447 check for Vercel Git Integration and PR preview readiness. No Vercel/GitHub setting was changed.

## Read-Only Findings

Observed on 2026-06-08:

| Check | Result | Interpretation |
| --- | --- | --- |
| Vercel CLI `project inspect` | Shows project, framework, root, Node version only | CLI does not expose Git repository connection details. |
| Vercel CLI `git --help` | Supports `connect` and `disconnect`, not read-only list/status | Do not run without explicit approval because it mutates Git connection. |
| Vercel deployment JSON for current fixed staging target | Shows preview deployment id/target but no `gitSource`/GitHub metadata | Current fixed staging target looks like a CLI/manual preview deployment. |
| Vercel deployment JSON for production alias target | Shows production deployment id/target but no `gitSource`/GitHub metadata | Production exists, but Git source evidence is not available through this CLI output. |
| Vercel aliases | fixed staging alias points at a preview deployment | Confirms fixed staging is a mutable alias, not proven as `main` branch automation. |
| Vercel env list | Preview environment variables exist; values remain encrypted | Good: no secret values were exposed. Not proof of Git automation. |
| Vercel domains list | No account-level domains returned | Project aliases exist, but custom domain management needs dashboard/API confirmation. |
| GitHub repo hooks | Empty result | No repo webhooks visible; GitHub App integrations may not appear here, so this is not conclusive. |
| GitHub deployments API | Empty result | No GitHub deployment records from Vercel are visible. |
| GitHub check runs on `main` | GitHub Actions checks only: docs link check and secret scan | No Vercel check run was visible on `main`. |
| GitHub Actions runs | `Secret Scan` runs on PR and push to `main`; docs link check runs on schedule | CI exists only for secret scan plus scheduled docs link check. |

Conclusion:

- Vercel Git Integration is not proven from CLI/GitHub evidence.
- PR preview checks are not currently visible in GitHub as Vercel checks.
- Fixed staging remains a manually movable alias unless dashboard settings prove otherwise.
- Any connection or branch-domain setup must be treated as a remote configuration change and require explicit approval.

## Dashboard Checks Required

These are UI checks because the available CLI/API output did not expose enough state.

In Vercel Dashboard, check Project `emr-app-shell-prototype`:

- Git repository is connected to `mcso0/emr-app-shell-prototype`.
- Production branch is `main`.
- Preview deployments are enabled for non-production branches.
- Pull request comments/checks are enabled if the plan supports them.
- Ignored Build Step is not preventing PR previews.
- Deployment protection policy is known for preview/fixed staging review.
- The fixed staging alias/domain is not assigned to arbitrary feature branches.

In GitHub UI, check repository `mcso0/emr-app-shell-prototype`:

- Vercel GitHub App is installed for this repository, if using Vercel Git Integration.
- Branch rules or rulesets require PR before merge to `main`.
- Required checks include `Secret Scan` and the future `CI` workflow.
- Direct pushes to `main` are restricted if the current plan supports that feature.

## Approved Next Execution Shape

The next execution issue should be explicit about which remote setting may be changed.

Recommended next issue:

```text
02-03 Connect or confirm Vercel Git Integration for PR previews
```

Allowed after explicit approval:

- connect Vercel project to `mcso0/emr-app-shell-prototype` if not connected;
- set or confirm production branch `main`;
- enable PR preview comments/checks if available;
- create a test branch and PR to verify preview creation.

Still blocked:

- fixed staging alias change;
- production deploy/promote;
- production alias/domain changes;
- secret creation, storage, or rotation in docs/chat/repo;
- any action that would send real email, use real data, or touch live provider/payment integrations.

2026-06-09 follow-up:

- Additional read-only Vercel API checks are recorded in [Vercel Git Integration Execution Plan](vercel-git-integration-execution-plan.md).
- Vercel project API still did not expose a connected repository through `link` or `gitRepository`.
- Recent deployments have GitHub metadata but remain Preview/manual style deployments, so Git metadata alone must not be treated as proof of Vercel Git Integration.

## Preview Verification Procedure

After approval to run a preview integration test:

1. Create a low-risk test branch from `main`.
2. Commit a docs-only or no-op safe change.
3. Open PR to `main`.
4. Confirm GitHub checks include:
   - `Secret Scan`
   - any future `CI`
   - Vercel preview check or Vercel PR comment
5. Confirm Vercel creates a Preview deployment for that branch/PR.
6. Confirm fixed staging alias still points to its previous target.
7. Close the PR or leave it as a documented test PR based on 승욱's direction.

## Commands Used

```bash
npx -y vercel@latest project inspect emr-app-shell-prototype --scope mcso0s-projects
npx -y vercel@latest git --help
npx -y vercel@latest inspect emr-app-shell-prototype-gbj5vwjhd-mcso0s-projects.vercel.app --scope mcso0s-projects --format=json
npx -y vercel@latest inspect emr-app-shell-prototype-32da67as6-mcso0s-projects.vercel.app --scope mcso0s-projects --format=json
npx -y vercel@latest alias ls --scope mcso0s-projects
npx -y vercel@latest env ls --scope mcso0s-projects
npx -y vercel@latest domains ls --scope mcso0s-projects
gh api repos/mcso0/emr-app-shell-prototype/hooks
gh api 'repos/mcso0/emr-app-shell-prototype/deployments?per_page=20'
gh api repos/mcso0/emr-app-shell-prototype/commits/main/check-runs
gh api 'repos/mcso0/emr-app-shell-prototype/actions/runs?per_page=10'
```

## Official References

- Vercel Git deployments: <https://vercel.com/docs/deployments/git>
- Vercel assigning domains to Git branches: <https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch>
- GitHub Actions workflow syntax: <https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions>
