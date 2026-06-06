---
id: "OWNER-OS-PR-003"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "Project CLAiR Owner OS Implementation / DEN-422"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "docs/_meta/templates/owner-os-work-packet.md"
  - "docs/product/service/owner-os-work-packet-examples.md"
dependencies:
  - "OWNER-OS-PR-001"
  - "OWNER-OS-PR-002"
updated: "2026-06-05"
---

# OWNER-OS-PR-003: Work Packet Template And Validator

## Goal

Add the reusable Owner OS work packet template, deterministic required-field validation path, and good/bad examples for DEN-422.

## Scope

- Add `docs/_meta/templates/owner-os-work-packet.md`.
- Add `docs/product/service/owner-os-work-packet-examples.md`.
- Add `scripts/validate-owner-os-packets.mjs`.
- Add `npm run owner-os:packet:check`.
- Include parent model tier, 5.5 escalation decision, cost rationale, and subagent policy fields.
- Link the examples from service docs.

## Out Of Scope

- OpenAI API integration.
- Automatic multi-agent dispatch.
- Linear auto-status automation.
- Remote Supabase, production deploy, real data, payment, email, or provider integration.

## Done When

- The packet template includes scope, side effects, gates, verification, eval, trace, retry, token budget, parent model, subagent, result review, and handoff fields.
- The validator passes the template and good example.
- The validator rejects the intentionally bad example.
- `npm run owner-os:packet:check` passes.
- `npm run docs:check` passes.

## Verification

- `npm run owner-os:packet:check`
- `npm run docs:check`

## Handoff Notes

DEN-422 is the implementation bridge from the approved Owner OS plan to executable packets. Later DEN-423 and DEN-424 should reuse the packet fields instead of redefining eval or trace contracts from scratch.

## Completion Notes

- Added `docs/_meta/templates/owner-os-work-packet.md`.
- Added `docs/product/service/owner-os-work-packet-examples.md`.
- Added `scripts/validate-owner-os-packets.mjs`.
- Added `npm run owner-os:packet:check`.
- Linked Owner OS packet examples from `docs/product/service/README.md`.
- `npm run owner-os:packet:check` passed.
- `npm run docs:check` passed.
- Closeout report: `docs/completed/agent-orchestration/2026-06-05-den-422-owner-os-work-packet-template-validator-report.html`.
