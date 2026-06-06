---
id: "OWNER-OS-PR-008"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "Project CLAiR Owner OS Implementation / DEN-427"
source_docs:
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "scripts/owner-os.mjs"
dependencies:
  - "OWNER-OS-PR-006"
  - "OWNER-OS-PR-007"
updated: "2026-06-05"
---

# OWNER-OS-PR-008: Dashboard Prototype

## Goal

Build the read-only Owner OS dashboard prototype for DEN-427.

## Scope

- Implement `npm run owner-os:dashboard`.
- Generate `output/owner-os/owner-os-dashboard.html`.
- Show project issue count, eval pass rate, approval gate posture, and scenario health.
- Keep dashboard read-only and local/static.

## Out Of Scope

- Linear write actions.
- Remote service mutation.
- Production app integration.

## Done When

- Dashboard HTML is generated.
- Dashboard reflects eval report health.
- `npm run owner-os:dashboard` passes.

## Verification

- `npm run owner-os:dashboard`

## Completion Notes

- Added `npm run owner-os:dashboard`.
- Generated `output/owner-os/owner-os-dashboard.html`.
- Dashboard is local/static and read-only.
