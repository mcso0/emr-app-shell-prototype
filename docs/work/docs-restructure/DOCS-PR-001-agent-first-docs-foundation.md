---
id: "DOCS-PR-001"
status: "done"
area: "docs-restructure"
priority: "P0"
target_pr: "PR 1"
source_docs:
  - "AGENTS.md"
  - "docs/engineering/current-status.md"
  - "docs/README.md"
dependencies: []
updated: "2026-05-03"
---

# Agent-first Docs Foundation

## Goal

Create the agent-first docs entrypoint, PR-sized work tracking rules, and deterministic internal docs link checking.

## Scope

- Add `docs/README.md` and `docs/agent-start-here.md`.
- Add top-level team lens README files for business, product, design, and engineering.
- Add `docs/work/` index, inbox, template, and this PR-sized work item.
- Add `npm run docs:check` for internal docs path validation.
- Remove checked-in or stray `.DS_Store` files under `docs/`.

## Out Of Scope

- Moving PRD, feature spec, DB spec, user flow, implementation, design, or archive documents.
- Adding external URL checking with lychee.
- Changing app code, UI, tests, Supabase migrations, RLS, or server enforcement.

## Done When

- A new chat can follow `docs/agent-start-here.md` to the work index and this work item.
- `docs/work/index.md` shows the current docs restructure sequence and status.
- The work item template includes required fields for PR-sized task management.
- `npm run docs:check` passes.
- `npm run lint` passes.

## Verification

- `npm run docs:check`
- `npm run lint`
- `find docs -name ".DS_Store"`

## Handoff Notes

Completed as part of the full agent-first docs restructure. Follow-up work should now use `docs/work/index.md` and canonical docs under `product/`, `design/`, `engineering/`, `business/`, `completed/`, and `archive/`.
