# Docs Home

This folder is the source of truth for product planning, implementation context, work tracking, and completion records for the EMR app shell prototype.

Start here:

1. `docs/index.md` for the human-facing GitBook/docs portal.
2. `docs/agent-start-here.md` for Codex startup routing.
3. `docs/work/index.md` for PR-sized work tracking.
4. The linked work item and its source documents.

For GitBook, use `docs/SUMMARY.md` as the sidebar map. The repository `docs/` folder remains the source of truth; GitBook is a readable portal, not the editing source.

## Operating Model

This repository uses docs as the lightweight replacement for ClickUp or Notion. Work is planned, scoped, and handed off in repo so a new chat or sub-agent can continue without hidden context.

Agent operating rules live in `docs/_meta/`. Use them when deciding where a chat instruction should be recorded, how deeply it should be documented, how a document should move through its lifecycle, how GitBook-facing navigation should stay curated, and how to review completed work with the user.

Canonical docs are organized by purpose:

| Area | Purpose |
|---|---|
| `_meta/` | Docs taxonomy, lifecycle, intake routing, templates, and result review rules |
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

See `docs/_meta/lifecycle.md` for the full source-document lifecycle, including `deferred` and `archived`.

## Intake Routing

When the user gives a planning or work-management instruction in chat, route it through `docs/_meta/intake-rules.md`.

After routing, use `docs/_meta/documentation-depth-rules.md` to avoid duplicate or overly deep records. In GitHub-backed work, PRs and issues should hold execution, review, CI, and merge context; `docs/` should hold current guidance, durable decisions, agent handoff, and archive-worthy context.

Default routing:

- Business model, customer, pricing, sales, or metrics context goes to `docs/business/`.
- Product behavior, PRD, domain requirements, features, epics, stories, and roadmap go to `docs/product/`.
- UX flows, screen-level behavior, design system notes, assets, and UI QA go to `docs/design/`.
- Architecture, DB schema, auth/security, API boundaries, testing, and operations go to `docs/engineering/`.
- PR-sized execution goes to `docs/work/`.
- Completed work summaries go to `docs/completed/`.
- Non-current historical guidance goes to `docs/archive/`.

DB-related planning is split by audience: user-facing domain and data requirements live in `docs/product/domain/`; actual schema, ERD, migrations, RLS, indexes, and persistence plans live in `docs/engineering/data-model/`.

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

## Result Reviews

After finishing work, the agent must give the user a concise review following `docs/_meta/result-review-rules.md`: what changed, which files or docs changed, current status, verification result, and a useful next step.
