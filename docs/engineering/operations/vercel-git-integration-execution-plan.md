---
id: ENGINEERING-OPERATIONS-VERCEL-GIT-INTEGRATION-EXECUTION-PLAN
status: superseded
area: engineering
doc_type: execution-plan
related_work:
  - DEN-445
  - DEN-447
supersedes: []
superseded_by:
  - ENGINEERING-OPERATIONS-RELEASE-ENVIRONMENT-POLICY
last_updated: 2026-10-20
---

# Vercel Git Integration Execution Plan

> Historical evidence only. Use [Release Environment Policy](release-environment-policy.md) and the active release work item for current CI/CD configuration, checks, and approval.

This document narrows the next approved step after the DEN-447 read-only check. It does not change Vercel, GitHub, aliases, domains, production, or secrets.

## Execution Result

Executed on 2026-06-09 after 승욱 approved the exact 02-03 scope:

```text
승인: 02-03에서 Vercel Project emr-app-shell-prototype을 GitHub repo mcso0/emr-app-shell-prototype에 연결/확인하고,
production branch를 main으로 확인/설정하며, PR preview 생성 확인용 테스트 브랜치와 PR을 만들어도 된다.
fixed staging alias와 production은 건드리지 마.
```

Result:

| Item | Result |
| --- | --- |
| Vercel Project | `emr-app-shell-prototype` |
| GitHub repo | `mcso0/emr-app-shell-prototype` |
| Vercel Git connection | Connected through `vercel git connect https://github.com/mcso0/emr-app-shell-prototype.git --scope mcso0s-projects --non-interactive` |
| Vercel project API `link` | `type: github`, `org: mcso0`, `repo: emr-app-shell-prototype` |
| Production branch | `main` |
| Test branch | `codex/vercel-pr-preview-smoke` |
| Test PR | <https://github.com/mcso0/emr-app-shell-prototype/pull/97> |
| Test commit | `220e3e96e5c23b1f26bcba8db93f902960aec3b0` |
| Vercel Preview deployment | `dpl_CW3j8N7SvAwrjASnvgkxjzLFt2Yx` |
| Preview URL | <https://emr-app-shell-prototype-git-codex-vercel-06809a-mcso0s-projects.vercel.app> |
| Vercel inspector | <https://vercel.com/mcso0s-projects/emr-app-shell-prototype/CW3j8N7SvAwrjASnvgkxjzLFt2Yx> |
| GitHub PR checks | `secret-scan`, GitBook status contexts, `Vercel`, and `Vercel Preview Comments` succeeded |
| Deployment target | `preview` |

Alias non-change evidence after execution:

- fixed staging still points to `emr-app-shell-prototype-gbj5vwjhd-mcso0s-projects.vercel.app`;
- production aliases still point to `emr-app-shell-prototype-32da67as6-mcso0s-projects.vercel.app`;
- only the PR branch alias was added: `emr-app-shell-prototype-git-codex-vercel-06809a-mcso0s-projects.vercel.app`.

Not changed:

- fixed staging alias;
- production deploy or production promote;
- production aliases/domains;
- secret/env values.

Linear update remains blocked by connector authentication:

- Linear returned `401 reauthentication required` when creating `02-03 Connect or confirm Vercel Git Integration for PR previews`.

## Current Read-Only Result

Observed on 2026-06-09 through Vercel API, GitHub CLI, and local project state:

| Check | Result | Interpretation |
| --- | --- | --- |
| Vercel project API `link` | `null` | The project does not expose a connected Git repository through the project `link` field. |
| Vercel project API `gitRepository` | `null` | Git Integration is still not proven as connected. |
| Vercel project API `gitComments` | pull request comments enabled, commit comments disabled | The project has Git comment preferences, but this is not enough to prove repository connection. |
| Vercel project API `gitProviderOptions.createDeployments` | enabled | Deployment creation for Git provider flows is enabled, but repository connection still needs confirmation. |
| Recent Vercel deployments | recent deployments have `target: null` | Recent deployments are Preview/manual style deployments, not fixed `main` or production deployments. |
| Recent Vercel deployment metadata | GitHub branch and commit metadata exists; many have `gitDirty=1` | CLI/manual deployments can carry Git metadata. Treat this as source metadata, not proof of automatic PR preview integration. |
| Recent GitHub PR checks | `secret-scan` and GitBook status contexts; no Vercel check run visible | PR preview checks/comments are not confirmed from GitHub evidence. |
| Linear tool | 401 reauthentication required | Linear issue creation/update is blocked until the connector is reauthenticated. |

Conclusion:

- Vercel Git Integration remains unconfirmed.
- Current deployments look like manually created Preview deployments with Git metadata.
- No fixed staging alias, production alias, or remote Git/Vercel setting should be changed from this issue.

## Approval-Gated Target

Recommended next Linear issue title after connector reauthentication:

```text
02-03 Connect or confirm Vercel Git Integration for PR previews
```

Goal:

- Confirm or connect Vercel Project `emr-app-shell-prototype` to GitHub repo `mcso0/emr-app-shell-prototype`.
- Confirm production branch tracking is `main`.
- Confirm PR/branch preview deployments are enabled.
- Verify that a test PR receives a Vercel Preview deployment or Vercel PR comment/check.

Still out of scope:

- fixed staging alias changes;
- production deploy or production promote;
- production alias/domain changes;
- secret value creation, reading, printing, storing, or rotation;
- live Supabase, email, payment, provider, or real-data operations.

## Exact Approval Needed Before Remote Changes

Do not run `vercel git connect`, use Vercel Dashboard write settings, create a preview test PR, or mutate GitHub/Vercel configuration until 승욱 explicitly approves the target operation.

Acceptable approval wording:

```text
승인: 02-03에서 Vercel Project emr-app-shell-prototype을 GitHub repo mcso0/emr-app-shell-prototype에 연결/확인하고,
production branch를 main으로 확인/설정하며, PR preview 생성 확인용 테스트 브랜치와 PR을 만들어도 된다.
fixed staging alias와 production은 건드리지 마.
```

If that approval is not present, stop at read-only checks and documentation.

## Execution Steps After Approval

1. Run preflight:

```bash
npm run security:secrets
git diff --check
```

2. In Vercel Dashboard or approved Vercel CLI/API path, confirm:

- Project: `emr-app-shell-prototype`
- Git repository: `mcso0/emr-app-shell-prototype`
- Production Branch: `main`
- Preview deployments enabled for non-production branches
- Pull request comments/checks enabled if available
- Ignored Build Step is not blocking PR preview deployment

3. If the repo is not connected, connect the repo only after explicit approval.
4. Create a low-risk test branch from `main`.
5. Commit a docs-only no-op change.
6. Open a PR to `main`.
7. Confirm:

- GitHub shows `Secret Scan`;
- Vercel creates a Preview deployment or PR comment/check;
- the Preview deployment is not production;
- fixed staging alias target is unchanged;
- production aliases are unchanged.

8. Close or keep the test PR based on 승욱's direction.
9. Record branch, commit SHA, PR URL, Vercel deployment URL/id, and alias non-change evidence.

## If Dashboard Access Is Required

The CLI/API did not expose enough state to prove the Git repository connection. If Vercel Dashboard is required, ask 승욱 to either:

- confirm the fields manually from Project Settings; or
- approve guided dashboard changes with the exact target project and repository named.

Do not infer the connection from Git metadata alone.

## Follow-Up Issues

After `02-03` is verified:

1. `02-04 Add CI workflow for PR and main checks`
   - Add repo CI for docs, secret scan, lint, typecheck, and build.
   - Do not deploy.

2. `02-05 Configure fixed staging from main only`
   - Choose Vercel branch-domain/custom-environment binding or a repo-controlled alias workflow.
   - Move the fixed staging alias only after explicit approval.

3. `03-02 Production promote dry-run checklist`
   - Build the production approval packet and rollback drill.
   - Do not deploy.

## Read-Only Commands Used

These commands were read-only and did not print secret values:

```bash
gh pr list --repo mcso0/emr-app-shell-prototype --state all --limit 10 --json number,title,state,headRefName,baseRefName,url,createdAt,updatedAt,statusCheckRollup
gh api repos/mcso0/emr-app-shell-prototype/commits/main/check-runs
```

The Vercel checks used the local Vercel CLI auth token only as an authorization header and printed filtered project/deployment metadata:

- project id, name, framework, Node version, account id;
- `link` and `gitRepository` presence only;
- Git comment/provider option booleans;
- recent deployment URL/id/target/state and Git commit metadata.

No environment variable values, token values, secret values, or deployment protection bypass values were printed.

## References

- Vercel Git deployments: <https://vercel.com/docs/deployments/git>
- Vercel assigning domains to Git branches: <https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch>
- GitHub Actions workflow syntax: <https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions>
