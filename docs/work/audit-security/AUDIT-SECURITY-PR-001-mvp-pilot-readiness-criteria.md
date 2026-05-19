---
id: "AUDIT-SECURITY-PR-001"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-82"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-82"
---

# MVP Pilot Readiness Criteria

## Goal

Define the MVP pilot readiness rubric and blocker/follow-up/Post-MVP classification policy for Project 05.

## Scope

- Define must-have, should-have, and Post-MVP readiness criteria.
- Cover auth, DB/RLS, persistence, audit, QA, demo-data, and operations gates.
- Define blocker and follow-up handling.
- Add a representative review checklist.

## Out Of Scope

- Implementation work.
- Production deploy.
- External provider rollout.
- Remote Supabase, live data, or real patient/hospital data access.

## Handoff Notes

The canonical readiness criteria are in:

- `docs/engineering/auth-security/auth-login/mvp-pilot-readiness-criteria.md`

DEN-83 should use this rubric when defining the audit event matrix for live MVP mutations.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
