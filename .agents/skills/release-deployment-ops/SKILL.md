---
name: release-deployment-ops
description: Release and deployment operating workflow for CLAiR EMR. Use when the user asks to deploy, publish, promote, release, update fixed staging, inspect Vercel alias, configure PR preview/main staging/production flow, check env/secret deployment safety, or coordinate production/staging rollout.
---

# Release Deployment Ops

Use this skill for CLAiR EMR preview, fixed staging, and production release requests.

Read the policy first:

- `docs/engineering/operations/release-environment-policy.md`

## Compact Rules

- Identify the target environment before doing anything: PR preview, fixed staging, or production.
- PR/feature branches may use preview deployments only.
- Never attach the fixed staging alias to a feature branch unless 승욱 explicitly approves an integration exception.
- In the Hobby/free target model, fixed staging must come from the long-lived `staging` branch or a clearly named, 승욱-approved integration branch.
- `main` is the Vercel Production branch. Merging/promoting to `main` is a production-release action.
- Production deploy, `main` release, or production promote is blocked until 승욱 explicitly approves the exact target, commit, verification, and rollback path.
- Keep the working repository private. Do not make it public just to unlock branch protection.
- Under the current private/free setup, `CI` and `Secret Scan` run automatically but must be manually checked before merge.
- Before any merge to `staging`, fixed staging URL update, or merge to `main`, apply `docs/engineering/operations/manual-merge-gate-runbook.md`.
- Public portfolio publishing belongs in a future sanitized public repository, not this internal working repository.
- Do not expose secrets in source, docs, Linear, screenshots, logs, or chat.
- Run `npm run security:secrets` before any approved deploy/promotion workflow.
- Report branch, commit SHA, included issues/PRs, deployment URL/id, alias target, verification, and rollback candidate.

## Environment Decisions

When the target is unclear, stop and ask:

```text
어느 환경으로 진행할까? PR preview, fixed staging, production 중 하나로 정해야 해.
```

Default interpretation:

- "preview", "PR URL", "검수 링크" from a work branch means PR preview.
- "고정 스테이징", "fixed staging", "staging alias" means fixed staging.
- "프로덕션", "사용자에게 배포", "production", "promote" means production and requires explicit approval.

## Minimum Secret Safety Gate

Before deployment work, check:

- no tracked `.env*` or `.vercel/.env*` contains secrets;
- no private API key, service role key, DB password, provider secret, token, or credential is in source, docs, Linear, screenshots, logs, or reports;
- no server-only secret is assigned to `NEXT_PUBLIC_*`;
- no server-only secret is imported into browser-bundled code;
- `npm run security:secrets` passes.

Allowed public values include public URLs, Supabase publishable/anon public keys for the correct environment, and non-sensitive feature flags.

## Fixed Staging Workflow

Before changing fixed staging:

1. Confirm this is a release/integration request, not an individual issue thread.
2. Confirm source is `staging` or an approved integration branch.
3. List included issues and PRs.
4. Apply `docs/engineering/operations/manual-merge-gate-runbook.md`.
5. Run the active issue verification plus:

```bash
npm run security:secrets
npm run docs:check
git diff --check
```

6. After deploy, inspect the alias and report the exact deployment target.

If the source branch is a feature branch, stop and ask for explicit approval or redirect to PR preview.

## Production Workflow

Production is user-facing. Do not deploy or promote unless 승욱 explicitly approves:

- target environment: production;
- source branch and commit SHA;
- included issues/PRs;
- env/secret source without values;
- preflight commands;
- smoke path;
- rollback candidate;
- stop condition.

Before production, apply Gate 3 in `docs/engineering/operations/manual-merge-gate-runbook.md` and `docs/engineering/operations/production-release-staging-to-main-runbook.md`.

Minimum production preflight:

```bash
npm run security:secrets
npm run docs:check
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

Add focused tests for changed workflows and any security/data scope required by the active issue.

Production approval packet must include source `staging` commit, current `main` or production deployment, included PRs/issues, fixed staging evidence, preflight results, smoke path, rollback candidate, and stop condition.

## Stop Conditions

Stop and report instead of continuing when:

- secret scan fails;
- any secret appears in tracked files, docs, Linear, screenshots, logs, or chat;
- a preview/staging deployment points at production resources by mistake;
- fixed staging would be assigned from an unapproved feature branch;
- production is requested without explicit approval;
- required smoke checks fail.
