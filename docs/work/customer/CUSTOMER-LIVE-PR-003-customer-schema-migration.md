---
id: "CUSTOMER-LIVE-PR-003"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-105"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-delta-plan.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-migration.md"
  - "docs/product/demo-data/patient-guardian-data-v1.md"
  - "docs/product/demo-data/seed-handoff-v1.md"
dependencies:
  - "CUSTOMER-LIVE-PR-002"
  - "RECEPTION-LIVE-PR-003"
updated: "2026-05-20"
---

# Customer Schema Migration

## Goal

Implement the local-first schema foundation for customer-management guardian/patient profile persistence.

## Background

DEN-102 fixed the field/table delta. DEN-105 applies that plan as a migration and synthetic seed fixture without changing customer-management UI or live provider boundaries.

## Scope

- Extend Project 03 `guardians`, `patients`, `patient_guardians`, and `consents`.
- Add referral source, duplicate override, patient staff assignment, and customer profile change-log support tables.
- Add derived deletion-lock view.
- Add focused static migration tests and synthetic seed coverage.

## Out Of Scope

- Customer-management UI or route wiring.
- Kakao/SMS/email provider integration.
- Actual resident registration numbers, cash receipt identifiers, or imported client/patient data.
- Remote Supabase, staging migration, production deploy, or live data access.
- Hard delete.

## Done When

- `supabase/migrations/20260520140000_customer_management_schema_delta.sql` exists and passes focused static coverage.
- `supabase/seed.sql` contains DEN-105 synthetic customer-management fixture rows.
- `docs/engineering/current-status.md` and `docs/work/index.md` point to Project 06 / DEN-106 as next work.
- Korean HTML report exists for DEN-105.
- Linear DEN-105 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/customer-management-schema-migration.spec.ts --reporter=line`
- `npx playwright test tests/customer-management-schema-migration.spec.ts tests/reception-domain-schema-migration.spec.ts --reporter=line`
- `npm run docs:check`
- `npm run security:secrets`

## Result

Human Review handoff: `docs/completed/customer/2026-05-20-den-105-customer-schema-migration-report.html`.
