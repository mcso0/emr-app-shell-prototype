---
id: "OWNER-OS-PR-001"
status: "done"
area: "agent-orchestration"
priority: "P0"
target_pr: "Project CLAiR Owner OS Implementation / DEN-420"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/service/clair-owner-os-product-plan.md"
  - "docs/_meta/agent-rag-map.md"
  - "docs/_meta/owner-safety-os.md"
  - "docs/engineering/agent-orchestration/manual-linear-operations.md"
owner: "Codex"
---

# OWNER-OS-PR-001: Owner OS Implementation Scope Contract

## Goal

Adopt the CLAiR Owner OS product plan as the source-of-truth for the first implementation project and lock the initial Linear execution scope.

## Background

승욱 approved creating a dedicated Linear project for Owner OS implementation rather than an initiative. The project should implement the HTML/source plan in PR-sized issues while preserving explicit approval gates, no-gray-zone packet contracts, evals, trace evidence, and token-control rules.

Linear project:

- `CLAiR Owner OS Implementation`

Active issue:

- `DEN-420`: `00-01 Adopt Owner OS product plan and implementation scope`

## Scope

- Confirm `docs/product/service/clair-owner-os-product-plan.md` as the current source-of-truth.
- Keep `output/owner-os/clair-owner-os-product-plan-readable.html` as the readable planning artifact.
- Record the initial Linear issue sequence and manual milestone names.
- Keep implementation limited to repo-local skill, template, eval, trace, CLI, dashboard, QA, and closeout work.

## Out Of Scope

- Remote Supabase, production deploy, real data, payment, email, provider integration.
- Automatic merge, automatic deploy, automatic `Done` transitions, or unapproved Linear mutation beyond scoped setup.
- Broad multi-agent dispatch by default.
- Treating a single successful agent run as reliability evidence.

## Done Criteria

- Product plan status and related work point to the implementation scope.
- Linear project and issue sequence are created.
- Milestone limitation is documented.
- Docs verification passes.
- A Korean closeout report is created for `DEN-420`.

## Verification

- `npm run docs:check`

## Handoff Notes

The current Linear tool can create projects and issues but does not expose a milestone create/update tool. The project description and issue bodies include the recommended milestone names. Use Linear UI to add milestones manually if needed, then attach issues by their title prefixes.

## Completion Notes

- Linear project `CLAiR Owner OS Implementation` was created.
- Issues `DEN-420` through `DEN-429` were created.
- `DEN-420` was started and completed as a scope-contract issue.
- Closeout report: `docs/completed/agent-orchestration/2026-06-05-den-420-owner-os-implementation-scope-report.html`.
- Verification: `npm run docs:check` passed.
