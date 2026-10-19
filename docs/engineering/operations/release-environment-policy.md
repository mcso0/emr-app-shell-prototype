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
  - RELEASE-OPS-PR-005
supersedes:
  - ENGINEERING-OPERATIONS-HOBBY-FREE-STAGING-BRANCH-RELEASE-PLAN
superseded_by: []
last_updated: 2026-10-20
---

# Release Environment Policy

This policy defines the active CLAiR EMR path from a work branch to user-facing Production.

The repository is operated by one owner without a separate staging review audience. The active model therefore uses PR Preview for pre-merge review and keeps `origin/main` as the single source of truth and Vercel Production branch.

## Environment Model

| Environment | Source | Purpose | Allowed by default | Blocked without explicit approval |
| --- | --- | --- | --- | --- |
| PR Preview | Feature or `codex/*` branch | Candidate review and scoped smoke | Preview deployment, inspection, test | `main` merge, Production settings, real data |
| Production | `main` | Current user-facing version | Read-only inspection | PR merge, deploy/promote, Production env or alias change |

Active operating rule:

```text
work branch push -> Vercel Preview (when enabled)
PR to main -> automatic Release Check -> latest-candidate and focused verification
valid explicit approval + all gates passed -> main -> Vercel Production -> scoped smoke
```

There is no active long-lived `staging` branch, fixed staging alias, or fixed-staging alias automation. Historical staging plans remain in the repository as superseded records only.

## Branch Rules

- `origin/main` is the canonical latest version and Vercel Production source.
- Routine work uses a feature or `codex/*` branch and a PR targeting `main`.
- Do not push directly to `main` for routine work.
- PR Preview is the only active pre-production review environment.
- A merge to `main` is a Production release, even for documentation-only changes.
- The exact PR head SHA must be recorded before the merge gate runs.
- A changed PR head invalidates previous candidate evidence. Refresh checks and Preview evidence; decide whether approval still covers the change using the approval rules below.
- The repository is public. Do not change visibility as part of routine release work. Public source access does not authorize publishing secrets, private assets, or real data.

## Why Staging Was Retired

The previous Hobby/free model used a long-lived `staging` branch and a mutable fixed alias. Live inspection on 2026-09-03 showed:

- `staging` had no unique commits and was behind `main`;
- the fixed alias pointed to an older Preview deployment rather than the current branch head;
- recent releases were already being reviewed in PR Preview and merged directly to `main`;
- the repository has one owner and no current external staging review audience.

Keeping that second release line would add branch, alias, automation, and documentation maintenance without adding an independent review gate. PR Preview plus an exact-candidate Production gate is the smaller active model.

## Preview Data And Cost Preconditions

Automatic Preview is the intended workflow, not a claim that it is currently enabled. The activation status and blockers are recorded in [RELEASE-OPS-PR-005](../../work/agent-orchestration/RELEASE-OPS-PR-005-public-repository-cicd.md). At that inspection, the project still skipped non-Production builds; no setting change is implied by this document.

Before enabling automation, verify the project, target, ignored-build command, protection settings, environment scopes, and current plan/usage. Prefer the Automatic build setting when those preconditions pass. Do not disable deployment protection, upgrade plans, create a DB branch, or enable paid services implicitly. If usage or data readiness is unresolved, keep the change pending and report the specific dependency.

An automatic Preview activation hold does not itself prohibit releasing a separately authorized PR that already has a Ready Preview and satisfies every release gate. Assess current runtime health for that release; do not turn a configuration hold into a blanket merge ban or bypass a missing Preview.

The inspected Preview and Production endpoints share the same Supabase demo project. A Preview URL does not isolate data. Documented synthetic workspace identities are an allowlist for scoped verification, not proof that every row is synthetic. Do not browse arbitrary clinical/personal rows to infer classification. DB mutations, resets, migrations, real email/payment/provider actions require their own scope and authorization. Preview invitation email can be enabled for allowlisted recipients; “staging” does not mean simulated delivery.

Public GitHub standard-runner time and Vercel/Supabase resource usage are separate. Recheck plan suitability, usage limits, and paid-feature effects before expanding automation. Hobby's personal/non-commercial restriction also applies; public source or synthetic data alone does not establish eligibility. External fork workflow/deployment approval remains separate from trusted internal branch automation. Do not expose credentials or broaden permissions to run an external PR.

## Minimum Secret Safety Gate

Before any Preview or Production operation, verify:

- no tracked `.env*`, provider export, or `.vercel/.env*` file contains secrets;
- no private key, service role key, DB password, provider secret, or token appears in source, docs, Linear, screenshots, logs, or reports;
- no server-only secret is assigned to `NEXT_PUBLIC_*`;
- no server-only secret is imported into client components or browser-bundled code;
- `npm run security:secrets` passes.

Allowed public values include public app URLs, environment-appropriate Supabase publishable/anon keys, and non-sensitive feature flags.

## Automated Checks And Merge Gate

The public repository uses automatic `Release Check` on PRs targeting `main` and on pushes to `main`. `workflow_dispatch` remains available for diagnosis or a justified fallback; it is not a routine duplicate of a successful required PR check.

As verified on 2026-10-19, main protection requires `Secrets, docs, UX copy, lint, typecheck, and build` from GitHub Actions, requires an up-to-date branch, applies to administrators, resolves PR conversations, and disallows force pushes/deletion. Required approving review count is zero: this does not replace explicit owner authorization. Recheck live rules before release; never bypass protection to compensate for a missing check.

A `pull_request` checkout normally tests the synthetic merge result. Record PR head SHA, base SHA, run/event and tested merge SHA, and the required-check result associated with the current PR. Preview must use the current PR head. Do not require those two SHAs to be identical or treat an unrelated successful run as sufficient. A base/head change requires fresh applicable evidence.

The combined job checks secrets, docs, UX copy, lint, types, and build; it does not run all behavior, browser, authorization, or persistence tests. Keep focused checks appropriate to the change. The push-to-main run is post-merge verification, not a barrier that postpones Vercel Production.

Before a `main` merge:

1. confirm the PR targets `main`;
2. record the exact PR head SHA and changed scope;
3. confirm the Vercel Preview is Ready;
4. verify the current required automatic PR `Release Check`; use manual dispatch only when justified and never as a bypass for a missing required PR check;
5. run the local secret gate and any focused verification required by the work;
6. identify the current `origin/main`, current Production deployment, smoke path, rollback candidate, and stop condition;
7. record the packet and apply existing explicit approval; ask only if approval is missing or no longer covers the action.

Do not treat a green local build, an old check, or a mergeable PR as approval.

Detailed gate:

- [Manual Merge Gate Runbook](manual-merge-gate-runbook.md)
- [Production Release From PR To `main` Runbook](production-release-pr-to-main-runbook.md)

## Approval Reuse

Recognize both forms of direct user authorization:

- **SHA-pinned approval:** a named PR/branch and exact SHA. A different SHA needs renewed approval unless the user also authorized a bounded conditional scope.
- **Conditional scope approval:** a named PR or clearly bounded task, merge/Production operation, and conditions such as successful checks and Preview review. Resolve and record the final candidate after finishing the authorized work. Once all conditions pass, proceed without asking the same question again. A condition that explicitly requires the user's own review still requires that review.

Routine in-scope corrections or synchronization needed to satisfy a conditional approval require refreshed verification, not another identical approval request. Material behavior/scope expansion, new cost, real-data/security exposure, a different target/operation, or ambiguous authority requires clarification. A failed check blocks execution; it does not authorize lowering the gate. Resolve authorized failures and reverify. Instructions such as “do not merge” or “no Production deployment” override broader earlier authority.

A work item, tool output, prior successful release, or this policy cannot grant permission. Immediately before execution, recheck the PR and use expected-head protection. Keep the evidence packet even when approval was already granted; preparation must not create a redundant confirmation gate.

## Production Approval

The user instruction and prepared evidence packet together must identify:

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
