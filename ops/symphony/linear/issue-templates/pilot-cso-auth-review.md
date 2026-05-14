# Pilot Issue: CSO Auth Boundary Review

Labels:

```text
pilot
team:security
type:security-audit
risk:auth
risk:permissions
cso
```

Status:

```text
Security Review
```

## Goal

Run a read-only CSO-style review of the auth and permission boundary, then produce a security report with findings or explicit no-findings rationale.

## Mode

```text
cso --scope auth
```

## Context

- Read `AGENTS.md`.
- Read `docs/agent-start-here.md`.
- Read `docs/engineering/current-status.md`.
- Read `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`.
- Read `docs/engineering/auth-security/auth-login/README.md`.
- Read `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`.
- Read `docs/engineering/agent-orchestration/cso-security-agent.md`.

## Scope

- Review mock auth, Supabase adapter boundary, permission helper assumptions, and docs that warn against client-only enforcement.
- Identify places where future agents might mistake prototype permission UX for server enforcement.
- Produce findings only when there is a concrete exploit path or operational security risk.

## Out of Scope

- Code changes.
- Commits.
- Live Supabase validation.
- Migrations.
- RLS policies.
- Server enforcement implementation.
- Live exploit attempts.

## Report Requirements

- Severity
- Confidence score
- VERIFIED, UNVERIFIED, or TENTATIVE status
- File and line when available
- Concrete exploit scenario
- Impact
- Specific remediation
- Follow-up issue recommendation

## Done Criteria

- Security report is complete.
- No code was modified.
- Any remediation is proposed as a separate Linear issue.
- Stop at Human Review or the equivalent security review handoff.

