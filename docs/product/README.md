# Product Docs

Product docs explain what to build and why.

Planned subareas:

- `service/`: service-wide product definition, boundaries, and behavior
- `domain/`: user-facing domain concepts, data requirements, and workflow rules
- `prd/`: product requirements and success criteria
- `features/`: feature-level specs, requirements, and acceptance criteria
- `epics/`: larger product slices that group features and work items
- `user-stories/`: user goals and acceptance criteria
- `roadmap/`: sequencing, milestones, and product direction
- `decisions/`: product decisions that should not be rediscovered
- `glossary/`: shared product and domain terms
- `user-flows/`: product-level workflow diagrams and descriptions

Current canonical product docs:

- Service operating map: `docs/product/service/clair-emr-saas-operating-map.md`
- Product MVP scope: `docs/product/roadmap/product-mvp-scope.md`
- Outpatient workflow state model: `docs/product/domain/outpatient-workflow-state-model.md`
- EMR domain entity map: `docs/product/domain/emr-domain-entity-map.md`
- Role and permission source map: `docs/product/domain/role-permission-source-map.md`
- PRD: `docs/product/prd/clair-emr-saas-prd.md`
- Legacy all-in-one MVP feature spec: `docs/product/features/legacy-mvp-feature-spec.md`
- User flow: `docs/product/user-flows/emr-saas-userflow.md`
- Changelog: `docs/product/changelog.md`

Future work should split the legacy feature spec into feature-level specs before major product planning changes.

DB-related product planning belongs in `docs/product/domain/` when it describes user-facing concepts, relationships, or data requirements. Actual schema, ERD, migrations, RLS, indexes, and persistence contracts belong in `docs/engineering/data-model/`.

Use `docs/_meta/intake-rules.md` when routing product instructions from chat.
