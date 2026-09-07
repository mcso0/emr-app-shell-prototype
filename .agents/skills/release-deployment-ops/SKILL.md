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
- Under the current private/free setup, manually run the combined `Release Check` once for the exact candidate and verify it before merge.
- Merging to `main` is a production release. Stop until 승욱 explicitly approves the exact candidate, verification, production action, smoke path, and rollback candidate.
- Keep the working repository private. Do not make it public just to unlock branch protection.
- Do not expose secrets in source, docs, Linear, screenshots, logs, or chat.
- Run `npm run security:secrets` locally before an approved production release even when the remote `Release Check` passes.
- Report branch, exact commit SHA, included issues/PRs, deployment URL or id, verification, smoke result, and rollback candidate.

Prior approval remains valid for the same target, source commit, included scope, and operation. Prepare candidate/checks/smoke/rollback evidence before asking about a remaining gate. Ask again only if approval is missing or that scope changes; never weaken required release checks.

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
| `커밋, 푸시, 피알, 오리진-메인에 머지.` | Prepare the exact candidate, checks, and approval packet; merge only after the exact Production approval gate is satisfied | Unverified or changed candidate |

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

5. Manually dispatch the combined `Release Check` for the exact candidate before requesting a Production merge.
6. Report the Preview URL, exact SHA, checks, changed scope, and known residual risk.

## Production Workflow

Production is user-facing. Before merging the PR to `main`, present the packet in `production-release-pr-to-main-runbook.md` and stop until 승욱 approves the exact candidate.

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

- the PR head SHA changed after checks;
- the exact `Release Check` failed or is unknown;
- the Vercel Preview is not Ready;
- secret scan fails or any secret appears in tracked material or output;
- Production is requested without exact approval;
- required Production smoke fails;
- remote Supabase, migration, real data, provider, email, or payment work is implied but not separately approved.
