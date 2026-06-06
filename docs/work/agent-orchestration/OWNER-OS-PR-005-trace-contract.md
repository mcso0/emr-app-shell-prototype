---
id: "OWNER-OS-PR-005"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "Project CLAiR Owner OS Implementation / DEN-424"
source_docs:
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "docs/product/service/owner-os-trace-contract.md"
dependencies:
  - "OWNER-OS-PR-003"
updated: "2026-06-05"
---

# OWNER-OS-PR-005: Trace Contract

## Goal

Define the Owner OS trace contract and compact trace summary format for DEN-424.

## Scope

- Add `docs/product/service/owner-os-trace-contract.md`.
- Define required trace fields.
- Define information that must not be stored.
- Link trace to packet and eval behavior.
- Add local CLI trace fixture output.

## Out Of Scope

- External observability SaaS integration.
- Full transcript storage.
- Real data or secret capture.

## Done When

- Trace contract includes classification, context, model, subagent, gate, tool, verification, and result fields.
- `npm run owner-os -- trace` can generate a compact local trace fixture.
- `npm run docs:check` passes.

## Verification

- `npm run owner-os -- trace --request "Create Owner OS trace fixture"`
- `npm run docs:check`

## Completion Notes

- Added `docs/product/service/owner-os-trace-contract.md`.
- Generated `output/owner-os/trace-summary.json`.
- `npm run owner-os -- trace --request "Create Owner OS trace fixture" --issue DEN-424` passed.
- `npm run docs:check` passed.
