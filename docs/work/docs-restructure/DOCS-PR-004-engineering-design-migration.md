---
id: "DOCS-PR-004"
status: "done"
area: "docs-restructure"
priority: "P0"
target_pr: "PR 4"
source_docs:
  - "docs/engineering/README.md"
  - "docs/design/README.md"
dependencies:
  - "DOCS-PR-001"
  - "DOCS-PR-002"
updated: "2026-05-03"
---

# Engineering And Design Migration

## Goal

Move active engineering and design source-of-truth docs into canonical homes.

## Scope

- Move current status, auth/security, API boundary, app shell, and gap analysis docs under `docs/engineering/`.
- Move reference screen index and reference assets under `docs/design/`.
- Keep moved stubs under old paths.
- Update `AGENTS.md` with agent-first work rules.

## Out Of Scope

- Changing code behavior.
- Changing reference screen content beyond path normalization.

## Done When

- Engineering docs are discoverable from `docs/engineering/README.md`.
- Design docs are discoverable from `docs/design/README.md`.
- `AGENTS.md` points agents to `docs/agent-start-here.md`, work items, and reference screen rules.

## Verification

- `npm run docs:check`
- `npm run lint`

## Handoff Notes

`docs/implementation/` is now compatibility stubs only.
