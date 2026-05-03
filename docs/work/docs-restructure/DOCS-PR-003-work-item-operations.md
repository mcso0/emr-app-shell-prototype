---
id: "DOCS-PR-003"
status: "done"
area: "docs-restructure"
priority: "P0"
target_pr: "PR 3"
source_docs:
  - "docs/work/README.md"
  - "docs/work/index.md"
  - "docs/work/templates/work-item.md"
dependencies:
  - "DOCS-PR-001"
updated: "2026-05-03"
---

# Work Item Operations

## Goal

Make repo-native work tracking usable for PR-sized tasks and future agent handoff.

## Scope

- Define work item lifecycle and deletion policy.
- Create a work index, inbox, template, and PR-sized docs restructure work items.
- Move legacy backlog and open questions into `docs/work/`.

## Out Of Scope

- Adding a separate project management tool.
- Creating detailed product MVP work items beyond the docs restructure sequence.

## Done When

- `docs/work/index.md` shows work status by ID.
- Work item template contains the required fields.
- Legacy backlog and open questions have canonical work paths.

## Verification

- `npm run docs:check`
- `npm run lint`

## Handoff Notes

Future PR work should start by checking or creating a work item.
