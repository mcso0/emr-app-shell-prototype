# Docs Lifecycle

Use this lifecycle for source-of-truth docs, planning records, and work items.

## Source Document Statuses

| Status | Meaning | Allowed next states |
|---|---|---|
| `draft` | Early idea or incomplete proposal | `review`, `deferred`, `deprecated` |
| `review` | Ready for user or implementation review | `approved`, `draft`, `deferred`, `superseded` |
| `approved` | Current source of truth | `superseded`, `deprecated`, `archived` |
| `deferred` | Intentionally postponed | `draft`, `review`, `deprecated`, `archived` |
| `superseded` | Replaced by a newer document or decision | `archived` |
| `deprecated` | Retained for context but no longer active guidance | `archived` |
| `archived` | Historical record only | none by default |

## Work Item Statuses

Work item statuses remain:

- `inbox`
- `backlog`
- `ready`
- `in_progress`
- `blocked`
- `done`
- `cancelled`
- `deferred`
- `superseded`

## Required Frontmatter

Use this frontmatter for new source-of-truth documents when practical:

```md
---
id:
status: draft
area:
doc_type:
related_work:
supersedes:
superseded_by:
last_updated:
---
```

Use an empty list (`[]`) when a field has no linked items yet.

## Optional OKF-Lite Metadata

New or substantially touched canonical source docs may also include these optional routing fields:

```md
type:
title:
description:
tags:
```

These fields borrow Open Knowledge Format style for agent-readable context. They do not replace the required lifecycle fields above. Use them to make a document easier to route, search, and summarize; do not treat them as authority over status, scope, security completion, DB/RLS readiness, launch readiness, or work acceptance.

## Change Verbs

Use these verbs in changelogs and closeouts:

- `added`: new requirement, concept, document, or workflow
- `changed`: existing guidance modified
- `removed`: accidental or low-value content removed
- `deferred`: intentionally postponed
- `superseded`: replaced by a newer source
- `archived`: moved out of active guidance

## Deletion Policy

Do not delete meaningful work history. Use status and links instead:

- Do not proceed: mark as `cancelled` or `deprecated`.
- Later: mark as `deferred`.
- Replaced: mark as `superseded` and link `superseded_by`.
- Historical only: move to `archive/` and mark `archived`.
- Delete only accidental empty files, typo files, or immediate duplicates with no decision value.
