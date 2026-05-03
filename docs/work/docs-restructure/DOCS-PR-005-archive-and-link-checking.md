---
id: "DOCS-PR-005"
status: "done"
area: "docs-restructure"
priority: "P1"
target_pr: "PR 5"
source_docs:
  - "docs/archive/README.md"
  - "docs/completed/README.md"
  - ".github/workflows/docs-link-check.yml"
dependencies:
  - "DOCS-PR-001"
updated: "2026-05-03"
---

# Archive And Link Checking

## Goal

Separate historical docs from active guidance and add non-blocking external link checking.

## Scope

- Move historical sales demo, implementation wave, and UI note documents into `docs/archive/`.
- Keep closeout docs under `docs/completed/`.
- Add a non-blocking lychee GitHub Actions workflow for external link checking.

## Out Of Scope

- Making external link checking blocking.
- Rewriting historical documents.

## Done When

- Active docs and archive docs are separated.
- Completed closeouts remain under `docs/completed/`.
- External link checking can run without blocking app work.

## Verification

- `npm run docs:check`
- `npm run lint`

## Handoff Notes

Internal docs link checking remains the blocking local check. External link checking is advisory.
