---
title: "Live MVP Mutation Audit Emission"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-85"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-004-live-mutation-audit-emission.md"
---

# Live MVP Mutation Audit Emission

Linear: DEN-85
Project: `05 Audit, Security & MVP Readiness`

## Summary

DEN-85 connects the DEN-84 audit append helper to critical live MVP mutation boundaries.

The implementation keeps the audit payload as workflow metadata only. It records actor, workspace, event type, target id, encounter/patient/guardian context when available, request id, and safe before/after summaries. It does not store full SOAP/chart bodies, raw request payloads, secrets, stack traces, SQL error details, or real patient/hospital data.

## Connected Mutation Boundaries

| Area | Mutation boundary | Event type |
| --- | --- | --- |
| Workspace membership | Role update route | `workspace.membership_roles_changed` |
| Workspace membership | Status update route | `workspace.membership_status_changed` |
| Reception | Walk-in encounter create | `reception.walk_in_created` |
| Reception | Appointment check-in | `reception.appointment_checked_in` |
| Chart | SOAP save/autosave | `chart.soap_saved` |
| Chart | Chart completion handoff | `chart.completed` |
| Order | Order confirmation | `order.confirmed` |
| Order | Billing candidate request | `order.billing_candidate_requested` |
| Billing | Payment method/unpaid/paid state save | `billing.payment_state_changed` |

## Implementation Notes

Files:

- `src/features/audit/server-mutation-audit-core.ts`
- `src/features/audit/server-mutation-audit.ts`
- `src/features/reception/server-walk-in-encounter-core.ts`
- `src/features/reception/server-appointment-check-in-core.ts`
- `src/features/chart/server-soap-note-persistence-core.ts`
- `src/features/chart/server-chart-completion-core.ts`
- `src/features/chart/server-order-action-persistence-core.ts`
- `src/features/billing/server-payment-status-persistence-core.ts`
- `src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts`
- `src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts`

Server core functions accept optional `auditGateway`, `auditNow`, and `auditRequestId` arguments. Tests can inject a mock audit gateway and live routes can pass the Supabase audit RPC gateway when the request is backed by a Supabase session.

If a configured critical audit append fails, the mutation returns a write failure instead of silently dropping audit evidence. Mock fallback remains local-first and synthetic.

## Out Of Scope

- Audit review UI. DEN-86 owns the minimal hospital-admin review surface.
- External compliance export, analytics dashboard, or external log sink.
- Remote Supabase deployment, production data migration, provider rollout, or real data access.
- Medical advice or clinical decision support.

## Verification

- `npx playwright test tests/live-audit-mutation-emission.spec.ts --reporter=line`
- `npx playwright test tests/auth.spec.ts tests/reception.spec.ts tests/chart.spec.ts tests/billing.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
