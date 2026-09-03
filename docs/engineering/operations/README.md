# Operations Docs

Operations docs describe deployment, runtime configuration, monitoring, incident response, and production readiness.

Keep product requirements in `docs/product/` and implementation architecture in `docs/engineering/architecture/`.

Use this README as the entry point for release and operational-readiness references. The current project remains Product MVP; this folder does not grant approval for live operations.

## Read First

| Need | Start With |
| --- | --- |
| Release environment policy and deploy routing | `release-environment-policy.md` |
| PR Preview to `main`/Production release | `production-release-pr-to-main-runbook.md` |
| Vercel Git integration and preview readiness check | `vercel-git-integration-preview-checks.md` |
| Vercel Git integration approval and execution plan | `vercel-git-integration-execution-plan.md` |
| Manual merge gates for private/free setup | `manual-merge-gate-runbook.md` |
| Pilot/live launch readiness gates | `launch-readiness-checklist.md` |
| Approved staging pilot dataset readback and reset contract | `staging-pilot-readback-reset-contract.md` |

## Current Operations Sources

| Document | Role |
| --- | --- |
| `release-environment-policy.md` | Active policy for PR Preview, exact-candidate checks, `main`/Production approval, verification, and rollback. |
| `production-release-pr-to-main-runbook.md` | Active approval packet and execution runbook for releasing an exact PR candidate to `main`/Production. |
| `manual-merge-gate-runbook.md` | Active manual gate while required checks cannot be enforced for the private repository. |
| `vercel-git-integration-preview-checks.md` | Read-only DEN-447 verification of Vercel Git Integration evidence, missing UI-only checks, and safe next execution shape for PR preview validation. |
| `vercel-git-integration-execution-plan.md` | DEN-447 follow-up execution plan for approval-gated Vercel Git Integration confirmation, PR preview validation, and non-change boundaries for fixed staging/production. |
| `launch-readiness-checklist.md` | Checklist for representative pilot or live launch readiness, including security/data readiness and remote/production approval gates. |
| `staging-pilot-readback-reset-contract.md` | Staging synthetic dataset readback and reset contract for approved pilot replay work. |

## Superseded Release Records

These files explain the retired fixed-staging model and remain available only for historical links and evidence:

- `hobby-free-staging-branch-release-plan.md`
- `fixed-staging-alias-automation.md`
- `github-vercel-release-automation-plan.md`
- `production-release-staging-to-main-runbook.md`
- `fixed-staging-main-only-execution-plan.md`

## Boundaries

- Do not run production deploy, remote Supabase mutation, staging seed replay, real email, payment setup, provider integration, or real data import without explicit approval from 승욱.
- Keep secrets, credentials, environment values, and operational access details out of docs and GitBook-visible reports.
- Put implementation architecture in `docs/engineering/architecture/`; put auth/security execution gates in `docs/engineering/auth-security/`.
- The retired `staging` release branch is unrelated to the shared Supabase environment names found in historical product/data records. This policy change does not mutate Supabase.
- Deprecated GitBook copies are not an active operations source.

## Verification Notes

- Docs-only navigation edits: run `npm run docs:check`.
- Any future operations execution must follow the specific source doc and active work item verification plan.
