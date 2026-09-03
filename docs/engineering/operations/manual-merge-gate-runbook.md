---
id: ENGINEERING-OPERATIONS-MANUAL-MERGE-GATE-RUNBOOK
status: approved
area: engineering
doc_type: runbook
related_work:
  - DEN-450
  - RELEASE-OPS-PR-003
  - RELEASE-OPS-PR-004
supersedes: []
superseded_by: []
last_updated: 2026-09-03
---

# Manual Merge Gate Runbook

This runbook defines the manual checks required while the private CLAiR EMR repository cannot enforce required checks under the current GitHub plan.

## Active Model

```text
work branch / PR = Vercel Preview
main = source of truth and Vercel Production
```

There is no active staging integration step. Every `main` merge is a Production release.

## Roles

| Role | Responsibility |
| --- | --- |
| Work task | Implements scoped work, opens a PR to `main`, verifies the exact candidate and Preview, and prepares a Production approval packet. |
| 승욱 | Reviews the exact candidate packet and explicitly approves or rejects the `main`/Production merge. |
| Release task | Reconfirms the approved SHA, merges with exact-head protection, and verifies `origin/main` and Production. |

## Gate 1: Exact PR Candidate

Required evidence:

| Check | Required result |
| --- | --- |
| PR target | `main`. |
| Candidate | PR number, source branch, and full head SHA are recorded. |
| Scope | Changed files and included work are reviewable and intentional. |
| Release Check | Manually dispatched for the exact head SHA and successful. |
| Local secret gate | `npm run security:secrets` passed for the same candidate. |
| Preview | Vercel Preview is Ready and linked. |
| Focused verification | Checks appropriate to the changed behavior passed. |
| Worktree safety | No unrelated local or user-owned files are included. |

Minimum local commands:

```bash
npm run security:secrets
npm run docs:check
git diff --check
```

For application behavior changes, also run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Gate 2: Production Approval Packet

Before the merge, show 승욱:

| Field | Required content |
| --- | --- |
| Target | Production / `main`. |
| Exact source | PR, branch, and full head SHA. |
| Compare target | Current `origin/main` SHA and current Production deployment. |
| Included work | Issues, work items, and reports included in the candidate. |
| Verification | Exact Release Check, local gates, Preview, and focused test results. |
| Production action | Exact merge operation protected by the expected head SHA. |
| Smoke | Production URL and paths to verify. |
| Rollback | Previous Production deployment or merge-revert candidate. |
| Stop condition | Any condition that cancels the merge or pauses the release. |

Approval is invalidated if the PR head SHA changes.

Acceptable approval shape:

```text
승인: PR #<number>의 exact candidate <SHA>를 main/Production에 병합해줘.
검사 결과와 rollback 후보를 유지하고 병합 후 Production smoke를 확인해줘.
```

## Gate 3: Merge And Production Proof

After approval:

1. Re-read the PR and confirm it is open, mergeable, targets `main`, and still has the approved head SHA.
2. Merge with exact-head protection.
3. Fetch `origin/main` and record the merge SHA.
4. Confirm the candidate content is included in `origin/main`.
5. Confirm the Vercel Production deployment is Ready and tied to the merge SHA.
6. If a docs-only build is intentionally skipped, prove the latest Ready deployment's source SHA is an ancestor of `origin/main` and say that no new application deployment occurred.
7. Probe `/login` and run the approved scoped smoke.
8. Report rollback evidence and residual risk.

## Stop Conditions

Stop before merge when:

- 승욱 has not approved the exact candidate;
- the PR head SHA changed;
- included work is unclear;
- Release Check, secret gate, Preview, or required focused verification failed or is unknown;
- rollback or smoke evidence is missing;
- the PR exposes secrets or includes unrelated work;
- remote Supabase, migration, real data, RLS, email, payment, or provider work is implied without separate approval.

Stop after merge when Production is not Ready, `/login` fails, the deployment source is unexpected, or the scoped smoke fails. Report the failure before any rollback or forward-fix action not already approved.

## Evidence To Record

- PR and exact candidate SHA;
- merge SHA and live `origin/main` SHA;
- Release Check URL and result;
- Preview and Production deployment URL or id;
- `/login` and scoped smoke result;
- rollback candidate;
- checks intentionally not run.
