---
id: "DEN-460"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-460"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/_meta/intake-rules.md"
  - "docs/_meta/documentation-depth-rules.md"
  - "docs/engineering/api-boundaries/api-boundary-integration-guide.md"
  - "docs/engineering/architecture/mock-live-boundary-map.md"
  - "docs/engineering/data-model/demo-seed-inventory-readback-contract.md"
dependencies:
  - "DEN-452"
  - "DEN-457"
  - "DEN-458"
  - "DEN-459"
updated: "2026-06-11"
---

# Engineering Docs Sync: Current Status, API Contracts, And Demo Runbook

## Goal

Synchronize engineering docs so a new session can understand the current mock/live/API boundary, demo runbook, verification commands, and remaining gaps without relying on chat-only handoff context.

## Scope

- Update current status with the DEN-460 docs-sync state.
- Refresh the API boundary integration guide so it no longer claims no feature module consumes API boundaries.
- Update the mock/live boundary map with the current local-first demo completion boundary.
- Link the seed readback contract to DEN-459 and the new runbook.
- Add an API-backed demo runbook under engineering testing docs.
- Add a testing README and update the engineering README.
- Add closeout evidence for Human Review.

## Out Of Scope

- Code behavior changes.
- DB schema, migration, RLS, or seed changes.
- Remote/prod Supabase work.
- UI rewiring or mock fallback removal.

## Verification

```bash
npm run docs:check
npm run security:secrets
```

## Result

DEN-460 adds `docs/engineering/testing/api-backed-demo-runbook.md` and synchronizes engineering docs around the latest API-backed demo boundary. The resulting docs distinguish local-first synthetic demo proof from production/live readiness, and they document how to interpret seed, environment, API, permission, and UI regression failures.
