---
id: "CUSTOMER-LIVE-PR-006"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-108"
source_docs:
  - "docs/engineering/auth-security/auth-login/customer-relationship-management-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-guardian-profile-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-patient-profile-persistence.md"
dependencies:
  - "CUSTOMER-LIVE-PR-004"
  - "CUSTOMER-LIVE-PR-005"
updated: "2026-05-20"
---

# Relationship Management Persistence

## Goal

Persist patient-guardian relationship link, primary-change, and relationship-only unlink boundaries.

## Scope

- Add relationship action core.
- Enforce active workspace membership and `patient:update`.
- Block cross-workspace guardian links.
- Block duplicate active relationships.
- Keep guardian/patient master records intact during primary changes and unlink.

## Verification

- `npx playwright test tests/customer-relationship-management-server.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run security:secrets`

## Result

Human Review handoff: `docs/completed/customer/2026-05-20-den-108-relationship-management-persistence-report.html`.
