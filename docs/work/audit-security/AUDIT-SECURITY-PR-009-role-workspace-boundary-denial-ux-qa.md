---
id: "AUDIT-SECURITY-PR-009"
status: "human_review"
area: "audit-security"
priority: "P0"
target_pr: "Project 05 / DEN-90"
owner: "Codex"
updated: "2026-05-20"
linear: "DEN-90"
---

# Role Workspace Boundary And Denial UX QA

## Goal

QA role-based access, workspace boundary, and denial UX risk before representative pilot rehearsal.

## Scope

- Check `hospital_admin`, `vet`, `technician`, and `front_desk` access expectations.
- Check cross-workspace read/write denial.
- Check denial responses for excessive internal detail.
- Check whether role switch/mock fallback can confuse live behavior.

## Out Of Scope

- Role policy redesign.
- Code modification.
- Production monitoring.
- Remote Supabase, production deploy, provider rollout, or real patient/hospital data access.

## Handoff Notes

The canonical QA report is:

- `docs/engineering/auth-security/auth-login/role-workspace-boundary-denial-ux-qa.md`

Result:

- Blockers: none found in local-first QA.
- Main follow-up: align mock role labels/aliases with canonical MVP roles before DEN-91 representative rehearsal.
- Other follow-ups: denial copy review, DEN-88 audit completeness, remote/live RLS validation gate.

Next recommended Project 05 issue:

- DEN-91 `03-03 Run representative pilot rehearsal and defect triage`

## Verification

- `npx playwright test tests/permission-resolver.spec.ts tests/server-session-reader.spec.ts tests/server-permission-enforcement.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/workspace-membership-status-server.spec.ts tests/workspace-invitation-server.spec.ts tests/reception-mutation-permissions-server.spec.ts tests/reception-queue-read-server.spec.ts tests/reception-calendar-read-server.spec.ts tests/chart-soap-note-persistence-server.spec.ts tests/chart-diagnosis-persistence-server.spec.ts tests/chart-order-draft-persistence-server.spec.ts tests/chart-order-action-persistence-server.spec.ts tests/chart-order-lifecycle-persistence-server.spec.ts tests/billing-invoice-candidate-sync-server.spec.ts tests/billing-invoice-line-persistence-server.spec.ts tests/billing-payment-status-persistence-server.spec.ts tests/audit-review-surface.spec.ts tests/auth.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`
