---
id: "AUDIT-SECURITY-PR-006"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-87"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-87"
---

# Live Auth DB RLS Workspace Threat Model

## Goal

Document the threat model for live auth, DB/RLS, and workspace boundaries before pilot readiness decisions.

## Scope

- Review auth/session spoofing risk.
- Review cross-workspace data leakage risk.
- Review role/permission escalation risk.
- Classify residual risks, blockers, follow-ups, and Post-MVP gaps.

## Out Of Scope

- Code modification.
- Penetration testing.
- External compliance certification.
- Remote Supabase, production deploy, provider rollout, or real patient/hospital data access.

## Handoff Notes

The canonical threat model is:

- `docs/engineering/auth-security/auth-login/live-auth-db-rls-workspace-threat-model.md`

DEN-88 should continue with clinical/billing mutation boundary review using the same audit/security evidence style.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
