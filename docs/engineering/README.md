# Engineering Docs

Engineering docs explain how the product is built and verified.

Planned subareas:

- `architecture/`: app shell, API boundaries, module structure
- `data-model/`: DB structure, ERD, migration planning
- `auth-security/`: Supabase Auth, permission, RLS, and server enforcement plans
- `api-boundaries/`: repository and selector contracts
- `testing/`: validation strategy and command sets
- `agent-orchestration/`: Symphony, Linear-driven Codex work routing, and CSO security-agent operations
- `operations/`: deployment, runtime configuration, monitoring, and production readiness
- `decisions/`: engineering decisions and ADRs

Current canonical engineering docs:

- Current status: `docs/engineering/current-status.md`
- App shell layout: `docs/engineering/architecture/app-shell-layout-contract.md`
- Mock/live boundary map: `docs/engineering/architecture/mock-live-boundary-map.md`
- Data model: `docs/engineering/data-model/`
- Auth/security: `docs/engineering/auth-security/`
- Persistence and data security checklist: `docs/engineering/auth-security/persistence-data-security-checklist.md`
- API boundaries: `docs/engineering/api-boundaries/`
- Agent orchestration: `docs/engineering/agent-orchestration/`
- Gap analysis/testing context: `docs/engineering/testing/mvp-gap-analysis.md`
- Product MVP QA scenarios: `docs/engineering/testing/product-mvp-qa-scenario-pack.md`
- Launch readiness checklist: `docs/engineering/operations/launch-readiness-checklist.md`
- Changelog: `docs/engineering/changelog.md`

DB-related implementation planning belongs here when it describes actual schema, ERD, migrations, RLS, indexes, or persistence contracts. User-facing data requirements belong in `docs/product/domain/`.

Use `docs/_meta/intake-rules.md` when routing engineering instructions from chat.
