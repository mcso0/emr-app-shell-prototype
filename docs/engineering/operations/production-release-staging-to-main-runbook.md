---
id: ENGINEERING-OPERATIONS-PRODUCTION-RELEASE-STAGING-TO-MAIN-RUNBOOK
status: approved
area: engineering
doc_type: runbook
related_work:
  - DEN-451
supersedes: []
superseded_by: []
last_updated: 2026-06-09
---

# Production Release From `staging` To `main` Runbook

This runbook defines how CLAiR EMR prepares a production release from the long-lived `staging` branch to `main`.

It is not approval to deploy production. It defines the approval packet, checks, and rollback evidence required before 승욱 can approve a production release.

## Core Rule

```text
staging = fixed staging review candidate
main = Vercel Production branch
```

Therefore, merging, promoting, or deploying to `main` is a production-release action.

Do not use `main` as a routine integration branch.

## Production Approval Packet

Before any production release, Codex must present a compact approval packet and stop.

Required approval wording from 승욱:

```text
승인: staging commit <SHA>를 production release로 main에 반영해줘.
포함 PR/이슈는 <list>이고, production smoke와 rollback 후보를 보고해줘.
```

The packet must include:

| Field | Required content |
| --- | --- |
| Target | `production` and `main`. |
| Source | `staging` commit SHA. |
| Compare target | Current `origin/main` SHA or production deployment id. |
| Included work | PR numbers, Linear issues, and closeout reports included in the release. |
| Fixed staging evidence | Fixed staging URL, deployment id/URL, and smoke result for the same source. |
| Verification | GitHub checks plus local preflight commands. |
| Secret/env safety | Confirmation that no secret values are printed and no env files are tracked. |
| Production operation | Exact operation to run after approval, for example merge `staging` into `main` or promote a named deployment. |
| Smoke path | Production URL and workflow paths to verify after release. |
| Rollback candidate | Previous production deployment id, revert commit candidate, or alias target. |
| Stop condition | Clear condition that cancels or pauses the release. |

## Preflight Checklist

Run these from a clean release worktree before asking for production approval:

```bash
npm run security:secrets
npm run docs:check
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

Add focused tests for the changed workflows. Examples:

```bash
npx playwright test tests/ui-demo-api-wiring-e2e.spec.ts
npx playwright test tests/fulfillment-handoff-replay.spec.ts
```

Use only the focused tests that match the included release scope. Do not claim the full suite was run unless it was actually run.

## Source Integrity Checks

Before approval, confirm:

- `staging` is up to date with the release candidate to ship;
- `origin/main` is the current production branch target;
- the `staging` to `main` diff contains only approved PRs/issues;
- no unrelated local worktree changes are included;
- no `.env*`, provider export, token, service role key, DB password, or credential appears in source, docs, Linear, screenshots, logs, or chat;
- no server-only secret is assigned to `NEXT_PUBLIC_*`;
- no server-only secret is imported into browser-bundled code.

Useful inspection commands:

```bash
git fetch origin
git rev-parse origin/staging
git rev-parse origin/main
git log --oneline --decorate origin/main..origin/staging
git diff --stat origin/main...origin/staging
git diff --name-status origin/main...origin/staging
```

## Production Smoke Checklist

The exact smoke path depends on included work. Minimum production smoke after an approved release:

| Area | Check |
| --- | --- |
| App shell | Production URL loads without framework/runtime error. |
| Workspace route | `clair-demo` workspace route opens. |
| Navigation | Core shell navigation does not break. |
| Primary workflow | One scoped workflow from the release packet works on production. |
| Fixed staging comparison | The production behavior matches the approved fixed staging candidate for the scoped path. |
| Console/network | No obvious crash, missing chunk, or failed critical app request. |

For current Product MVP work, smoke must use synthetic demo data only. Do not introduce real patient, guardian, hospital, payment, or identity data.

## Rollback Options

Record at least one rollback candidate before approval:

| Option | Use when | Required evidence |
| --- | --- | --- |
| Vercel rollback/promote previous production deployment | Production deployment is bad and previous deployment is known good. | Previous production deployment id and URL. |
| Git revert on `main` | Bad change is code-level and can be reverted cleanly. | Revert commit plan and verification commands. |
| Block and keep current production | Preflight fails before release. | Stop condition and failed check. |

Rollback report must include:

- failed deployment id or commit;
- previous production deployment id or revert target;
- user/data impact;
- chosen action;
- verification result after rollback or block.

## Stop Conditions

Stop before production approval when:

- 승욱 has not explicitly approved production;
- source commit SHA is missing;
- included PRs/issues are unclear;
- fixed staging was not reviewed for the same source;
- `CI`, `Secret Scan`, local preflight, or focused tests are failing or unknown;
- rollback candidate is missing;
- production smoke path is missing;
- any secret/env value would be exposed;
- remote Supabase, real data, provider, email, payment, RLS, migration, or live integration work is implied but not separately approved.

Stop after production release when:

- production smoke fails;
- a critical route fails to load;
- production points at unexpected resources;
- a secret or private env value appears in output;
- included work does not match the approved packet.

## Report Template

Use this shape for a production release report:

```markdown
## Production Release Result

- Target: production / main
- Source: staging <SHA>
- Previous production: <deployment id or main SHA>
- Included PRs/issues: <list>
- Verification: <commands and result>
- Fixed staging evidence: <URL/deployment/smoke>
- Production deployment: <URL/deployment id>
- Production smoke: <path and result>
- Rollback candidate: <deployment id or revert target>
- Residual risk: <known risk or none>
```

Move the Linear issue to `Human Review` after evidence is recorded. Move to `Done` only when 승욱 explicitly accepts or asks.
