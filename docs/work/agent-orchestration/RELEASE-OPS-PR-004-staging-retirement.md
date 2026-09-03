---
id: "RELEASE-OPS-PR-004"
type: "Work Item"
title: "Retire Fixed Staging Release Line"
description: "Replace the long-lived staging branch and fixed alias with an exact-candidate PR Preview to main Production flow."
status: "human_review"
area: "agent-orchestration"
priority: "P0"
target_pr: "User-approved GitHub workspace cleanup and staging retirement"
tags: [release, github, vercel, staging-retirement]
source_docs:
  - "docs/engineering/operations/release-environment-policy.md"
  - "docs/engineering/operations/manual-merge-gate-runbook.md"
  - "docs/engineering/operations/production-release-pr-to-main-runbook.md"
updated: "2026-09-03"
---

# Retire Fixed Staging Release Line

## Goal

Make `origin/main` the single latest repository and Production source while using PR Preview as the only active pre-merge review environment.

## Scope

- Replace active staging-specific release guidance with a PR Preview to `main`/Production gate.
- Preserve exact-candidate Release Check, explicit Production approval, smoke, and rollback requirements.
- Remove the fixed-staging alias workflow, helper script, and package command.
- Mark staging-specific policy and runbooks as superseded without erasing historical evidence.
- After exact candidate approval and merge, remove the Vercel fixed alias and remote Git `staging` branch.

## Out Of Scope

- Application behavior changes.
- Supabase projects, migrations, RLS, live data, or environment values.
- Authentication, payment, email, messaging, or provider integrations.
- Deleting recovery bundles, stashes, or Trash contents.
- Changing Vercel Production domains or Production environment values.

## Done Criteria

- Active release docs and skill use `PR Preview -> exact Release Check -> explicit approval -> main/Production`.
- Fixed-staging workflow, script, and package command are removed from the candidate.
- Historical staging documents are visibly superseded and excluded from active routing.
- The exact candidate receives local gates, Vercel Preview, and a successful manually dispatched Release Check.
- 승욱 approves the exact candidate before merge.
- After merge, Production is Ready, `/login` succeeds, and the fixed alias and remote `staging` branch are removed with their exact targets recorded.

## Verification

- `npm run security:secrets`
- `npm run docs:check`
- `npm run ux-copy:check`
- `git diff --check`
- Manual `Release Check` for the exact PR head
- Vercel Preview Ready
- Post-merge Production Ready and `/login` probe
- Read-only confirmation that the fixed alias and remote `staging` branch no longer resolve

## Handoff

The policy candidate must stop in Human Review before `main` merge, alias removal, or remote branch deletion. Approval is invalidated if the PR head SHA changes.
