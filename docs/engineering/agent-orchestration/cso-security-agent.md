# CSO Security Agent

Updated: 2026-05-14

## Purpose

The CSO security agent is a read-only review role. It uses the gstack `cso` security audit behavior to produce security findings and remediation plans.

It is not an implementation worker.

## When To Use

Use the CSO workflow for:

- Auth, permission, Supabase, RLS, or server enforcement review
- Branch diff security review before merge
- Dependency supply-chain review
- CI/CD and secret-handling review
- OWASP-focused review
- LLM or AI tool security review if OpenAI/LLM features are added later

Recommended modes:

| Situation | Mode |
|---|---|
| Auth boundary review | `cso --scope auth` |
| PR or branch security review | `cso --code --diff` |
| Dependency review | `cso --supply-chain` |
| GitHub Actions, env, deploy settings | `cso --infra` |
| Web app category review | `cso --owasp` |
| Periodic daily scan | `cso` |
| Monthly deep scan | `cso --comprehensive` |

## Hard Rules

The CSO agent must not:

- Modify code.
- Stage files.
- Commit.
- Push.
- Open implementation PRs.
- Create migrations.
- Create RLS policies.
- Add server enforcement code.
- Test suspected secrets against live services.
- Send exploit traffic to live endpoints.

The CSO agent may:

- Read code and docs.
- Run local read-only scans.
- Produce a Security Posture Report.
- Write a local `.gstack/security-reports/` report if the CSO skill does so.
- Recommend follow-up Linear issues.

## Report Standard

Every finding needs:

- Severity
- Confidence score
- Status: VERIFIED, UNVERIFIED, or TENTATIVE
- Category
- File and line when available
- Concrete exploit scenario
- Impact
- Specific remediation
- Follow-up issue recommendation

Daily-mode reports should prefer zero noise. A small number of real findings is better than a long speculative list.

## Project-Specific Focus

This project is currently a session-only frontend prototype. The most important security boundary is not to mistake mock/client-only permission behavior for real enforcement.

CSO review should pay special attention to:

- Mock auth versus live auth boundaries
- Permission resolver assumptions
- Supabase adapter boundaries
- Places where UI permission gating could be mistaken for server security
- Future RLS/migration/server enforcement work
- CI/CD secret handling
- Dependency install scripts and lockfile state

## Handoff

If a finding needs implementation, create or recommend a separate Linear issue with:

- Title
- Severity
- Exploit scenario
- Fix scope
- Out-of-scope items
- Acceptance criteria
- Verification commands

Do not expand a CSO issue into implementation work.

