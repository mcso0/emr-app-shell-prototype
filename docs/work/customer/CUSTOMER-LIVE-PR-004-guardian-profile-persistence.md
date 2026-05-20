---
id: "CUSTOMER-LIVE-PR-004"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "Project 06 / DEN-106"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-migration.md"
  - "docs/engineering/auth-security/auth-login/customer-guardian-profile-persistence.md"
dependencies:
  - "CUSTOMER-LIVE-PR-003"
updated: "2026-05-20"
---

# Guardian Profile Persistence

## Goal

Persist customer-management guardian profile reads and edits behind a server-owned route boundary.

## Scope

- Add guardian profile read/write core.
- Add `GET`/`PATCH` route for a workspace-scoped guardian profile.
- Enforce active workspace membership and `patient:view`/`patient:update`.
- Reject raw identifier-shaped sensitive values.
- Wire the shared guardian drawer save button through the persistence route.
- Add focused server tests and customer UI smoke coverage.

## Out Of Scope

- Guardian soft delete/restore.
- Patient profile persistence.
- Patient-guardian relationship changes.
- Provider delivery or Kakao integration.
- Real personal identifiers, imported data, remote Supabase migration, or production deploy.

## Done When

- `docs/engineering/auth-security/auth-login/customer-guardian-profile-persistence.md` summarizes the boundary.
- Focused server tests, customer UI smoke, typecheck, docs check, and secret scan pass.
- `docs/engineering/current-status.md` and `docs/work/index.md` point to Project 06 / DEN-107 as next work.
- Korean HTML report exists for DEN-106.
- Linear DEN-106 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/customer-guardian-profile-server.spec.ts --reporter=line`
- `npx playwright test tests/customer-guardian-profile-server.spec.ts tests/customer.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run security:secrets`

## Result

Human Review handoff: `docs/completed/customer/2026-05-20-den-106-guardian-profile-persistence-report.html`.
