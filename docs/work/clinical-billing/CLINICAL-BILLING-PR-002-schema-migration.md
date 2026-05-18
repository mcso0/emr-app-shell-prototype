---
id: "CLINICAL-BILLING-PR-002"
status: "human_review"
area: "clinical-billing"
priority: "P0"
target_pr: "Project 04 / DEN-68"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.en.md"
dependencies:
  - "CLINICAL-BILLING-PR-001"
updated: "2026-05-19"
---

# Clinical Order Billing Schema Migration

## Goal

Implement the minimum local-first schema migration for chart/SOAP, diagnoses, order rows, invoice lines, and billing state.

## Scope

- Add clinical/order/billing migration tables needed by DEN-69 through DEN-78.
- Include workspace scope, encounter scope, composite foreign keys, indexes, status constraints, and amount precision rules.
- Add synthetic seed rows for local development contract checks.
- Add static migration/seed contract test coverage.
- Document table summary, money/status decisions, and remaining gaps.

## Out Of Scope

- Route handler implementation.
- UI live persistence wiring.
- Full service catalog live conversion.
- Lab/imaging device result schema.
- PG transaction schema or real payment provider integration.
- Final domain RLS policy SQL.
- Remote Supabase link/push/query, production deploy, or real clinic/patient data access.

## Done When

- Migration exists and is statically covered.
- Synthetic seed contract exists and uses no real data.
- Engineering status docs and work index point to DEN-69 next.
- Korean HTML report exists for DEN-68.
- Linear DEN-68 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/clinical-billing-schema-migration.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run security:secrets`
- `npm run docs:check`

## Handoff Notes

Ready for Human Review.

DEN-69 can use `soap_notes` as the first route-backed chart persistence table. Remote Supabase and real data remain approval-gated.
