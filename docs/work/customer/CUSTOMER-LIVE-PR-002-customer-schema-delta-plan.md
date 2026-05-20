---
id: "CUSTOMER-LIVE-PR-002"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-102"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-delta-plan.md"
  - "docs/product/demo-data/patient-guardian-data-v1.md"
  - "docs/product/demo-data/seed-handoff-v1.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-migration.md"
  - "supabase/migrations/20260519090000_reception_domain_schema_foundation.sql"
dependencies:
  - "CUSTOMER-LIVE-PR-001"
  - "RECEPTION-LIVE-PR-003"
  - "DEMO-DATA-PR-001"
updated: "2026-05-20"
---

# Customer Schema Delta Plan

## Goal

Plan the customer-management schema delta that DEN-105 should implement on top of Project 03 reception persistence.

## Background

DEN-101 fixed the Project 06 scope and sensitive-data boundary. DEN-102 compares the existing `guardians`, `patients`, `patient_guardians`, and `consents` schema with DEN-99 patient/guardian demo-data needs.

## Scope

- Compare Project 03 schema against DEN-99 patient/guardian fields.
- Split scalar column additions from new relationship/support tables.
- Plan guardian referral source, cash receipt preference, consent version, relationship audit, patient staff assignment, change history, and deletion-lock source.
- Keep actual identifiers, provider payloads, remote Supabase, and hard delete out of scope.
- Define DEN-105 acceptance criteria.

## Out Of Scope

- Migration implementation.
- Customer-management UI or route wiring.
- Real privacy, legal, financial, provider, or production data.
- Remote Supabase, staging migration, production deploy, or live data access.

## Done When

- `docs/engineering/auth-security/auth-login/customer-management-schema-delta-plan.md` is ready for DEN-105.
- `docs/engineering/current-status.md` and `docs/work/index.md` point to Project 06 / DEN-105 as next work.
- Korean HTML report exists for DEN-102.
- Linear DEN-102 is commented and moved to Human Review.

## Verification

- `npm run docs:check`
- `npm run security:secrets`

## Result

Human Review handoff: `docs/completed/customer/2026-05-20-den-102-customer-schema-delta-plan-report.html`.
