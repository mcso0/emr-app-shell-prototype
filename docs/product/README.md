# Product Docs

Product docs explain what CLAiR EMR should do, who it serves, and which product boundaries matter. Use this area for product truth, not execution logs.

## Read First

- Product target and current status: `docs/engineering/current-status.md`
- Service operating map: `docs/product/service/clair-emr-saas-operating-map.md`
- Product MVP scope: `docs/product/roadmap/product-mvp-scope.md`
- PRD: `docs/product/prd/clair-emr-saas-prd.md`
- Global notification center v0: `docs/product/features/notifications/global-notification-center-v0-contract.md`
- Global notification event policy: `docs/product/features/notifications/global-notification-center-v0-event-policy.md`
- Outpatient workflow state model: `docs/product/domain/outpatient-workflow-state-model.md`
- EMR domain entity map: `docs/product/domain/emr-domain-entity-map.md`
- Workspace auth and permissions: `docs/product/domain/workspace-auth-permissions.md`
- Role and permission source map: `docs/product/domain/role-permission-source-map.md`
- Decision log index: `docs/product/decisions/decision-log-index.md`

## Reader Surface

The repo `docs/product/` tree is the source of truth. The internal `/docs` app route is a read-only viewer over a curated subset of these Markdown files. The legacy `/prd` route redirects to `/docs` for compatibility.

- Edit Markdown in `docs/product/`, not in the viewer.
- Do not copy product docs into `site/`, `public/`, a CMS, or generated duplicate document stores.
- Keep auth/security, DB/RLS, launch, operations, and completed-report docs out of the default CLAiR Docs registry unless a separate reader-boundary review approves the expansion.
- GitBook is no longer the active product-doc reader path; preserved GitBook files are inactive/deprecated history unless 승욱 explicitly revives that surface.

## Planning Document Rules

Prefer updating the current canonical document over creating a new summary layer. Add a new product document only when it becomes the smallest stable home for durable product truth.

| Document kind | Canonical home | Use when |
| --- | --- | --- |
| PRD | `docs/product/prd/` | Product goals, users, constraints, success criteria, and non-goals |
| Epic | `docs/product/epics/` | A product slice spans multiple features, stories, or PR-sized work items |
| Feature spec | `docs/product/features/` | A user-facing feature needs requirements and acceptance criteria |
| User story | `docs/product/user-stories/` | A single user goal needs observable acceptance criteria |
| Decision | `docs/product/decisions/` | A product choice should not be rediscovered in future planning |
| Domain | `docs/product/domain/` | User-facing entities, relationships, workflow states, and data requirements |

## Subareas

- `service/`: service-wide product definition, boundaries, and behavior.
- `domain/`: user-facing domain concepts, data requirements, workflow rules, and naming.
- `prd/`: product requirements and success criteria.
- `features/`: feature-level specs, requirements, and acceptance criteria.
- `epics/`: product slices that group features or workstreams.
- `user-stories/`: user goals and acceptance criteria.
- `roadmap/`: sequencing, milestones, and product direction.
- `decisions/`: product decisions that should not be rediscovered.
- `glossary/`: shared product and domain terms.
- `user-flows/`: product-level workflow diagrams and descriptions.
- `demo-data/`: synthetic representative dataset and demo scenario contracts.

## Boundaries

- Product docs describe desired behavior and domain meaning. PR-sized execution belongs in `docs/work/`.
- DB-related product planning belongs in `docs/product/domain/` when it describes user-facing concepts, relationships, or data requirements.
- Actual schema, ERD, migrations, RLS, indexes, and persistence contracts belong in `docs/engineering/data-model/`.
- The legacy all-in-one MVP feature spec at `docs/product/features/legacy-mvp-feature-spec.md` is retained for reference; prefer current source docs above for new planning.
- Global staff in-app notification behavior belongs under `docs/product/features/notifications/`; external guardian messaging and provider delivery remain separate scopes.
- Use synthetic examples only. Do not introduce real patient, guardian, hospital, payment, or identity data.

## Adding Product Docs

Before adding a new product doc, check `docs/_meta/intake-rules.md` and `docs/_meta/taxonomy.md`. If the request is independently executable, create or update a PR-sized work item in `docs/work/` instead of adding broad planning notes.

Use `docs/_meta/templates/epic.md` for new epics, `docs/_meta/templates/feature-spec.md` for new feature specs, and `docs/_meta/templates/user-story.md` for new user stories.
