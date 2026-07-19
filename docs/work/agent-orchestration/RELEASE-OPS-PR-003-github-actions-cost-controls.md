---
id: "RELEASE-OPS-PR-003"
status: "human_review"
area: "agent-orchestration"
priority: "P0"
target_pr: "PR 444 / GitHub Actions free-budget controls"
source_docs:
  - "docs/engineering/operations/release-environment-policy.md"
  - "docs/engineering/operations/manual-merge-gate-runbook.md"
  - "docs/engineering/operations/fixed-staging-alias-automation.md"
  - "docs/engineering/operations/hobby-free-staging-branch-release-plan.md"
  - "docs/engineering/operations/github-vercel-release-automation-plan.md"
  - "docs/engineering/operations/production-release-staging-to-main-runbook.md"
updated: "2026-07-18"
---

# GitHub Actions Cost Controls

## Goal

Keep the private GitHub Free repository inside a small, explicit Actions budget without removing release verification or Vercel PR previews.

## Scope

- Replace automatic PR/main `CI` and `Secret Scan` runs with one manually dispatched `Release Check`.
- Run secret scanning inside the same job to avoid duplicate checkout, Node setup, and `npm ci` work.
- Stop `deployment_status` from launching the fixed staging alias workflow for every Vercel Preview.
- Keep fixed staging alias validation and updates available through manual dispatch with dry-run as the default.
- Update the durable release and merge-gate documentation.

## Out Of Scope

- Vercel Git Integration, Preview, Production, domain, alias, or environment changes.
- GitHub billing, payment-method, or budget mutations.
- Application, database, Supabase, permission, or product behavior changes.
- Merging any feature or release PR to `main`.

## Done Criteria

- Normal PR pushes create Vercel Preview deployments without launching GitHub-hosted runners.
- `Release Check` can be manually dispatched for an exact branch or commit candidate.
- One job runs secrets, docs, lint, typecheck, and build.
- Fixed staging alias automation launches only by manual dispatch and defaults to dry-run.
- Release documentation names the new manual verification contract.

## Verification

- `npm ci` — passed; no vulnerabilities found
- `npm run security:secrets` — passed; 3,239 tracked files checked
- `npm run docs:check` — passed; 833 docs/agent Markdown files checked
- `npm run lint` — passed
- `npx tsc --noEmit` — passed
- `npm run build` — passed; existing Turbopack NFT trace warning remains
- `git diff --check` — passed
- Workflow YAML parse check — passed
- `VERCEL_DEPLOYMENT_URL=https://emr-app-shell-prototype-git-staging-mcso0s-projects.vercel.app npm run release:staging-alias:dry-run` — passed; no alias changed

## Handoff Notes

- Review PR: `#444`
- Vercel PR Preview remains automatic and does not use GitHub Actions minutes.
- A merge candidate must not move forward until the manually dispatched `Release Check` and local secret gate pass.
- Production and `main` remain separately approval-gated.

Closeout:

- `docs/completed/agent-orchestration/2026-07-18-github-actions-cost-controls-report.html`
