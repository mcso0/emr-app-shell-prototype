---
id: "CUSTOMER-LIVE-PR-008"
status: "todo"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-110"
source_docs:
  - "docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-delta-plan.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/customer-guardian-profile-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-patient-profile-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-relationship-management-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-soft-delete-restore-persistence.md"
dependencies:
  - "CUSTOMER-LIVE-PR-001"
  - "CUSTOMER-LIVE-PR-002"
  - "CUSTOMER-LIVE-PR-003"
  - "CUSTOMER-LIVE-PR-004"
  - "CUSTOMER-LIVE-PR-005"
  - "CUSTOMER-LIVE-PR-006"
  - "CUSTOMER-LIVE-PR-007"
updated: "2026-05-20"
---

# Customer Management Regression Handoff

## Goal

Run the Project 06 customer management persistence regression set and produce the handoff for DEN-110.

## Scope

- Verify guardian profile save and reload behavior.
- Verify patient profile save and reload behavior.
- Verify primary/additional guardian relationship changes.
- Verify soft delete, restore, active/deleted list, and deletion lock scenarios.
- Update source docs, current status, and the Korean closeout report.

## Out Of Scope

- Full chart/order/billing E2E.
- Message provider, Kakao delivery, or production integrations.
- Remote Supabase application.
- Moving Linear issues to Done before representative acceptance.

## Verification

- Focused customer persistence regression tests.
- `npm run docs:check`
- `npm run security:secrets`

## Result

Not started. This work item exists so current status can link to the DEN-110 handoff scope without a broken docs reference.
