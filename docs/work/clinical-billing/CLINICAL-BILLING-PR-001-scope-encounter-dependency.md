---
id: "CLINICAL-BILLING-PR-001"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-67"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-chart-order-billing-handoff-closeout.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.en.md"
dependencies:
  - "RECEPTION-LIVE-PR-013"
updated: "2026-05-19"
---

# Clinical Billing Persistence Scope And Encounter Dependency

## Goal

Confirm the Project 04 chart, order, and billing persistence scope and the encounter dependency contract before implementation starts.

## Scope

- Define which SOAP/chart/diagnosis/order/invoice/billing states Project 04 should persist.
- Confirm `encounter.id` and `workspaceId` as the required join/scope fields.
- Define mock fallback and sales demo preservation rules.
- Define clinical/billing permission boundaries.
- List audit event candidates for the later audit/security handoff.

## Out Of Scope

- Schema migration implementation.
- Chart/order/billing route or UI implementation.
- Full lab/imaging/dispensing/treatment live conversion.
- PG/payment provider integration.
- Remote Supabase link/push/query, production deploy, or real clinic/patient data access.

## Done When

- `docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md` exists and covers scope, dependency, permission, and audit candidates.
- `docs/engineering/current-status.md` and `docs/work/index.md` point to the next Project 04 implementation issue.
- Korean HTML report exists for DEN-67.
- Linear DEN-67 is commented and moved to Human Review.

## Verification

- `npm run docs:check`
- `npm run security:secrets`

## Handoff Notes

Ready for Human Review.

DEN-67 is planning-only. The next implementation issue is DEN-68 `00-02 Implement clinical order billing schema migration`. Keep remote Supabase, production deploy, and real data out of scope unless 승욱 explicitly approves them.
