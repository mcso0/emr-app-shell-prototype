---
id: ENGINEERING-AUTH-RECEPTION-MUTATION-PERMISSION-HARDENING
status: implemented
area: engineering
doc_type: api_boundary
related_work:
  - "DEN-61"
  - "docs/work/reception/RECEPTION-LIVE-PR-008-reception-mutation-permission-hardening.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Mutation Permission Hardening

Updated: 2026-05-19
Linear: DEN-61
Project: `03 Reception & Encounter Persistence`

## Summary

DEN-61 hardens the server-side permission contract for reception mutations.

Patient/guardian registration, walk-in encounter creation, and appointment check-in now share a single source-level mutation permission matrix. All three mutations continue to require active workspace membership plus `reception:create`. This does not change role policy; it makes the existing boundary explicit and covered by focused denial tests.

## Permission Matrix

| Mutation | Route | Required permission | Audit hook point |
| --- | --- | --- | --- |
| Patient/guardian registration | `POST /api/workspaces/[workspaceId]/reception/patient-guardian-registration` | `reception:create` | `reception.patient_guardian.register` |
| Walk-in encounter creation | `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters` | `reception:create` | `reception.walk_in.create` |
| Appointment check-in | `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in` | `reception:create` | `reception.appointment.check_in` |

Source:

- `src/features/reception/reception-mutation-permissions.ts`

## Denial Matrix

Focused regression now covers the same permission denial matrix across all three mutations:

| Scenario | Expected denial |
| --- | --- |
| Missing actor | `401 unauthenticated` |
| Inactive app user | `403 inactive_user` |
| Actor belongs to another workspace only | `403 workspace_membership_missing` |
| Actor has inactive membership in the workspace | `403 workspace_membership_inactive` |
| Actor role lacks `reception:create` | `403 permission_missing` |

The existing UI route error copy now treats `inactive_user` as a permission/workspace access denial for registration, walk-in creation, and appointment check-in.

## Audit Hook Point

DEN-61 only records stable audit hook names in the permission matrix. It does not persist audit events. A future audit/security project can use these hook point names when adding actual audit log writes.

## Out Of Scope

- Role policy changes.
- Full audit persistence.
- Chart/order/billing permission enforcement.
- Final domain RLS policy SQL.
- Remote Supabase link/push.
- Real patient, guardian, hospital, clinic, or staff data.

## Verification

- `npx playwright test tests/reception-mutation-permissions-server.spec.ts --reporter=line`: 17 passed
- `npx playwright test tests/reception-patient-guardian-registration-server.spec.ts tests/reception-walk-in-encounter-server.spec.ts tests/reception-appointment-check-in-server.spec.ts tests/reception-mutation-permissions-server.spec.ts --reporter=line`: 35 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 25 passed
- `npx tsc --noEmit`: passed
- `npm run security:secrets`: Secret scan passed, 1160 tracked files checked
- `npm run docs:check`: Checked 358 docs/agent markdown files

Broader final verification is recorded in the DEN-61 report:

- `docs/completed/reception/2026-05-19-den-61-reception-mutation-permission-hardening-report.html`
