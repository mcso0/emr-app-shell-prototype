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
updated: "2026-09-26"
---

# Dispensing/Treatment Fulfillment Work Item Adoption

## Goal

Make the dispensing/treatment execution screen read visible queue state from `order_fulfillment_work_items` and persist status transitions through the existing workspace fulfillment API boundary.

## Scope

- Read both `dispensing` and `treatment` fulfillment queues from `/api/workspaces/[workspaceId]/fulfillment/work-items`.
- Project server work items into the existing execution queue and instruction/table status while leaving legacy fallback cleanup to DEMO-DATA-PR-002.
- Show the selected work item's operational status and assignee through the existing queue and instruction UI; keep opaque patient, encounter, order, and Task IDs out of the instruction header.
- Persist status transitions through `/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]`.
- Keep local execution state unchanged when server mutation fails.
- Add visible loading, empty, retryable failure, and permission-denied read states for the fulfillment queue.
- Add focused Playwright coverage for selected order display, persisted status refresh, permission denial, and mutation failure handling.

## Out Of Scope

- New seed data.
- DB schema, migration, or RLS changes.
- Lab result persistence or billing checkout logic.
- Broader local fixture and legacy Sales Demo fallback cleanup beyond this selected screen.
- Real provider, payment, or remote Supabase validation.

## Done Criteria

- `clair-demo` dispensing/treatment fulfillment work items can appear in the visible execution queue.
- A selected fulfillment item shows its order details and operational status in the existing instruction/table surfaces.
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

DEN-456 makes the dispensing/treatment screen API-aware at the execution surface. The screen now combines the existing fixture queue with fulfillment work-item readback, shows selected work through the existing instruction/table surfaces, saves status changes through the route boundary, and exposes read/mutation failures without silently mutating local state.

2026-06-25 follow-up: the fulfillment work-items read response now includes a server readback `summary` with total and status counts. Lab/imaging and dispensing/treatment queue empty states can use that API-backed source count to distinguish true no-work days from filtered or transformed-empty UI states.

2026-09-26 follow-up: the selected work item's extra read-only diagnostics row was removed from the dispensing/treatment instruction screen. Queue fetching, operational actions, and mutation/error notices remain; the existing instruction and order table present the work details.

2026-09-29 follow-up: successful empty dispensing/treatment reads use the existing neutral content empty state and refresh action. The duplicate empty-queue warning is removed because an empty date-scoped result does not prove an order handoff failure. Loading, read-error/retry, and permission-denied notices remain separate.

Local verification for this follow-up: three focused Chromium cases passed (no-work with refresh, queue totals/type filters, and read permission denial), together with ESLint on the two affected TypeScript files, `npm run docs:check`, and scoped `git diff --check`. The no-work assertion reproduced the duplicate notice before the fix. Clean release verification on current `origin/main` also passed the full lint, typecheck, production build, docs, UX-copy and local secret checks. Lint reported five existing warnings in unrelated WP10 scripts; the build retained the existing `/docs` NFT trace warning. Live queue contents and delivery evidence are recorded separately in the release PR.
