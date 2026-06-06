---
id: "OWNER-OS-PR-004"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "Project CLAiR Owner OS Implementation / DEN-423"
source_docs:
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "docs/product/service/owner-os-eval-scenarios.json"
  - "docs/product/service/owner-os-judge-rubric.md"
dependencies:
  - "OWNER-OS-PR-003"
updated: "2026-06-05"
---

# OWNER-OS-PR-004: Eval Dataset And Judge Rubric

## Goal

Add the Owner OS deterministic scenario dataset and judge rubric for DEN-423.

## Scope

- Add `docs/product/service/owner-os-eval-scenarios.json`.
- Add `docs/product/service/owner-os-judge-rubric.md`.
- Cover normal, edge, ambiguous, approval-gated, and adversarial requests.
- Include parent model tier, 5.5 escalation decision, subagents, approval gate, and output shape expectations.

## Out Of Scope

- Production OpenAI API judging.
- Hidden prompt automation.
- Real remote service calls.

## Done When

- Scenario dataset has at least 10 scenarios.
- Rubric separates deterministic checks from LLM judge criteria.
- `npm run owner-os:eval` passes.
- `npm run docs:check` passes.

## Verification

- `npm run owner-os:eval`
- `npm run docs:check`

## Completion Notes

- Added `docs/product/service/owner-os-eval-scenarios.json` with 10 deterministic scenarios.
- Added `docs/product/service/owner-os-judge-rubric.md`.
- `npm run owner-os:eval` passed with 10/10 scenarios.
- `npm run docs:check` passed.
