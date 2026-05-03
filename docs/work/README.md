# Work Tracking

This folder is the repo-native work board for PR-sized tasks.

Use `docs/work/index.md` to find current work and `docs/work/inbox.md` for ideas that are not yet shaped into a PR-sized item.

Use these folders when work volume grows:

- `active/`: currently in-progress PR-sized work
- `backlog/`: shaped work that is not ready to start
- `blocked/`: work waiting on an external decision or artifact
- `docs-restructure/`: docs-operations work items and history
- `templates/`: work item templates

## Rules

- One work item should fit one PR.
- Do not create a work item until goal, scope, done criteria, source docs, dependencies, and verification are clear.
- Search existing work items before creating a new one.
- Do not delete meaningful work items. Use `cancelled`, `deferred`, or `superseded`.
- Keep implementation notes short and link to source documents instead of copying long context.
- Use `docs/_meta/intake-rules.md` to decide whether a chat instruction should become a work item, source-doc update, decision, closeout, or archive action.

## Status Values

- `inbox`
- `backlog`
- `ready`
- `in_progress`
- `blocked`
- `done`
- `cancelled`
- `deferred`
- `superseded`

## Required Work Item Fields

Use `docs/work/templates/work-item.md`.

Required fields:

- `id`
- `status`
- `area`
- `priority`
- `target_pr`
- `source_docs`
- `goal`
- `scope`
- `out_of_scope`
- `done_when`
- `verification`
- `dependencies`
- `handoff_notes`
