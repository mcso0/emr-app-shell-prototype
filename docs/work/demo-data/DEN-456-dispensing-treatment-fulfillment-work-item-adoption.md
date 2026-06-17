---
id: "DEN-456"
status: "human_review"
area: "demo-data"
priority: "P0"
target_pr: "Linear DEN-456"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/work/index.md"
  - "docs/work/demo-data/UI-PR-002-fulfillment-billing-ui-wiring-e2e.md"
  - "docs/completed/engineering/2026-06-09-ui-pr-002-fulfillment-billing-ui-wiring-e2e-report.html"
dependencies:
  - "UI-PR-002"
  - "DEN-455"
updated: "2026-06-11"
---

# Dispensing/Treatment Fulfillment Work Item Adoption

## Goal

Make the dispensing/treatment execution screen read visible queue state from `order_fulfillment_work_items` and persist status transitions through the existing workspace fulfillment API boundary.

## Scope

- Read both `dispensing` and `treatment` fulfillment queues from `/api/workspaces/[workspaceId]/fulfillment/work-items`.
- Overlay the server readback onto the existing execution screen while leaving legacy fallback cleanup to DEMO-DATA-PR-002.
- Show visible fulfillment readback for the selected work item, including queue type, server status, assignee, and order id.
- Persist status transitions through `/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]`.
- Keep local execution state unchanged when server mutation fails.
- Add visible loading, empty, retryable failure, and permission-denied read states for the fulfillment queue.
- Add focused Playwright coverage for readback display, persisted status refresh, permission denial, and mutation failure handling.

## Out Of Scope

- New seed data.
- DB schema, migration, or RLS changes.
- Lab result persistence or billing checkout logic.
- Broader local fixture and legacy Sales Demo fallback cleanup beyond this selected screen.
- Real provider, payment, or remote Supabase validation.

## Done Criteria

- `clair-demo` dispensing/treatment fulfillment work items can appear in the visible execution queue.
- A selected fulfillment item shows server readback in the instruction header area.
- Status mutation is saved through the API boundary and re-read before the UI claims the new server state.
- Permission-denied reads are visible and distinct from retryable read failures.
- Failed status mutation does not locally mark the work as started or completed.

## Verification

- `npx playwright test tests/dispensing-fulfillment.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run docs:check`
- `npm run security:secrets`

## Result

DEN-456 makes the dispensing/treatment screen API-aware at the execution surface. The screen now combines the existing fixture queue with fulfillment work-item readback, shows selected server state, saves status changes through the route boundary, and exposes read/mutation failures without silently mutating local state.
