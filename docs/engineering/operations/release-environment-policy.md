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
  - RELEASE-OPS-PR-003
  - RELEASE-OPS-PR-004
supersedes:
  - ENGINEERING-OPERATIONS-HOBBY-FREE-STAGING-BRANCH-RELEASE-PLAN
superseded_by: []
last_updated: 2026-09-03
---

# Release Environment Policy

This policy defines the active CLAiR EMR path from a work branch to user-facing Production.

The repository is operated by one owner without a separate staging review audience. The active model therefore uses PR Preview for pre-merge review and keeps `origin/main` as the single source of truth and Vercel Production branch.

## Environment Model

| Environment | Source | Purpose | Allowed by default | Blocked without explicit approval |
| --- | --- | --- | --- | --- |
| PR Preview | Feature or `codex/*` branch | Isolated review and scoped smoke | Preview deployment, inspection, test | `main` merge, Production settings, real data |
| Production | `main` | Current user-facing version | Read-only inspection | PR merge, deploy/promote, Production env or alias change |

Active operating rule:

```text
work branch -> PR to main -> automatic Vercel Preview
exact PR head -> manual Release Check -> explicit Production approval
approved PR -> main -> Vercel Production -> scoped smoke
```

There is no active long-lived `staging` branch, fixed staging alias, or fixed-staging alias automation. Historical staging plans remain in the repository as superseded records only.

## Branch Rules

- `origin/main` is the canonical latest version and Vercel Production source.
- Routine work uses a feature or `codex/*` branch and a PR targeting `main`.
- Do not push directly to `main` for routine work.
- PR Preview is the only active pre-production review environment.
- A merge to `main` is a Production release, even for documentation-only changes.
- The exact PR head SHA must be recorded before the merge gate runs.
- If the head SHA changes, previous approval and checks do not apply; recompute the candidate and rerun required checks.
- Keep the repository private. A future public portfolio belongs in a separate sanitized repository.

## Why Staging Was Retired

The previous Hobby/free model used a long-lived `staging` branch and a mutable fixed alias. Live inspection on 2026-09-03 showed:

- `staging` had no unique commits and was behind `main`;
- the fixed alias pointed to an older Preview deployment rather than the current branch head;
- recent releases were already being reviewed in PR Preview and merged directly to `main`;
- the repository has one owner and no current external staging review audience.

Keeping that second release line would add branch, alias, automation, and documentation maintenance without adding an independent review gate. PR Preview plus an exact-candidate Production gate is the smaller active model.

## Minimum Secret Safety Gate

Before any Preview or Production operation, verify:

- no tracked `.env*`, provider export, or `.vercel/.env*` file contains secrets;
- no private key, service role key, DB password, provider secret, or token appears in source, docs, Linear, screenshots, logs, or reports;
- no server-only secret is assigned to `NEXT_PUBLIC_*`;
- no server-only secret is imported into client components or browser-bundled code;
- `npm run security:secrets` passes.

Allowed public values include public app URLs, environment-appropriate Supabase publishable/anon keys, and non-sensitive feature flags.

## Manual Merge Gate

GitHub cannot currently enforce required checks for this private repository under the current plan. Manual discipline is therefore mandatory.

Before asking for a `main` merge:

1. confirm the PR targets `main`;
2. record the exact PR head SHA and changed scope;
3. confirm the Vercel Preview is Ready;
4. run one manually dispatched `Release Check` for that exact SHA;
5. run the local secret gate and any focused verification required by the work;
6. identify the current `origin/main`, current Production deployment, smoke path, rollback candidate, and stop condition;
7. show the packet to 승욱 and stop for explicit Production approval.

Do not treat a green local build, an old check, or a mergeable PR as approval.

Detailed gate:

- [Manual Merge Gate Runbook](manual-merge-gate-runbook.md)
- [Production Release From PR To `main` Runbook](production-release-pr-to-main-runbook.md)

## Production Approval

Approval must identify:

- target: Production / `main`;
- PR number, source branch, and exact head SHA;
- included work and intentionally excluded scope;
- exact-candidate verification;
- Production action;
- smoke path;
- rollback candidate;
- stop condition.

Minimum Production preflight:

```bash
npm run security:secrets
npm run docs:check
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

Focused tests are required when application behavior changes. Remote Supabase, migration, real data, payment, email, or provider actions require their own explicit scope and approval.

## Production Verification

After an approved merge:

- fetch the live `origin/main` SHA and verify it contains the merge commit;
- verify the Vercel Production deployment is Ready and tied to that SHA;
- if Vercel intentionally skips a docs-only build, report the latest Ready deployment and prove its source SHA is an ancestor of `origin/main`;
- probe `/login` and perform only the scoped smoke promised in the packet;
- record the previous Ready deployment or revert commit as rollback evidence;
- report any check that was not run.

## Rollback And Stop Conditions

Stop before merge when:

- exact candidate or included work is unclear;
- PR head changed after verification;
- Release Check, Preview, secret gate, or required focused test failed or is unknown;
- rollback evidence or Production smoke path is missing;
- an unapproved external-data or Production setting change is implied.

After merge, choose rollback or forward-fix using explicit evidence:

| Option | Use when | Evidence |
| --- | --- | --- |
| Promote the previous Vercel Production deployment | Runtime deployment is bad and the previous deployment is known good | Previous deployment id and URL |
| Revert the merge on `main` through a reviewed PR | The problem is in repository content | Merge SHA, revert candidate, checks |
| Block before merge | A preflight gate fails | Failed check and unchanged Production proof |

## Retired Staging Assets

The staging-retirement change removes the active alias workflow, helper script, package command, fixed alias, and remote `staging` branch. The alias and branch are removed only after the exact policy PR receives 승욱's approval and is merged to `main`.

Historical documents are retained with `status: superseded` so old release evidence remains understandable. They are not active instructions.

## Related Docs

- [Operations README](README.md)
- [Manual Merge Gate Runbook](manual-merge-gate-runbook.md)
- [Production Release From PR To `main` Runbook](production-release-pr-to-main-runbook.md)
- [Launch Readiness Checklist](launch-readiness-checklist.md)
- [Manual Linear Operations](../agent-orchestration/manual-linear-operations.md)
