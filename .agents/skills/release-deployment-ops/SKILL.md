---
name: release-deployment-ops
description: Prepare or deliver CLAiR PR previews, production releases, or deployment checks.
---

# Release Deployment Ops

Use this skill for CLAiR EMR PR preview and production release requests.

Read first:

- `docs/engineering/operations/release-environment-policy.md`
- `docs/engineering/operations/manual-merge-gate-runbook.md`
- `docs/engineering/operations/production-release-pr-to-main-runbook.md` for production

## Compact Rules

- Work only on feature or `codex/*` branches and use the automatic Vercel Preview for review.
- `main` is both the source of truth and the Vercel Production branch.
- The active release path has no long-lived `staging` branch or fixed staging alias.
- Never push directly to `main` for routine work. Open a PR and inspect its exact head SHA.
- Use the public repository's automatic PR `Release Check` as the default. Require its current successful result under strict main protection. Manual dispatch is a diagnosis/fallback tool, not a mandatory duplicate.
- Merging to `main` is a production release. Prepare final candidate, verification, smoke, and rollback evidence. Apply existing explicit SHA-pinned or bounded conditional approval; stop only when authority or a required condition is missing.
- The repository is public. Do not change visibility or expose secrets/private data as part of CI/CD work. Keep external-fork execution/deployment approval separate from trusted branch automation.
- Do not expose secrets in source, docs, Linear, screenshots, logs, or chat.
- Run `npm run security:secrets` locally before an approved production release even when the remote `Release Check` passes.
- Report branch, exact commit SHA, included issues/PRs, deployment URL or id, verification, smoke result, and rollback candidate.

Follow [Approval Reuse](../../../docs/engineering/operations/release-environment-policy.md#approval-reuse). Direct user approval to merge a named PR or bounded task after checks/review is conditional authorization. Resolve and record the final SHA and proceed once those conditions pass; do not ask the same question again. SHA-pinned approval remains limited to that SHA. In-scope corrections require fresh evidence, not duplicate permission. Ask only for missing/ambiguous authority or material scope/behavior, target/operation, cost, or data/security changes. A no-merge/no-Production instruction remains binding. Never weaken required checks.

Before enabling automatic Preview, read the active release work item and verify data/provider boundaries, plan/usage, protection, and actual configuration. A Preview URL can share the Production DB or send allowlisted real email. Do not infer isolation, synthetic-only data, zero cost, or activation from policy text. Unknown/exceeded usage or unresolved data scope must be reported before activating automation; no paid upgrade or DB branching without approval.

## Environment Decisions

The active environments are:

| Environment | Source | Use |
| --- | --- | --- |
| PR Preview | Feature or `codex/*` branch | Review and scoped smoke before approval |
| Production | `main` | User-facing release after explicit approval |

Default interpretation:

- `preview`, `PR URL`, `검수 링크`, or `PR만` means PR Preview only.
- `프로덕션`, `사용자에게 배포`, `production`, `main에 merge`, or `origin-main에 merge` means a production release and requires explicit approval.
- A request for `staging` or `fixed staging` refers to the retired model. Explain that the active path now uses PR Preview and ask whether PR Preview is sufficient.

## Short Invocation Phrases

| User phrase | Allowed actions | Still blocked |
| --- | --- | --- |
| `PR preview까지만.` / `PR만.` | Implement, commit, push, open or update PR, verify Preview, report candidate | `main`, Production |
| `production 릴리즈 준비해줘.` | Inspect the exact PR candidate and prepare the approval packet | PR merge, `main`, Production until approval |
| `커밋, 푸시, 피알, 오리진-메인에 머지.` | Treat a clear bounded task as conditional merge/Production approval; prepare evidence, then execute once all gates pass without asking again | Failed/unknown gates, materially expanded scope, or a conflicting no-merge instruction |

If the target is unclear, ask:

```text
PR Preview 검수까지만 할까, 아니면 exact candidate 확인 후 Production(main) 병합까지 준비할까?
```

## Minimum Secret Safety Gate

Before release work, check:

- no tracked `.env*` or `.vercel/.env*` contains secrets;
- no private API key, service role key, DB password, provider secret, token, or credential is in source, docs, Linear, screenshots, logs, or reports;
- no server-only secret is assigned to `NEXT_PUBLIC_*`;
- no server-only secret is imported into browser-bundled code;
- `npm run security:secrets` passes.

Allowed public values include public URLs, environment-appropriate Supabase publishable/anon keys, and non-sensitive feature flags.

## PR Preview Workflow

1. Confirm the source branch and exact PR head SHA.
2. Confirm the PR targets `main` and contains only approved scope.
3. Verify the automatic Vercel Preview is Ready.
4. Run the active issue's focused checks plus:

```bash
npm run security:secrets
npm run docs:check
git diff --check
```

5. Verify the required automatic PR `Release Check`. Record current head/base, run/event and tested merge SHA. PR checks normally test a synthetic merge; Preview uses the branch head. Refresh evidence after changes. Manual dispatch does not bypass a missing required PR check.
6. Report the Preview URL, exact SHA, checks, changed scope, and known residual risk.

## Production Workflow

Production is user-facing. Before merging, prepare the packet in `production-release-pr-to-main-runbook.md`. If direct user approval already covers this PR/task, operation, and satisfied conditions, proceed without another confirmation; otherwise request only the missing approval after preparation.

Minimum production preflight:

```bash
npm run security:secrets
npm run docs:check
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

Add focused tests when application behavior changes. After approval:

1. Reconfirm the PR head SHA and mergeability.
2. Merge with exact-head protection.
3. Confirm live `origin/main` contains the merge commit.
4. Confirm the Vercel Production deployment is Ready and tied to the merge SHA, or report that the latest Ready deployment is an ancestor when Vercel intentionally skips a docs-only build.
5. Probe `/login` and run only the scoped smoke promised in the approval packet.
6. Report the previous deployment or revert commit as rollback evidence.

## Stop Conditions

Stop and report instead of continuing when:

- the PR head changed after checks and current evidence is not refreshed, or SHA-pinned approval no longer matches;
- the exact `Release Check` failed or is unknown;
- the Vercel Preview is not Ready;
- secret scan fails or any secret appears in tracked material or output;
- Production is requested without valid explicit approval under the canonical approval-reuse rules;
- required Production smoke fails;
- remote Supabase, migration, real data, provider, email, or payment work is implied but not separately approved.
