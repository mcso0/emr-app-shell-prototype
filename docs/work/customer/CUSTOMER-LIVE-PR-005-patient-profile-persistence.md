---
id: "CUSTOMER-LIVE-PR-005"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-107"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/customer-guardian-profile-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-patient-profile-persistence.md"
dependencies:
  - "CUSTOMER-LIVE-PR-004"
updated: "2026-05-20"
---

# Patient Profile Persistence

## Goal

Persist customer-management patient profile reads and edits behind a server-owned route boundary.

## Scope

- Add patient profile read/write core.
- Add `GET`/`PATCH` route for a workspace-scoped patient profile.
- Enforce active workspace membership and `patient:view`/`patient:update`.
- Validate patient profile status, message consent, name, species, and weight.
- Wire the shared patient drawer save button through the persistence route.

## Out Of Scope

- Guardian relationship changes.
- Reception, appointment, chart, or billing actions.
- Real animal/customer data import.
- Remote Supabase migration or production deploy.

## Verification

- `npx playwright test tests/customer-patient-profile-server.spec.ts --reporter=line`
- `npx playwright test tests/customer-patient-profile-server.spec.ts tests/customer-guardian-profile-server.spec.ts tests/customer.spec.ts --reporter=line`
- `npx tsc --noEmit`

## Result

Human Review handoff: `docs/completed/customer/2026-05-20-den-107-patient-profile-persistence-report.html`.
