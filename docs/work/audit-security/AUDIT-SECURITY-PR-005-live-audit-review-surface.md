---
id: "AUDIT-SECURITY-PR-005"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-86"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-86"
---

# Live Audit Review Surface

## Goal

Add a minimal hospital-admin surface for reviewing workspace-scoped audit events.

## Scope

- Add a hospital admin side-panel entry point for audit review.
- Show action/event, actor, target, timestamp, workspace scope, and safe summary.
- Add minimal search and event-type filtering.
- Enforce non-admin denial through a server route and a DB read RPC.
- Add focused route, core, UI, and migration tests.

## Out Of Scope

- Analytics charts.
- Export/download.
- Retention policy UI.
- External compliance dashboard or legal certification.
- Remote Supabase, production deploy, provider rollout, or real patient/hospital data access.

## Handoff Notes

The canonical implementation handoff is:

- `docs/engineering/auth-security/auth-login/live-mvp-audit-review-surface.md`

DEN-87/DEN-88 should review live auth/RLS/workspace and clinical/billing boundaries against this audit review/read path.

## Verification

- `npx playwright test tests/audit-review-surface.spec.ts --reporter=line`
- `npx playwright test tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
