---
id: ENGINEERING-OPERATIONS-MANUAL-MERGE-GATE-RUNBOOK
status: approved
area: engineering
doc_type: runbook
related_work:
  - DEN-450
  - RELEASE-OPS-PR-003
  - RELEASE-OPS-PR-004
  - RELEASE-OPS-PR-005
supersedes: []
superseded_by: []
last_updated: 2026-10-20
---

# Manual Merge Gate Runbook

This runbook defines the release decision gate for the public repository. The filename is retained for stable links. Automatic required PR checks enforce code verification; owner authorization, focused verification, and release evidence remain required. See [Release Environment Policy](release-environment-policy.md) for check provenance, approval reuse, and Preview data/cost preconditions.

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
| 승욱 | Authorizes or rejects the named PR/task and `main`/Production operation, either for an exact SHA or conditionally on stated checks/review. |
| Release task | Reconfirms the approved SHA, merges with exact-head protection, and verifies `origin/main` and Production. |

## Gate 1: Exact PR Candidate

Required evidence:

| Check | Required result |
| --- | --- |
| PR target | `main`. |
| Candidate | PR number, source branch, and full head SHA are recorded. |
| Scope | Changed files and included work are reviewable and intentional. |
| Release Check | Current required automatic PR check succeeds; record PR head/base, run/event and tested merge SHA. Manual dispatch is a fallback, never a substitute for a missing required check. |
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

Before the merge, prepare the following evidence. Reuse valid explicit approval; show the packet and request approval only when it is missing or materially out of scope:

| Field | Required content |
| --- | --- |
| Target | Production / `main`. |
| Exact source | PR, branch, and full head SHA. |
| Compare target | Current `origin/main` SHA and current Production deployment. |
| Included work | Issues, work items, and reports included in the candidate. |
| Verification | Current required PR Release Check with candidate/merge provenance, local gates, current-head Preview, and focused test results. |
| Production action | Exact merge operation protected by the expected head SHA. |
| Smoke | Production URL and paths to verify. |
| Rollback | Previous Production deployment or merge-revert candidate. |
| Stop condition | Any condition that cancels the merge or pauses the release. |

Apply [Approval Reuse](release-environment-policy.md#approval-reuse). A head change invalidates old verification. SHA-pinned approval requires the same SHA; bounded conditional approval can cover in-scope corrections after fresh verification. Do not request approval again solely because checks have finished or a final SHA has been resolved. Local checks do not substitute for an unavailable required PR Release Check.

Acceptable SHA-pinned approval shape:

```text
승인: PR #<number>의 exact candidate <SHA>를 main/Production에 병합해줘.
검사 결과와 rollback 후보를 유지하고 병합 후 Production smoke를 확인해줘.
```

Conditional approval example:

```text
PR #<number>의 현재 합의한 범위를 검사와 Preview 검증이 통과하면 main에 머지하고 Production 배포까지 확인해줘.
```

Record the final SHA, scope, verification, smoke, and rollback evidence before execution; do not ask the same question again when these conditions are met. An explicit request for user review before merge remains a gate.

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

- no valid direct user approval covers the candidate and operation under the canonical approval-reuse rules;
- the PR head changed and candidate evidence has not been refreshed, or SHA-pinned approval no longer matches;
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
