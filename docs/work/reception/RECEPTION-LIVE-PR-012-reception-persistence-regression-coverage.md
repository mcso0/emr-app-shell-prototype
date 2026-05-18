---
id: "RECEPTION-LIVE-PR-012"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 04 / DEN-65"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-sales-demo-mock-fallback-preservation.md"
  - "docs/engineering/auth-security/auth-login/reception-day-calendar-read.md"
  - "docs/engineering/auth-security/auth-login/reception-queue-read.md"
  - "docs/engineering/auth-security/auth-login/reception-appointment-check-in-transition.md"
  - "docs/engineering/auth-security/auth-login/reception-walk-in-encounter-create.md"
dependencies:
  - "RECEPTION-LIVE-PR-011"
updated: "2026-05-19"
---

# Reception Persistence Regression Coverage

## Goal

Protect the core reception persistence flow with E2E-style regression coverage.

## Scope

- Add walk-in create then reload verification using queue/calendar read responses.
- Add appointment check-in then reload verification using queue/calendar read responses.
- Add cross-workspace persisted read denial coverage.
- Keep test data deterministic with route-level persisted-shaped fixtures.

## Out Of Scope

- Chart/order/billing E2E.
- Performance testing.
- Remote Supabase link/push, production deploy, or real data access.

## Done When

- Walk-in create can be verified after reload through read routes.
- Appointment check-in can be verified after reload through read routes.
- Cross-workspace queue/calendar reads deny the demo actor.
- Korean HTML report exists for DEN-65.
- Linear DEN-65 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/reception.spec.ts -g "persistence regression|cross-workspace" --reporter=line`: 3 passed
- `npm run build`: passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 30 passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed

## Result

Ready for Human Review.

DEN-65 added E2E-style regression coverage for reception persistence reload behavior without touching remote Supabase, production deploy, or real clinic/patient data.
