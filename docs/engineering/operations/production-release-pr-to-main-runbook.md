---
id: ENGINEERING-OPERATIONS-PRODUCTION-RELEASE-PR-TO-MAIN-RUNBOOK
status: approved
area: engineering
doc_type: runbook
related_work:
  - RELEASE-OPS-PR-004
  - RELEASE-OPS-PR-005
supersedes:
  - ENGINEERING-OPERATIONS-PRODUCTION-RELEASE-STAGING-TO-MAIN-RUNBOOK
superseded_by: []
last_updated: 2026-10-20
---

# Production Release From PR To `main` Runbook

This runbook defines how CLAiR EMR prepares and verifies a Production release from an exact PR candidate to `main`.

It does not authorize Production by itself. It defines the evidence required before executing an authorized `main` merge, including a previously granted conditional approval.

## Core Rule

```text
PR Preview = pre-merge review
main = source of truth and Vercel Production
```

Every `main` merge is a Production-release action. The repository does not use a long-lived staging branch or fixed staging alias in the active flow.

## Production Approval Packet

Before a merge, prepare the exact candidate packet and apply [Approval Reuse](release-environment-policy.md#approval-reuse). Reuse SHA-pinned or bounded conditional approval as applicable. Once its conditions pass, execute without redundant confirmation; otherwise finish authorized preparation and ask only for the missing or materially changed authority.

| Field | Required content |
| --- | --- |
| Target | Production / `main`. |
| Source | PR number, branch, and exact full head SHA. |
| Compare target | Current `origin/main` SHA and current Ready Production deployment id or URL. |
| Included work | Issues, work items, changed files, and reports included in the candidate. |
| Preview evidence | Ready Vercel Preview URL for the exact branch candidate. |
| Verification | Current required automatic PR Release Check, PR head/base and tested merge SHA, plus local and focused checks. |
| Secret/env safety | No secret values printed or committed; no tracked env files with credentials. |
| Production action | Exact-head-protected PR merge operation. |
| Smoke | Production URL and scoped paths to verify after merge. |
| Rollback | Previous Ready Production deployment or merge-revert candidate. |
| Stop condition | A condition that cancels or pauses the release. |

Approval wording:

```text
승인: PR #<number>의 exact candidate <SHA>를 main/Production에 병합해줘.
검사 결과와 rollback 후보를 유지하고 병합 후 Production smoke를 확인해줘.
```

Conditional approval may instead name the PR/task and authorize merge/Production once checks and Preview review pass. Always record the final SHA. If it changes, refresh verification. Request new approval only when a SHA-pinned approval no longer matches or the change materially exceeds the conditional scope; do not repeat approval for routine in-scope corrections.

## Candidate Preflight

Run from a clean worktree at the exact PR head:

```bash
npm run security:secrets
npm run docs:check
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

For docs- or workflow-only changes, the local focused gate may omit app-only checks when the PR explains why. The current required automatic PR `Release Check` still runs its full combined job before merge. Manual dispatch is available for diagnosis/fallback, not a mandatory duplicate.

Add focused tests for changed application behavior. Do not claim a suite was run unless it completed for this candidate.

## Source Integrity

Before executing the approved merge:

- fetch the live remote state;
- confirm the PR is open, mergeable, and targets `main`;
- confirm the PR head SHA exactly matches the checked candidate;
- compare changed files and commits with `origin/main`;
- confirm no unrelated local or user-owned work is included;
- confirm Preview uses the current PR head and the required PR check tests its current merge result; record head/base/run provenance rather than requiring literal SHA equality;
- record the current Production source SHA and previous deployment.

Useful read-only checks:

```bash
git fetch origin --prune
git rev-parse origin/main
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
gh pr view <number> --json state,isDraft,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup
```

## Merge

After valid explicit approval and completion of every condition:

1. Reconfirm the live PR head SHA.
2. Use squash merge unless the approved PR requires a different documented strategy.
3. Protect the operation with the expected head SHA.
4. Do not delete or modify unrelated branches, aliases, settings, or data as part of the merge.

Example:

```bash
gh pr merge <number> --squash --match-head-commit <exact-head-sha>
```

## Production Verification

Minimum after merge:

| Area | Check |
| --- | --- |
| GitHub | PR is merged and merge SHA is recorded. |
| Git | Live `origin/main` contains the merge SHA. |
| Vercel | Production deployment is Ready and source matches the merge SHA. |
| Docs-only skip | If no new build occurs, latest Ready deployment source is an ancestor of `origin/main` and the skip is reported. |
| Route | Production `/login` returns the expected successful response. |
| Scoped smoke | Only the workflow promised in the approval packet is exercised. |
| Rollback | Previous deployment or revert candidate remains identified. |

Use synthetic/demo data only unless a separate approved task explicitly includes other data.

## Rollback

| Option | Use when | Required evidence |
| --- | --- | --- |
| Promote the previous Ready Production deployment | Runtime deployment is bad and prior deployment is known good | Deployment id, URL, and post-rollback smoke |
| Revert the merge through a PR | Repository content is faulty | Merge SHA, revert diff, exact checks, approval covering the revert operation |
| Forward-fix through a PR | A narrow correction is safer than rollback | New exact candidate, checks, approval covering the correction |

Do not perform a rollback mutation unless it is already inside the approved response path or 승욱 separately approves it.

## Stop Conditions

Stop before merge when:

- exact source SHA or included work is unclear;
- head SHA changed after checks without refreshed evidence, or approval no longer covers the candidate under the canonical reuse rules;
- Release Check, Preview, secret gate, or required focused verification failed or is unknown;
- rollback candidate or Production smoke path is missing;
- secrets or unrelated work are present;
- remote Supabase, migration, real data, provider, payment, email, or RLS work is implied without separate approval.

Stop after merge and report when Production is not Ready, the deployment source is unexpected, `/login` fails, or the scoped smoke fails.

## Result Report

Record:

- PR and exact candidate SHA;
- merge SHA and live `origin/main` SHA;
- Release Check URL and result;
- Preview and Production deployment id or URL;
- `/login` and scoped smoke result;
- rollback candidate;
- residual risk and checks not run.
