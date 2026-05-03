# Docs Home

This folder is the source of truth for product planning, implementation context, work tracking, and completion records for the EMR app shell prototype.

Start here:

1. `docs/agent-start-here.md`
2. `docs/work/index.md`
3. The linked work item and its source documents

## Operating Model

This repository uses docs as the lightweight replacement for ClickUp or Notion. Work is planned, scoped, and handed off in repo so a new chat or sub-agent can continue without hidden context.

Canonical docs are organized by purpose:

| Area | Purpose |
|---|---|
| `business/` | Market, customer, sales, pricing, and metrics context |
| `product/` | PRD, feature specs, epics, product decisions, and glossary |
| `design/` | Reference screens, UX flows, design system notes, and UI QA |
| `engineering/` | Architecture, data model, auth/security, API boundaries, and testing |
| `work/` | PR-sized work items, status board, inbox, and templates |
| `completed/` | Closeout documents for finished work |
| `archive/` | Historical plans and records that are no longer active guidance |

`docs/implementation/` is now a compatibility area with moved stubs. Do not add new source-of-truth documents there.

## Work Lifecycle

Work items are PR-sized by default. Vague ideas go to `docs/work/inbox.md` first and become work items only when goal, scope, done criteria, source docs, and verification are clear.

Work item statuses:

- `inbox`: not yet shaped into a PR-sized item
- `backlog`: candidate work for later
- `ready`: ready to start
- `in_progress`: currently being worked
- `blocked`: waiting on an external decision or artifact
- `done`: completed and linked to a closeout when appropriate
- `cancelled`: intentionally not doing it
- `deferred`: intentionally postponed
- `superseded`: replaced by another item

Planning document statuses:

- `draft`: early proposal
- `review`: needs review or decision
- `approved`: current implementation basis
- `superseded`: replaced by a newer document
- `deprecated`: retained only for historical context

## PR Creation Gate

Before creating a PR or PR-scoped work item, the agent must confirm:

1. Goal: one-sentence target for the PR
2. PR size: whether it fits one PR or needs splitting
3. Scope: included and explicitly excluded work
4. Done criteria: user-facing, document-facing, and verification criteria
5. Source docs: product, design, engineering, and previous work references
6. Verification: commands and manual checks
7. Status and dependencies: ready, blocked, deferred, and why
8. Duplicate check: whether an existing work item should be updated instead

If the answers are already clear from the conversation or docs, summarize them before starting. If they are unclear, ask before creating or changing the work item.

## Deletion Policy

Do not delete meaningful work history. Use `cancelled`, `deferred`, or `superseded` for work that should not proceed. Delete only accidental empty files, typos, or immediate duplicates with no decision value.

## Moving Docs

When a canonical document moves, leave a short moved stub at important old paths for at least one or two PRs. Update references to the new canonical path as part of the same change.

Run `npm run docs:check` after docs path edits.

## Link Checks

- Internal docs path check: `npm run docs:check`
- External link check: non-blocking `Docs External Link Check` GitHub Actions workflow using lychee
