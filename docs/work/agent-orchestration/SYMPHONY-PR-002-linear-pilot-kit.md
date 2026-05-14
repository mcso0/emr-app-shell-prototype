---
id: "SYMPHONY-PR-002"
status: "done"
area: "agent-orchestration"
priority: "P1"
target_pr: "PR 2"
source_docs:
  - "docs/engineering/agent-orchestration/symphony-operations.md"
  - "docs/engineering/agent-orchestration/linear-agent-workflow.md"
  - "docs/engineering/agent-orchestration/cso-security-agent.md"
  - "ops/symphony/README.md"
dependencies:
  - "SYMPHONY-PR-001"
  - "Real Linear project and API key before live daemon run"
updated: "2026-05-14"
---

# Symphony Linear Pilot Kit

## Goal

Add a manual-first Linear pilot kit so the first Symphony run can be created from documented statuses, labels, and safe starter issues.

## Scope

- Add `ops/symphony/linear/README.md` with project, status, label, and first-run checklist.
- Add three starter issue templates for docs, QA, and CSO auth review pilots.
- Register this work in `docs/work/index.md`.

## Out Of Scope

- Creating Linear resources through API.
- Installing or running Symphony.
- Changing the project slug beyond the current pilot slug.
- Changing application code.
- Auto-merge, deployment, Supabase migration, RLS, or server enforcement.

## Done When

- Linear pilot setup instructions are ready to copy into Linear.
- Starter issues cover one docs task, one QA/report task, and one CSO auth review task.
- Documentation checks pass.

## Verification

- `npm run docs:check`
- `rg "Pilot Issue|emr-agent-orchestration-pilot-e68d0b5a43ad|Security Review" ops/symphony/linear ops/symphony docs/engineering/agent-orchestration`

## Handoff Notes

Create the Linear project manually first. Start with `pilot-docs-closeout.md` only, confirm a clean Human Review handoff, then try QA, then CSO.
