# Screen Docs

Screen docs describe concrete screen-level layout, states, density, content priority, and UI behavior.

Reference assets belong in `docs/design/assets/`.

## Folder Convention

Use `docs/design/screens/<screen-slug>/` for screen-specific material.

- `planning/`: product/design planning notes, proposals, and implementation-ready screen plans.
- `specs/`: durable screen specs once a planning note is accepted as the current rule.
- `qa/`: screen-level QA notes that are not broad enough for `docs/design/qa/`.

Prefer this structure for new screens so future planning docs are easy to find and can be promoted from `planning/` to `specs/` without changing the screen folder.
