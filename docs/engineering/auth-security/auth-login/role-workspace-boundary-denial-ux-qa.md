---
title: "Role Workspace Boundary And Denial UX QA"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-90"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-009-role-workspace-boundary-denial-ux-qa.md"
---

# Role Workspace Boundary And Denial UX QA

Linear: DEN-90
Project: `05 Audit, Security & MVP Readiness`

## Summary

This QA pass checked role-based access, workspace boundary denial, and denial UX risk for the local-first MVP.

Result: **Pass for local-first permission boundary review, with UX follow-ups**.

No blocker was found in this DEN-90 scope. The role/permission resolver, server session reader, role mutation boundary, reception/chart/billing persistence routes, audit review route, and workspace/member UI regressions passed focused tests.

The main follow-up is not a route bypass. It is product/UX clarity: mock role labels still include compatibility roles such as nurse/billing admin in some UI tests, while the canonical MVP role set is `hospital_admin`, `vet`, `technician`, and `front_desk`. That should be aligned before representative pilot rehearsal so mock fallback does not imply a different live role model.

## Scope And Assumptions

In scope:

- `hospital_admin`, `vet`, `technician`, and `front_desk` permission behavior.
- Cross-workspace read/write denial.
- Chart/order/billing/reception mutation denial.
- Audit review admin-only access.
- Demo actor header and mock fallback boundary.
- Denial response safety: avoid secrets, SQL details, stack traces, and raw provider data.

Out of scope:

- Role policy redesign.
- Code modification.
- Production monitoring.
- Remote Supabase, production deploy, live/staging database mutation, or real patient/hospital data.

Assumptions:

- Current QA remains local-first with synthetic demo-data and mock auth mode.
- Manual role smoke was not required because the relevant server, UI, and route suites passed.
- DEN-91 will separately validate whether the representative can explain the role/fallback model in a pilot rehearsal.

## Role Matrix QA Result

| Role | QA result | Evidence |
| --- | --- | --- |
| `hospital_admin` | Pass | Receives full workspace permissions, can manage invitations/roles, can access audit review, and last-active-admin guard blocks unsafe demotion/deactivation. |
| `vet` | Pass | Can view and update chart/SOAP/diagnosis/order paths where scoped; lacks admin/member management permissions; billing mutation denial is covered where applicable. |
| `technician` | Pass | Can view charts and perform support billing actions in the current MVP permission model, but cannot mutate chart diagnosis/SOAP authoring paths. |
| `front_desk` | Pass | Can create reception mutations and use front-desk billing support actions, but remains chart view-only and lacks admin/member management. |
| Multi-role membership | Pass | Effective permissions are additive; non-admin multi-role combinations do not inherit admin-only `role_permission:manage`. |

## Denial UX Findings

| Severity | Finding | Disposition |
| --- | --- | --- |
| High | No unauthorized mutation or cross-workspace access bypass was found. | No blocker. |
| Medium | Mock/demo role naming can confuse pilot explanation because some UI flows still expose compatibility labels like nurse or billing admin while the canonical role set uses technician/front desk. | Follow-up before DEN-91 representative rehearsal. |
| Low | API denial responses use compact typed `denialReason` codes. This is safe and does not expose internals, but some user-facing surfaces may need friendlier Korean copy. | Follow-up UX copy pass; do not change server contract casually. |
| Low | Broad Playwright runs continue to emit non-blocking Tiptap duplicate extension and Node listener warnings. | Same follow-up as DEN-89; not a DEN-90 blocker. |

## Boundary Result

Pass signals:

- Server permission resolver returns typed denial reasons for unauthenticated, inactive user, missing workspace membership, inactive membership, permission gaps, and last-admin protection.
- Cross-workspace membership does not grant access to a different workspace.
- Role update route uses server identity and limits demo actor header acceptance to mock mode.
- Reception queue/calendar reads and mutation writes enforce active workspace membership and route-specific permissions.
- Chart mutation cores enforce `chart:update` and encounter workspace scope.
- Billing mutation cores enforce `billing:issue` and invoice/encounter workspace scope.
- Audit review is hospital-admin-only and workspace-scoped.
- Personal profile data is not an authorization source.

## Blockers And Follow-Ups

Blockers:

- None found in local-first DEN-90 QA.

Follow-up issue candidates:

- Align mock UI role labels and seed aliases with the canonical MVP role set before DEN-91 or representative-facing pilot materials.
- Add a denial-copy review for user-facing screens so permission failures are understandable without exposing internals.
- Keep DEN-88 audit completeness and remote/live RLS replay gates open before any remote pilot.

Post-MVP:

- Enterprise role customization and delegated admin policies.
- Production monitoring and alerting for repeated denial events.
- SSO/SCIM and advanced identity lifecycle.

## Verification

- `npx playwright test tests/permission-resolver.spec.ts tests/server-session-reader.spec.ts tests/server-permission-enforcement.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/workspace-membership-status-server.spec.ts tests/workspace-invitation-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/reception-queue-read-server.spec.ts tests/reception-calendar-read-server.spec.ts tests/chart-soap-note-persistence-server.spec.ts tests/chart-diagnosis-persistence-server.spec.ts tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-action-persistence-server.spec.ts tests/chart-order-lifecycle-persistence-server.spec.ts tests/billing-invoice-candidate-sync-server.spec.ts tests/billing-invoice-line-persistence-server.spec.ts tests/billing-payment-status-persistence-server.spec.ts tests/audit-review-surface.spec.ts tests/auth.spec.ts --reporter=line` (`124 passed`)
- `npm run docs:check`
- `npm run security:secrets`
