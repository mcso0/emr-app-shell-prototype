---
id: "RELEASE-OPS-PR-001"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "CLAiR EMR Release & Deployment Operations / DEN-443-DEN-446"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/operations/README.md"
  - "docs/engineering/auth-security/auth-login/staging-secret-deployment-readiness-checklist.md"
  - "docs/engineering/agent-orchestration/manual-linear-operations.md"
owner: "Codex"
---

# RELEASE-OPS-PR-001: Release Deployment Policy And Skill

## Goal

Create the first release/deployment operating layer for CLAiR EMR so multiple Codex threads can work safely without overwriting fixed staging or exposing secrets.

Linear issues:

- `DEN-443`: `00-01 Define release environment policy for preview, fixed staging, and production`
- `DEN-444`: `01-01 Add release-deployment-ops skill and connect manual-linear-ops`
- `DEN-445`: `02-01 Plan GitHub/Vercel automation for PR preview and main fixed staging`
- `DEN-447`: `02-02 Confirm Vercel Git integration and preview deployment checks`
- `Pending Linear reauth`: `02-03 Connect or confirm Vercel Git Integration for PR previews` completed locally; Linear issue creation blocked by connector 401.
- `Pending Linear reauth`: `02-04 Add CI workflow for PR and main checks` completed locally; Linear issue creation blocked by connector 401.
- `DEN-448`: `02-05 Redefine Hobby/free staging branch release model`
- `DEN-449`: `02-06 Create staging branch and connect fixed staging URL`
- `DEN-450`: `02-07 Define manual merge gate for staging and production`
- `DEN-451`: `03-02 Define production release from staging to main`
- `DEN-446`: `03-01 Define production promote approval, secret gate, and rollback runbook`

## Scope

- Add `docs/engineering/operations/release-environment-policy.md`.
- Add `docs/engineering/operations/github-vercel-release-automation-plan.md`.
- Add `docs/engineering/operations/vercel-git-integration-preview-checks.md`.
- Add `docs/engineering/operations/vercel-git-integration-execution-plan.md`.
- Add `docs/engineering/operations/fixed-staging-main-only-execution-plan.md` as superseded context.
- Add `docs/engineering/operations/hobby-free-staging-branch-release-plan.md`.
- Add `.agents/skills/release-deployment-ops/SKILL.md`.
- Add `.github/workflows/ci.yml` for PR/main verification only.
- Update manual Linear operations so work-bundle threads can hand off release work safely.
- Update operations and RAG navigation.
- Create Linear project, milestones, and PR-sized issues.

## Out Of Scope

- Actual Vercel/GitHub automation changes.
- Vercel Git connection changes without explicit approval.
- GitHub preview test PR creation without explicit approval.
- Deployment, alias, or production promotion from CI.
- Fixed staging alias movement without an explicitly named `staging` source commit or 승욱-approved integration exception.
- `staging` branch creation, Vercel branch-domain setup, or alias movement without explicit approval.
- Fixed staging redeploy or alias change.
- Production deploy or production promote.
- Secret creation, storage, or rotation.
- Remote Supabase, email, payment, provider integration, or real data operations.

## Done Criteria

- Release policy defines preview, fixed staging, production, alias, approval, rollback, and Minimum Secret Safety Gate rules.
- New release deployment skill routes deployment requests safely.
- Manual Linear operations document allows realistic work bundles while keeping release authority separate.
- Linear project `CLAiR EMR Release & Deployment Operations` exists with DEN-443 through DEN-446.
- Verification passes.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Completion Notes

- 승욱 accepted the project review packet on 2026-06-09. Linear issues DEN-443 through DEN-451 were moved to `Done`.
- Added project review packet for the complete `CLAiR EMR Release & Deployment Operations` workstream:
  `docs/completed/agent-orchestration/2026-06-09-release-deployment-ops-project-review-packet.html`.
- Added release environment policy and production promote runbook.
- Added GitHub/Vercel current-state inspection and automation plan for DEN-445.
- Added Vercel Git Integration and preview readiness read-only check for DEN-447.
- Added 02-03 Vercel Git Integration approval-gated execution plan after read-only API checks; Linear issue creation is pending connector reauthentication.
- After 승욱 approval, connected Vercel Project `emr-app-shell-prototype` to GitHub repo `mcso0/emr-app-shell-prototype`, confirmed production branch `main`, and verified PR preview through PR #97.
- Vercel Preview deployment `dpl_CW3j8N7SvAwrjASnvgkxjzLFt2Yx` became Ready at `https://emr-app-shell-prototype-git-codex-vercel-06809a-mcso0s-projects.vercel.app`.
- Confirmed fixed staging and production aliases were not changed.
- Added `.github/workflows/ci.yml` for PR and `main` checks: docs, lint, typecheck, and build. The workflow does not deploy or move aliases.
- After 승욱 approval, attempted to set GitHub `main` branch required checks for `secret-scan` and `Docs, lint, typecheck, and build`.
- GitHub returned API `403`: private repository branch protection/rulesets require GitHub Pro or making the repository public. Required checks remain manual until plan/settings support branch protection.
- 승욱 chose to keep the working repo private, keep `CI` and `Secret Scan` automatic, verify checks manually before merge, and defer public portfolio work to a separate sanitized repo.
- Superseded fixed staging main-only v1 plan after clarifying Hobby/free Vercel norms.
- Adopted final Hobby/free model: work branches/PRs use Preview, long-lived `staging` owns fixed staging, and `main` remains Vercel Production.
- Registered Linear follow-ups after reauthentication: DEN-448, DEN-449, DEN-450, and DEN-451.
- Completed DEN-449 setup from source commit `d543f91fa7adb027a294d7747540e6cf151fee44`: created remote `staging`, deployed Preview `dpl_HiPcj1BwCzZPRDhMYQSdPcyfsg47`, and pointed fixed staging URL `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app` to `https://emr-app-shell-prototype-ht6n0jz6k-mcso0s-projects.vercel.app`.
- Confirmed production URL `https://emr-app-shell-prototype.vercel.app` still points to production deployment `dpl_6mWWNZcuKyRhVFaUA4FdqxBayAFj`.
- Completed DEN-450 manual merge gate runbook for work PR to `staging`, `staging` to fixed staging URL update, and `staging` to `main` production release preparation.
- Completed DEN-451 production release from `staging` to `main` runbook with approval packet, source integrity checks, production smoke checklist, rollback options, and stop conditions.
- Added `release-deployment-ops` skill.
- Connected `manual-linear-ops` to release/deployment handoff rules.
- Created Linear project and issues DEN-443, DEN-444, DEN-445, and DEN-446.
