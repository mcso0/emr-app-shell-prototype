---
id: ENGINEERING-OPERATIONS-GITHUB-VERCEL-RELEASE-AUTOMATION-PLAN
status: approved
area: engineering
doc_type: implementation-plan
related_work:
  - DEN-445
supersedes: []
superseded_by: []
last_updated: 2026-06-09
---

# GitHub And Vercel Release Automation Plan

This plan turns the release environment policy into an executable GitHub/Vercel configuration sequence. It does not change any remote setting by itself.

## Current Observed State

Observed on 2026-06-08 from local repo, GitHub CLI, and Vercel CLI:

| Area | Observed state | Meaning |
| --- | --- | --- |
| GitHub repo | `mcso0/emr-app-shell-prototype`, private, default branch `main` | `main` is the Vercel Production branch and is no longer the routine fixed-staging integration branch. |
| GitHub Actions | `Secret Scan`, `Docs External Link Check` only | There is no repo workflow that deploys preview, staging, or production. |
| Secret scan workflow | Runs on PRs and pushes to `main` | Useful deploy gate already exists. |
| Vercel local project | `.vercel/project.json` links to `emr-app-shell-prototype`, project id `prj_iCK5KPP0IBMm7crAqcruCHO4JSlV` | Local CLI is linked to the expected Vercel project. |
| Vercel project settings via CLI | Next.js, root `.`, Node 24.x | Build defaults are compatible with app settings. |
| Recent Vercel deployments | Recent deployments are `Preview` environment | Recent work has been manually deployed as previews. |
| Fixed staging alias | `emr-app-shell-prototype-staging-mcso0s-projects.vercel.app` points to a preview deployment | After DEN-449, fixed staging is owned by the long-lived `staging` branch model. The current alias was attached manually after a Preview deploy. |
| Production aliases | `emr-app-shell-prototype.vercel.app` and `emr-app-shell-prototype-mcso0s-projects.vercel.app` point to a production deployment from 2026-05-12 | Production exists but is not part of this execution plan. |
| GitHub branch protection/rulesets | CLI lookup returned a plan/API limitation for private repo rulesets/protection | Branch protection must be confirmed manually in GitHub UI or with an upgraded/API-capable plan. |
| Open PRs | None at the time of inspection | Automation can be planned before active PR rollout. |

Current risk:

- A feature branch can still produce a Vercel preview and then manually receive the fixed staging alias if an agent runs `vercel alias set`.
- GitHub does not currently show a deployment workflow that would guarantee `main` is the only fixed staging source.
- Branch protection could not be verified from the CLI, so direct pushes to `main` may or may not be blocked by policy.

## Target Operating Model

Desired behavior:

| Event | Expected result |
| --- | --- |
| Push to feature branch | Vercel creates a preview deployment. |
| Open PR to `main` | PR has preview URL and required checks. |
| Merge approved work to `staging` | fixed staging gets the latest integrated review candidate. |
| Fixed staging update | Staging URL points to the latest verified `staging` branch deployment. |
| Merge or promote to `main` | Production release action; requires explicit approval. |

The preferred Hobby/free end state uses Vercel Git Integration for PR previews, a long-lived `staging` branch for fixed staging, and `main` as the Vercel Production branch.

## Recommended Configuration Sequence

### Step 1: Confirm Vercel Git Integration

Check in Vercel dashboard:

- Project: `emr-app-shell-prototype`
- Git repository: `mcso0/emr-app-shell-prototype`
- Production branch: `main`
- Preview deployments enabled for non-production branches
- Pull request comments/checks enabled if available

Do not change production domain behavior in this step.

Decision:

- If Git Integration is already connected, keep CLI manual deploys for emergency/explicit use only.
- If Git Integration is not connected, connect it before adding staging automation.

### Step 2: Decide Fixed Staging Implementation

Recommended v1:

- Create a long-lived `staging` branch.
- Create or reserve a fixed staging domain/alias.
- Configure it to follow the `staging` branch only.
- Do not let issue branches or `main` set the fixed staging alias during routine work.

Acceptable options:

| Option | Use when | Tradeoff |
| --- | --- | --- |
| Vercel branch domain assigned to `staging` | Hobby/free staging with a persistent URL | Simple and aligned with Vercel's branch-preview guidance. |
| Vercel custom environment | Team is on Pro/Enterprise | Cleaner staging semantics, but not available in the current Hobby/free setup. |
| GitHub Action alias after `staging` checks | Need explicit repo-controlled deploy gate | More transparent, but requires Vercel token secret and workflow maintenance. |

Recommended for this repo:

- Use a `staging` branch with branch-specific fixed staging URL for Hobby/free.
- Use a repo-controlled GitHub Action only if Vercel dashboard cannot bind the staging alias safely to `staging`.
- Keep production aliases separate and untouched.

### Step 3: Add Required GitHub Checks Before Main Merge

Minimum required checks for PRs to `main`:

```bash
npm run security:secrets
npm run docs:check
npm run lint
npx tsc --noEmit
npm run build
```

Recommended GitHub Actions:

- keep `Secret Scan`;
- add a `CI` workflow for lint, typecheck, build, and docs check on `pull_request` and `push` to `main`;
- optionally add focused Playwright jobs later by area.

Branch policy target:

- require PR before merging to `main`;
- require `Secret Scan` and `CI` checks;
- restrict direct pushes to `main` if available;
- keep production deploy/promote outside routine PR merge.

Current blocker:

- GitHub branch protection and repository rulesets are blocked for this private repository by the current GitHub plan/API response.
- Decision on 2026-06-09: keep the working repository private and do not upgrade only for branch protection at this stage.
- Do not make this working repository public as a workaround.
- `CI` and `Secret Scan` still run automatically, but GitHub cannot enforce them as required checks under the current private/free setup.
- Merge discipline is manual until a future plan/settings change enables branch protection.
- Public portfolio publishing should use a separate sanitized public repository later, not this internal working repository.

Manual merge gate while branch protection is unavailable:

- PR targets `main`.
- `CI` succeeded.
- `Secret Scan` succeeded.
- Vercel Preview is Ready.
- The PR did not change fixed staging alias, production aliases, production deploy settings, or secrets.
- The merge reviewer records any known residual risk in the PR or release note.

### Step 4: Fixed Staging Publish Gate

Before fixed staging moves:

- source branch must be `staging` or an explicitly approved integration branch;
- included PRs/issues must be listed;
- `npm run security:secrets`, `npm run docs:check`, and `git diff --check` must pass;
- app checks required by the merged PRs must be recorded;
- alias target must be inspected after update.

If using GitHub Action:

- trigger on `push` to `staging`;
- run required checks first;
- deploy or promote the `staging` build to fixed staging only after checks pass;
- inspect alias target and print the deployment URL in workflow summary;
- keep Vercel token in GitHub Actions secrets only, never in repo/docs/chat.

### Step 5: Production Remains Manual

Production promote must remain blocked until 승욱 explicitly approves:

- target environment: production;
- source commit SHA;
- included PRs/issues;
- env/secret source without values;
- smoke path;
- rollback candidate;
- stop condition.

No GitHub Action should automatically promote `main` to user-facing production until a separate production launch policy issue approves that behavior.

## Execution Issues To Create Next

Create or update these only after 승욱 approves moving from plan to remote configuration. The Linear connector returned `401 reauthentication required` on 2026-06-09, so local docs may temporarily lead until the connector is reauthenticated.

2026-06-09 execution update:

- `02-03 Connect or confirm Vercel Git Integration for PR previews` completed locally after 승욱 approval.
- `02-04 Add CI workflow for PR and main checks` added `.github/workflows/ci.yml`.
- `02-06 Create staging branch and connect fixed staging URL` completed after 승욱 approval.
- `02-07 Define manual merge gate for staging and production` completed as `manual-merge-gate-runbook.md`.
- `03-02 Define production release from staging to main` completed as `production-release-staging-to-main-runbook.md`.
- The new `CI` workflow runs on `pull_request` and `push` to `main`.
- The workflow is verification-only: `npm run docs:check`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- It does not deploy, promote, update aliases, create secrets, or touch Vercel production/fixed staging settings.
- Attempting to configure `main` branch protection required checks for `secret-scan` and `Docs, lint, typecheck, and build` returned GitHub API `403`: private repository branch protection/rulesets require GitHub Pro or making the repository public.
- Until the GitHub plan/settings allow branch protection, required checks cannot be enforced remotely. Treat `CI` and `Secret Scan` as visible checks plus manual merge discipline.
- 승욱 chose the current operating mode: keep the repo private, keep `CI` and `Secret Scan` automatic, manually verify checks before merge, and split public portfolio work into a future sanitized repository.
- Remote `staging` now exists at source commit `d543f91fa7adb027a294d7747540e6cf151fee44`.
- Initial fixed staging setup used manual Vercel Preview deployment `dpl_HiPcj1BwCzZPRDhMYQSdPcyfsg47` because pushing `staging` at an already-deployed `main` commit did not create a new automatic Vercel Git deployment.
- Fixed staging URL `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app` now points to `https://emr-app-shell-prototype-ht6n0jz6k-mcso0s-projects.vercel.app`.
- Production URL `https://emr-app-shell-prototype.vercel.app` was not changed.
- Manual gates now define work PR to `staging`, `staging` to fixed staging URL update, and `staging` to `main` production release preparation.
- Production release preparation now has a dedicated approval packet, smoke checklist, rollback candidate, and stop-condition runbook.

1. `02-02 Confirm Vercel Git integration and preview deployment checks`
   - DEN-447 read-only result: CLI/GitHub evidence could not prove active Vercel Git Integration.
   - Use the dashboard checklist in `vercel-git-integration-preview-checks.md` before any remote setting change.

2. `02-03 Connect or confirm Vercel Git Integration for PR previews`
   - Approval-gated execution plan: `vercel-git-integration-execution-plan.md`.
   - Confirm or connect GitHub repo in Vercel.
   - Confirm production branch tracking is `main`.
   - Verify PR preview creation on a test branch.
   - No fixed staging alias changes.

3. `02-04 Add CI workflow for PR and main checks`
   - Add GitHub Actions workflow for docs, secret, lint, typecheck, and build.
   - Keep deploy out of the workflow.
   - Require checks manually in GitHub UI if plan supports it.
   - Local implementation added `.github/workflows/ci.yml`; Linear issue creation is pending connector reauthentication.

4. `02-05 Configure fixed staging from main only`
   - Superseded by the Hobby/free staging branch model.
   - Read-only result on 2026-06-09: Vercel production branch is `main`, so do not bind routine `main` Git deployments directly to fixed staging.
   - Current target model: `PR Preview -> staging branch fixed staging -> main Production`.
   - Current plan: `hobby-free-staging-branch-release-plan.md`.

5. `02-06 Create staging branch and connect fixed staging URL`
   - Completed after 승욱 approval on 2026-06-09.
   - Remote `staging` branch was created from `d543f91fa7adb027a294d7747540e6cf151fee44`.
   - Fixed staging URL now points to Preview deployment `dpl_HiPcj1BwCzZPRDhMYQSdPcyfsg47`.
   - Production was not changed.

6. `02-07 Define manual merge gate for staging and production`
   - Completed as `manual-merge-gate-runbook.md`.
   - Defines manual checks while GitHub cannot enforce required checks on the current private/free setup.
   - No remote settings change.

7. `03-02 Production promote dry-run checklist`
   - Completed as `production-release-staging-to-main-runbook.md`.
   - Defines the production approval packet, source integrity checks, smoke checklist, rollback candidate, and stop conditions.
   - Do not deploy.

## Manual Verification Commands Used For This Plan

```bash
gh repo view mcso0/emr-app-shell-prototype --json nameWithOwner,defaultBranchRef,visibility,isPrivate,viewerPermission
gh workflow list --repo mcso0/emr-app-shell-prototype
gh pr list --repo mcso0/emr-app-shell-prototype --state open --limit 20 --json number,title,headRefName,baseRefName,url,statusCheckRollup
npx -y vercel@latest project inspect emr-app-shell-prototype --scope mcso0s-projects
npx -y vercel@latest inspect emr-app-shell-prototype-staging-mcso0s-projects.vercel.app --scope mcso0s-projects
npx -y vercel@latest alias ls --scope mcso0s-projects
npx -y vercel@latest ls emr-app-shell-prototype --scope mcso0s-projects
```

GitHub ruleset and branch protection API checks returned a plan/API limitation for the private repository. Confirm those in GitHub UI before enforcing this plan.

DEN-447 follow-up:

- [Vercel Git Integration And Preview Checks](vercel-git-integration-preview-checks.md)
- [Vercel Git Integration Execution Plan](vercel-git-integration-execution-plan.md)

## External References

- Vercel Git deployments: <https://vercel.com/docs/deployments/git>
- Vercel assigning domains to Git branches: <https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch>
- Vercel alias CLI: <https://vercel.com/docs/cli/alias>
- GitHub Actions workflow syntax: <https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions>
- GitHub repository rulesets: <https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>
