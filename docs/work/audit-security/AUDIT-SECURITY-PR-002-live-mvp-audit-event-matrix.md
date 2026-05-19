---
id: "AUDIT-SECURITY-PR-002"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-83"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-83"
---

# Live MVP Audit Event Matrix

## Goal

Define the audit event matrix that follow-up live MVP audit implementation issues will use.

## Scope

- Define workspace/member/profile mutation audit events.
- Define reception, encounter, chart, order, billing, and payment-state audit events.
- Define actor, workspace, target, before/after, reason, and metadata fields.
- Explicitly document sensitive data exclusions.
- Recommend the implementation order for DEN-84 and later issues.

## Out Of Scope

- Audit persistence implementation.
- Full compliance/legal review.
- Analytics dashboard.
- Remote Supabase, production deploy, external provider rollout, or real data access.

## Handoff Notes

The canonical event contract is:

- `docs/engineering/auth-security/auth-login/live-mvp-audit-event-matrix.md`

DEN-84 should treat this as the input for the `audit_events` schema and append helper.

## Verification

- `npm run docs:check`
- `npm run security:secrets`
