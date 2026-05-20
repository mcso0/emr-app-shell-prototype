---
id: "CUSTOMER-LIVE-PR-001"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-101"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/demo-data/patient-guardian-data-v1.md"
  - "docs/product/demo-data/seed-handoff-v1.md"
  - "docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md"
  - "docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md"
dependencies:
  - "RECEPTION-LIVE-PR-003"
  - "DEMO-DATA-PR-001"
updated: "2026-05-20"
---

# Customer Management Persistence Scope

## Goal

Confirm Project 06 customer-management persistence scope and sensitive-data boundary before schema implementation.

## Background

DEN-99 defined synthetic patient/guardian profile, relationship, consent, and soft-delete data. Project 03 only created the minimum reception schema required for registration and encounter creation. Project 06 extends that base into customer-management master data.

## Scope

- Define included guardian profile, patient profile, consent/referral, relationship, soft-delete/restore, and customer-management read scope.
- Define sensitive-data handling for phone, address, email, cash receipt, resident-number placeholder, memo, consent, and deletion audit data.
- Separate Project 03 reception responsibilities from Project 06 customer-management responsibilities.
- Identify the display-safe fields Project 04 and later workflows may consume.
- Set the next implementation order for DEN-102 through DEN-110.

## Out Of Scope

- Real guardian, animal, hospital, or clinic data.
- Actual resident registration number, legal identifier, or financial identifier storage.
- KakaoTalk, SMS, email, push, or message-provider delivery.
- Remote Supabase, production deploy, or live data access.
- Hard delete, advanced duplicate merge, CRM segmentation, deposits, accounting export, or marketing automation.
- Role/permission policy changes.
- Chart, order, billing, inpatient, device, PACS, or PG provider workflow changes.

## Done When

- `docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md` is ready for DEN-102.
- `docs/engineering/current-status.md` and `docs/work/index.md` point to Project 06 / DEN-102 as next work.
- Korean HTML report exists for DEN-101.
- Linear DEN-101 is commented and moved to Human Review.

## Verification

- `npm run docs:check`
- `npm run security:secrets`

## Result

Human Review handoff: `docs/completed/customer/2026-05-20-den-101-customer-management-persistence-scope-report.html`.
