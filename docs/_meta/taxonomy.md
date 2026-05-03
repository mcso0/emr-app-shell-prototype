# Docs Taxonomy

Use this taxonomy to decide where a new note, plan, decision, or work item belongs.

## Areas

| Area | Purpose | Examples |
|---|---|---|
| `business/` | Why the product should exist and how it wins | market, customer discovery, sales, pricing, metrics |
| `product/` | What the product should do and for whom | PRD, service concept, domain rules, features, epics, user stories, roadmap |
| `design/` | How the experience should look and behave | UX flows, screen specs, design system, reference assets, UI QA |
| `engineering/` | How the product is built, secured, operated, and verified | architecture, data model, auth/security, API boundaries, testing, operations |
| `work/` | PR-sized execution tracking | inbox, ready work items, active work, blocked work, backlog |
| `completed/` | Closeouts for finished work | what changed, verification, remaining risk, next steps |
| `archive/` | Historical records that are no longer active guidance | superseded plans, old sales-demo notes, retired implementation waves |

## Document Types

| Type | Use when | Canonical area |
|---|---|---|
| `prd` | defining product goals, target users, constraints, and success criteria | `product/prd/` |
| `service` | describing the whole service, package, or product-level behavior | `product/service/` |
| `domain` | describing business/domain concepts and data requirements in user language | `product/domain/` |
| `feature` | specifying feature behavior, acceptance criteria, and user impact | `product/features/` |
| `epic` | grouping multiple features or PR-sized work items into a product slice | `product/epics/` |
| `user_story` | describing a user goal with acceptance criteria | `product/user-stories/` |
| `decision` | recording a meaningful choice that should not be rediscovered | each area's `decisions/` |
| `flow` | describing task flow, navigation, and interaction sequence | `design/flows/` |
| `screen` | describing a concrete screen, layout, state, or UI rule | `design/screens/` |
| `adr` | recording an engineering architecture decision | `engineering/decisions/` |
| `data_model` | describing actual schema, ERD, migration, RLS, indexes, or persistence | `engineering/data-model/` |
| `work_item` | defining one PR-sized execution unit | `work/` |
| `closeout` | summarizing completed work and verification | `completed/` |
| `archive_record` | preserving non-current historical guidance | `archive/` |

## DB Boundary

Split DB-related planning by audience:

- `product/domain/`: user-facing domain concepts, data requirements, workflow rules, naming, and relationships in product language.
- `engineering/data-model/`: actual tables, columns, ERD, migration plans, RLS policies, indexes, persistence contracts, and Supabase/Postgres implementation details.

If one chat instruction affects both, update or create both documents and link them.

## Common Area Pattern

Each major area should keep:

- `README.md`: what belongs here and current canonical docs
- `changelog.md`: small planning changes that do not need their own decision record
- `decisions/`: durable choices with context and consequences
- `_template/` or shared templates in `docs/_meta/templates/` when the area needs repeated document shapes

