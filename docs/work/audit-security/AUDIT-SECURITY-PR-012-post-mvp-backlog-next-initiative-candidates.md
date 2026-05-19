---
id: "AUDIT-SECURITY-PR-012"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-93"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-93"
---

# Post-MVP Backlog And Next Initiative Candidates

## Goal

Split remaining Product MVP live transition work into pilot gates, Post-MVP backlog groups, and next initiative candidates.

## Scope

- Classify KakaoTalk, PACS/device, PG, inpatient, analytics, AI safety, compliance, and data migration work.
- Separate pilot blockers from Post-MVP improvements.
- Propose next initiative candidates and sequencing.
- Record backlog candidate titles for future Linear planning.

## Out Of Scope

- Creating new projects immediately.
- Starting implementation.
- Production deploy.
- Remote Supabase, provider rollout, or real patient/hospital data access.

## Handoff Notes

The canonical report is:

- `docs/engineering/auth-security/auth-login/post-mvp-backlog-next-initiative-candidates.md`

HTML report:

- `docs/completed/audit-security/2026-05-20-den-93-post-mvp-backlog-next-initiative-candidates-report.html`

Recommended sequence:

1. Live Safety Closure.
2. Pilot Operations Kit.
3. Downstream Department Persistence or Provider Integration Readiness, depending on pilot hospital pain.
4. Operations Intelligence.
5. Compliance And Audit Plus.
6. AI Safety Workbench.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
