---
id: "AUDIT-SECURITY-PR-003"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-84"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-84"
---

# Live MVP Audit Log Persistence

## Goal

Implement the local-first audit log schema and deterministic append helper for live MVP mutations.

## Scope

- Add `audit_events` table migration.
- Implement actor/workspace/target/action/before/after metadata contract.
- Add a server-only append helper and mock/Supabase gateway boundary.
- Define transaction guidance for DEN-85 route integration.
- Add focused audit persistence tests.

## Out Of Scope

- Audit review UI.
- External log sink.
- Analytics aggregation.
- Business route event emission.
- Remote Supabase, production deploy, provider rollout, or real data access.

## Handoff Notes

The canonical implementation handoff is:

- `docs/engineering/auth-security/auth-login/live-mvp-audit-log-persistence.md`

DEN-85 should emit events from workspace/member, reception, chart, order, and billing mutation routes using the helper boundary.

## Verification

- `npx playwright test tests/live-audit-log-persistence.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
