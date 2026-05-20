---
id: "CUSTOMER-LIVE-PR-007"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-109"
source_docs:
  - "docs/engineering/auth-security/auth-login/customer-soft-delete-restore-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-relationship-management-persistence.md"
dependencies:
  - "CUSTOMER-LIVE-PR-006"
updated: "2026-05-20"
---

# Customer Soft Delete Restore Persistence

## Goal

Persist customer soft delete, restore, and deletion lock behavior for patient and guardian master records.

## Scope

- Add patient archive route.
- Add guardian archive route.
- Add active/deleted archive list route.
- Calculate active appointment, encounter, invoice, deposit-like, primary-relationship, and active-patient locks server-side.
- Keep hard delete out of scope.
- Return audit hook payloads for archive actions.

## Verification

- `npx playwright test tests/customer-soft-delete-restore-server.spec.ts --reporter=line`
- `npx tsc --noEmit --pretty false`
- Project-wide customer regression continues in `CUSTOMER-LIVE-PR-008`.

## Result

Human Review handoff: `docs/completed/customer/2026-05-20-den-109-soft-delete-restore-persistence-report.html`.
