# Operations Docs

Operations docs describe deployment, runtime configuration, monitoring, incident response, and production readiness.

Keep product requirements in `docs/product/` and implementation architecture in `docs/engineering/architecture/`.

Use this README as the GitBook entry point for launch, staging, and operational-readiness references. The current project remains Product MVP; this folder does not grant approval for live operations.

## Read First

| Need | Start With |
| --- | --- |
| Release environment policy and deploy routing | `release-environment-policy.md` |
| GitHub/Vercel PR preview and fixed staging automation plan | `github-vercel-release-automation-plan.md` |
| Fixed staging alias automation and smoke checklist | `fixed-staging-alias-automation.md` |
| Vercel Git integration and preview readiness check | `vercel-git-integration-preview-checks.md` |
| Vercel Git integration approval and execution plan | `vercel-git-integration-execution-plan.md` |
| Hobby/free staging branch release model | `hobby-free-staging-branch-release-plan.md` |
| Manual merge gates for private/free setup | `manual-merge-gate-runbook.md` |
| Production release from staging to main | `production-release-staging-to-main-runbook.md` |
| Fixed staging main-only execution plan | `fixed-staging-main-only-execution-plan.md` |
| Pilot/live launch readiness gates | `launch-readiness-checklist.md` |
| Approved staging pilot dataset readback and reset contract | `staging-pilot-readback-reset-contract.md` |

## Current Operations Sources

| Document | Role |
| --- | --- |
| `release-environment-policy.md` | Operating policy for PR previews, fixed staging, production promote, secret/env safety, alias rules, and release rollback reporting. |
| `github-vercel-release-automation-plan.md` | Current GitHub/Vercel setup observations and staged plan for PR preview, `main` fixed staging, and future production promote automation. |
| `fixed-staging-alias-automation.md` | GitHub Action and script runbook for updating the fixed staging alias after successful `staging` branch Vercel deployments, plus post-deploy smoke checks. |
| `vercel-git-integration-preview-checks.md` | Read-only DEN-447 verification of Vercel Git Integration evidence, missing UI-only checks, and safe next execution shape for PR preview validation. |
| `vercel-git-integration-execution-plan.md` | DEN-447 follow-up execution plan for approval-gated Vercel Git Integration confirmation, PR preview validation, and non-change boundaries for fixed staging/production. |
| `hobby-free-staging-branch-release-plan.md` | Current target release model for Hobby/free: PR Preview, long-lived `staging` branch for fixed staging, and `main` as Vercel Production. |
| `manual-merge-gate-runbook.md` | DEN-450 manual gate for merging work PRs to `staging`, updating fixed staging, and preparing `staging` to `main` production release while required checks cannot be enforced. |
| `production-release-staging-to-main-runbook.md` | DEN-451 production release approval packet, preflight, smoke, rollback, and stop conditions for moving an approved `staging` candidate to `main`. |
| `fixed-staging-main-only-execution-plan.md` | Superseded plan for updating fixed staging from a clean verified `main` checkout without changing production. |
| `launch-readiness-checklist.md` | Checklist for representative pilot or live launch readiness, including security/data readiness and remote/production approval gates. |
| `staging-pilot-readback-reset-contract.md` | Staging synthetic dataset readback and reset contract for approved pilot replay work. |

## Boundaries

- Do not run production deploy, remote Supabase mutation, staging seed replay, real email, payment setup, provider integration, or real data import without explicit approval from 승욱.
- Keep secrets, credentials, environment values, and operational access details out of docs and GitBook-visible reports.
- Put implementation architecture in `docs/engineering/architecture/`; put auth/security execution gates in `docs/engineering/auth-security/`.
- Private GitBook can expose operational checklists for internal review, but external-public publishing would need a separate sensitivity review.

## Verification Notes

- Docs-only navigation edits: run `npm run docs:check`.
- Any future operations execution must follow the specific source doc and active work item verification plan.
