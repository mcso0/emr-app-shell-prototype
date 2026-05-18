---
title: "Reception Persistence Regression Coverage"
status: "human_review"
updated: "2026-05-19"
source:
  - "DEN-65"
  - "docs/work/reception/RECEPTION-LIVE-PR-012-reception-persistence-regression-coverage.md"
---

# Reception Persistence Regression Coverage

Linear: DEN-65

## Summary

DEN-65 adds E2E-style regression coverage for the reception persistence path introduced in Project 03.

The tests do not touch a real database. Instead, Playwright route mocks return persisted-shaped records from the same route contracts used by the UI. This protects the user flow shape while keeping remote Supabase and real data out of scope.

## Covered Flows

- Walk-in create -> successful server write response -> reload -> queue/calendar reads restore the walk-in encounter.
- Appointment check-in -> successful server transition response -> reload -> queue/calendar reads restore the checked-in appointment and encounter.
- Cross-workspace queue/calendar read attempts deny a demo actor with `workspace_membership_missing`.

## Test Data Strategy

- Use deterministic persisted-shaped fixture IDs:
  - `encounter-e2e-walkin-dubu`
  - `queue-e2e-walkin-dubu`
  - `encounter-e2e-appointment-nabi`
  - `queue-e2e-appointment-nabi`
- Keep route state local to each test with boolean flags such as `walkInCreated` and `appointmentCheckedIn`.
- Return empty read arrays before the simulated write succeeds.
- Return queue/calendar read records after the simulated write succeeds and the page reloads.

## Remaining Gaps

- Real local Supabase SQL replay remains blocked when Docker daemon is unavailable.
- Chart/order/billing persistence E2E is intentionally deferred to later Project 04 work.
- Performance and load testing are out of scope.

## Verification

- `npx playwright test tests/reception.spec.ts -g "persistence regression|cross-workspace" --reporter=line`: 3 passed
- `npm run build`: passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 30 passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed

Broader final verification is recorded in the DEN-65 report:

- `docs/completed/reception/2026-05-19-den-65-reception-persistence-regression-coverage-report.html`
