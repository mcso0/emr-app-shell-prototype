---
id: "AUDIT-SECURITY-PR-004"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-85"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-85"
---

# Live Mutation Audit Emission

## Goal

Emit safe audit events from critical workspace, reception, chart, order, and billing mutations.

## Scope

- Add a reusable mutation audit emitter wrapper around the DEN-84 append helper.
- Wire membership role/status routes to audit append.
- Wire reception walk-in and appointment check-in mutations to audit append.
- Wire SOAP save, chart completion, order action, and billing payment state mutations to audit append.
- Add focused tests proving events are emitted and sensitive note/body data is excluded.

## Out Of Scope

- Audit review UI.
- Analytics dashboard or external compliance export.
- Remote Supabase, production deploy, provider rollout, or real patient/hospital data access.

## Handoff Notes

The canonical implementation handoff is:

- `docs/engineering/auth-security/auth-login/live-mvp-mutation-audit-emission.md`

DEN-86 should use the persisted event contract to add a minimal hospital-admin audit review surface.

## Verification

- `npx playwright test tests/live-audit-mutation-emission.spec.ts --reporter=line`
- `npx playwright test tests/auth.spec.ts tests/reception.spec.ts tests/chart.spec.ts tests/billing.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
