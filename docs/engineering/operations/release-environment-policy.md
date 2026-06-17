---
id: ENGINEERING-OPERATIONS-RELEASE-ENVIRONMENT-POLICY
status: approved
area: engineering
doc_type: operating-policy
related_work:
  - DEN-443
  - DEN-444
  - DEN-445
  - DEN-446
supersedes: []
superseded_by: []
last_updated: 2026-06-09
---

# Release Environment Policy

This policy defines how CLAiR EMR moves from Codex work branches to review environments and, later, to user-facing production.

Product MVP work may use preview and fixed staging review paths. Production deploy and production promotion remain explicit-approval work.

## Environment Model

| Environment | Source | Purpose | Allowed by default | Blocked without explicit approval |
| --- | --- | --- | --- | --- |
| PR preview | Feature or PR branch | Isolated issue/work-bundle review | Preview deployment, smoke check, PR review | Changing fixed staging alias, production deploy, production secrets |
| Fixed staging | `main` or an approved integration branch | 승욱/internal QA on a stable URL | Main-integrated release review, synthetic demo data | Feature branch aliasing, production DB/secrets, real data |
| Production | Approved release candidate | User-facing environment | None by default | Any deploy/promote, production env change, real provider activation |

Default operating rule:

```text
work branch / PR = automatic Preview
staging branch = fixed staging
main = Vercel Production
production exposure = explicit approval and smoke verification
```

If the platform is not yet automated to enforce that rule, Codex must treat manual alias changes as high-risk and report the source branch, commit SHA, target URL, and deployment id before and after any approved staging operation.

## Branch And Alias Rules

- Individual work threads may deploy or inspect PR previews only.
- Individual work threads must not run `vercel alias set` for the fixed staging domain.
- Fixed staging must point only to the long-lived `staging` branch deployment unless 승욱 explicitly approves an integration exception.
- A release/integration thread must list the included PRs/issues before changing fixed staging.
- Merging or promoting to `main` is a production-release action and requires a separate explicit approval naming the target environment, operation, commit, verification, and rollback path.
- Keep this working repository private. Do not make it public just to unlock branch protection.
- While private/free branch protection is unavailable, `CI` and `Secret Scan` are automatic visible checks, and merge approval must verify them manually.
- A future public portfolio should be a separate sanitized repository, not this internal working repository.

Current known risk:

- A fixed staging alias is a single mutable pointer. If a feature branch updates that alias, previous unrelated work can appear to be overwritten even when Git history is intact.
- GitHub cannot currently enforce required checks on this private repository under the current plan, so manual merge discipline is part of the release policy.
- Vercel currently treats `main` as the production branch, so `main` must not be used as the routine fixed staging branch.

## Codex Multi-Thread Workflow

승욱 may use one Codex thread for a Linear project or work bundle containing multiple issues. This is allowed when:

- the thread states the work bundle, branch, included issues, and PR strategy;
- changed areas remain coherent enough for one PR;
- the thread stops at PR preview for review;
- fixed staging and production are reserved for release/integration requests.

Recommended request shape for work threads:

```text
이 작업 묶음을 구현해줘. 같은 브랜치/PR로 진행해도 돼.
fixed staging alias와 production은 건드리지 말고 PR preview까지만 공유해줘.
```

Recommended request shape for release threads:

```text
릴리즈 통합 작업을 진행해줘.
대상 PR/이슈 목록을 확인하고 staging 브랜치 기준 fixed staging에만 반영해줘.
main/production은 건드리지 마.
```

## Minimum Secret Safety Gate

This gate is intentionally small. It prevents accidental secret exposure without blocking normal development.

Before any preview, fixed staging, or production operation, verify:

- no tracked `.env*`, provider export, or `.vercel/.env*` file contains secrets;
- no private key, service role key, DB password, provider secret, or token appears in source, docs, Linear, screenshots, logs, or reports;
- no server-only secret is assigned to a `NEXT_PUBLIC_*` variable;
- no server-only secret is imported into client components or browser-bundled code;
- `npm run security:secrets` passes.

Allowed public values:

- public app URLs;
- Supabase publishable/anon public keys when tied to the correct environment;
- non-sensitive feature flags;
- other values intentionally safe for browser inspection.

Blocked examples:

- `SUPABASE_SERVICE_ROLE_KEY` or equivalent in client code;
- database URL with password in a tracked file;
- Vercel, GitHub, Linear, OpenAI, payment, email, Kakao, PACS, or provider API secret in docs/chat/Linear;
- production secret used by preview or fixed staging without explicit approval.

## Fixed Staging Preflight

Before an approved fixed staging deploy or alias update:

```bash
npm run security:secrets
npm run docs:check
git diff --check
```

Also run the active work item's narrow verification commands. For app behavior changes, use typecheck/build/focused Playwright as required by the active issue.

The release report must include:

- target URL;
- source branch;
- commit SHA;
- deployment id or URL;
- included Linear issues/PRs;
- verification commands and results;
- current alias target after deploy;
- rollback candidate or stop condition.

## Manual Merge Gates

Because the current private/free GitHub setup cannot enforce required checks, every merge step must use the manual gate runbook until branch protection becomes available.

Required gate split:

- work branch or PR before merge to `staging`;
- `staging` before fixed staging URL update;
- `staging` before merge or promote to `main` production.

Do not treat a green local build alone as merge approval. The reviewer must also confirm GitHub `CI`, `Secret Scan`, Vercel Preview readiness, included Linear issues/PRs, and non-change of fixed staging or production settings according to the target environment.

Detailed manual gate:

- [Manual Merge Gate Runbook](manual-merge-gate-runbook.md)

## GitHub/Vercel Automation Target

Desired target state:

- GitHub/Vercel integration creates a preview for every PR branch.
- PR previews never receive the fixed staging alias.
- The long-lived `staging` branch owns the fixed staging URL.
- Merging to `main` is a production-release action.
- Production exposure remains separate from fixed staging and requires explicit approval plus smoke verification.

Follow-up implementation should verify:

- Vercel Git integration status for the repo;
- preview deployment behavior on PRs;
- production branch setting;
- fixed staging domain or alias ownership by the `staging` branch;
- deployment protection and review access policy;
- whether fixed staging should use a Vercel branch domain or controlled alias workflow for the `staging` branch.

Do not change Vercel/GitHub settings from this policy document alone. Use an active Linear issue and 승욱 approval.

Detailed automation plan:

- [GitHub And Vercel Release Automation Plan](github-vercel-release-automation-plan.md)
- [Hobby/free Staging Branch Release Plan](hobby-free-staging-branch-release-plan.md)
- [Manual Merge Gate Runbook](manual-merge-gate-runbook.md)
- [Production Release From `staging` To `main` Runbook](production-release-staging-to-main-runbook.md)

## Production Promote Runbook

Production is user-facing. Codex must stop before production deploy/promote unless 승욱 explicitly approves the exact operation.

Approval must name:

- target environment: production;
- source branch and commit SHA;
- included PRs/issues;
- env/secret source, without exposing values;
- preflight commands;
- smoke path;
- rollback candidate;
- stop condition.

Required preflight before approved production promote:

```bash
npm run security:secrets
npm run docs:check
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

Add focused tests for the changed workflows. If auth, DB, RLS, payment, email, provider integration, or real data is involved, use the relevant security/source docs and require explicit approval for those operations too.

Production report must include:

- production URL;
- deployment id;
- source commit;
- included issues/PRs;
- verification results;
- smoke result;
- rollback path;
- known residual risks.

Detailed production release runbook:

- [Production Release From `staging` To `main` Runbook](production-release-staging-to-main-runbook.md)

## Rollback And Stop Conditions

Stop immediately when:

- secret scan fails;
- a secret appears in source, docs, screenshots, logs, or Linear;
- a preview/staging build points at production resources by mistake;
- an unapproved branch would receive fixed staging alias;
- production operation is requested without explicit approval;
- smoke test fails on login, workspace entry, or the scoped primary workflow.

Rollback or forward-fix decision must name:

- previous deployment id or alias target;
- current failed deployment id;
- user/data impact;
- chosen action: rollback, forward-fix, or block;
- owner and verification command.

## Related Docs

- [Operations README](README.md)
- [Launch Readiness Checklist](launch-readiness-checklist.md)
- [Staging Secret And Deployment Readiness Checklist](../auth-security/auth-login/staging-secret-deployment-readiness-checklist.md)
- [Manual Linear Operations](../agent-orchestration/manual-linear-operations.md)
