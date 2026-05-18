---
id: "RECEPTION-LIVE-PR-011"
status: "human_review"
area: "reception"
priority: "P0"
target_pr: "Project 03 / DEN-64"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/engineering/auth-security/auth-login/reception-day-calendar-read.md"
  - "docs/engineering/auth-security/auth-login/reception-queue-read.md"
  - "docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md"
dependencies:
  - "RECEPTION-LIVE-PR-010"
updated: "2026-05-19"
---

# Sales Demo And Mock Fallback Preservation

## Goal

Preserve the existing sales demo golden path and local mock fallback while reception persistence boundaries are added.

## Scope

- Lock the `kong-vomit` reception demo context against empty persisted queue/calendar overlays.
- Document mock fallback and Supabase mode selector behavior.
- Verify the reception regression and sales demo flow together.
- Keep demo query propagation expectations aligned with shell URL state.

## Out Of Scope

- New demo scenarios.
- Sales copy changes.
- Billing/chart persistence.
- Remote Supabase link/push, production deploy, or real data access.

## Done When

- Existing sales demo golden path passes after reception live reader additions.
- Empty persisted queue/calendar overlays do not remove mock demo appointment/context rows.
- Mock fallback behavior is documented.
- Korean HTML report exists for DEN-64.
- Linear DEN-64 is commented and moved to Human Review.

## Verification

- `npx playwright test tests/sales-demo-flow.spec.ts -g "reception live reader mock fallbacks" --reporter=line`: 1 passed
- `npx tsc --noEmit`: passed
- `npx playwright test tests/reception.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`: 30 passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed

## Result

Ready for Human Review.

DEN-64 added regression coverage and documentation for keeping the Kong sales demo and mock fallback stable during reception persistence rollout. Remote Supabase, production deploy, and real clinic/patient data were not touched.
