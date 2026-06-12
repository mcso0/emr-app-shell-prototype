# User Stories

User stories describe user goals and acceptance criteria.

Use this format:

```text
As a <user>,
I want <goal>,
so that <reason>.
```

Link stories to features, epics, and work items when they become implementation-ready.

## Template

Use `docs/_meta/templates/user-story.md`.

## Rules

- Include `User goal`, `Acceptance Criteria`, `Product Context`, `Linked Epic Or Feature`, `Out Of Scope`, and `Open Questions`.
- Keep one primary user goal per story.
- Acceptance criteria should describe observable product behavior, not implementation tasks.
- Link stories to epics or feature specs before implementation.
- Keep execution status in `docs/work/`, not in user-story documents.
- Do not bulk-create stories without a current product planning request.
- Prefer updating an existing story over creating a duplicate story for the same user goal.
