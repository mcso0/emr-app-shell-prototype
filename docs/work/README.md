# Work Tracking

This folder is the repo-native work board for PR-sized tasks. Use it to shape execution, not to store broad product, design, or engineering source-of-truth.

## Read First

- Work index: `docs/work/index.md`
- Work inbox: `docs/work/inbox.md`
- Open questions: `docs/work/open-questions.md`
- Work item template: `docs/work/templates/work-item.md`
- Intake rules: `docs/_meta/intake-rules.md`
- Documentation depth rules: `docs/_meta/documentation-depth-rules.md`
- Manual Linear operations: `docs/engineering/agent-orchestration/manual-linear-operations.md`

## Subareas

- `active/`: currently in-progress PR-sized work when a separate active folder is useful.
- `backlog/`: shaped work that is not ready to start.
- `blocked/`: work waiting on an external decision or artifact.
- `docs-restructure/`: docs-operations work items and history.
- `templates/`: work item templates.
- Area folders such as `auth/`, `clinical-billing/`, `design-system/`, and `reception/`: PR-sized work grouped by product or engineering area.

## Work Item Rules

- One work item should fit one PR by default.
- Do not create a work item until goal, scope, done criteria, source docs, dependencies, and verification are clear.
- Search existing work items before creating a new one.
- Keep implementation notes short and link to source documents instead of copying long context.
- Do not delete meaningful work items. Use `cancelled`, `deferred`, or `superseded`.
- Stop meaningful Linear issue work at `Human Review`; move to `Done` only when 승욱 explicitly accepts or asks.

## Status Values

- `inbox`: not yet shaped into a PR-sized item.
- `backlog`: candidate work for later.
- `ready`: ready to start.
- `in_progress`: currently being worked.
- `blocked`: waiting on an external decision or artifact.
- `done`: completed and linked to a closeout when appropriate.
- `cancelled`: intentionally not doing it.
- `deferred`: intentionally postponed.
- `superseded`: replaced by another item.

## Required Work Item Fields

Use `docs/work/templates/work-item.md`. Required fields:

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

## Boundaries

- Source-of-truth changes belong in `business/`, `product/`, `design/`, `engineering/`, or `_meta/`, with the work item linking to them.
- Completed results belong in `docs/completed/` when a durable closeout is useful.
- Linear remains the status board and Human Review handoff surface. Keep repo work items aligned with Linear rather than creating parallel status claims.
