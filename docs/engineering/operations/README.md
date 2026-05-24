# Operations Docs

Operations docs describe deployment, runtime configuration, monitoring, incident response, and production readiness.

Keep product requirements in `docs/product/` and implementation architecture in `docs/engineering/architecture/`.

Use this README as the GitBook entry point for launch, staging, and operational-readiness references. The current project remains Product MVP; this folder does not grant approval for live operations.

## Read First

| Need | Start With |
| --- | --- |
| Pilot/live launch readiness gates | `launch-readiness-checklist.md` |
| Approved staging pilot dataset readback and reset contract | `staging-pilot-readback-reset-contract.md` |

## Current Operations Sources

| Document | Role |
| --- | --- |
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
