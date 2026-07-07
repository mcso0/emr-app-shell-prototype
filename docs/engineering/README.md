# Engineering Docs

Engineering docs explain how CLAiR EMR is built, secured, persisted, operated, and verified. Use this area for implementation truth, not product wishes or completed-work evidence.

## Read First

- Current status: `docs/engineering/current-status.md`
- System architecture overview: `docs/engineering/architecture/system-architecture-overview.md`
- System architecture overview KO HTML: `docs/engineering/architecture/system-architecture-overview.ko.html`
- App shell layout contract: `docs/engineering/architecture/app-shell-layout-contract.md`
- Mock/live boundary map: `docs/engineering/architecture/mock-live-boundary-map.md`
- Reference project adoption plan: `docs/engineering/architecture/reference-project-adoption-plan.md`
- API boundary integration guide: `docs/engineering/api-boundaries/api-boundary-integration-guide.md`
- API boundary selectors: `docs/engineering/api-boundaries/api-boundary-selectors.md`
- Data model index: `docs/engineering/data-model/README.md`
- DB structure spec KO: `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`
- Auth/security roadmap: `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- Auth/login package index: `docs/engineering/auth-security/auth-login/README.md`
- Application security review checklist: `docs/engineering/auth-security/application-security-review-checklist.md`
- Application security review snapshot: `docs/engineering/auth-security/application-security-review-2026-07-07.md`
- Persistence and data security checklist: `docs/engineering/auth-security/persistence-data-security-checklist.md`
- Demo data architecture: `docs/engineering/demo-data-architecture-2026-06-08.md`
- Demo seed inventory/readback contract: `docs/engineering/data-model/demo-seed-inventory-readback-contract.md`
- API-backed demo runbook: `docs/engineering/testing/api-backed-demo-runbook.md`
- Product MVP QA scenarios: `docs/engineering/testing/product-mvp-qa-scenario-pack.md`
- Release environment policy: `docs/engineering/operations/release-environment-policy.md`
- Vercel Git integration execution plan: `docs/engineering/operations/vercel-git-integration-execution-plan.md`
- Launch readiness checklist: `docs/engineering/operations/launch-readiness-checklist.md`
- Manual Linear operations: `docs/engineering/agent-orchestration/manual-linear-operations.md`

## Subareas

- `architecture/`: app shell, module structure, mock/live boundaries, and architectural contracts.
- `api-boundaries/`: route, repository, selector, and integration boundary contracts.
- `data-model/`: actual schema, ERD, migration plans, RLS, indexes, and persistence contracts.
- `auth-security/`: Supabase Auth, workspace membership, permissions, RLS, audit, and server enforcement plans.
- `testing/`: validation strategy, demo runbooks, QA scenarios, and regression context.
- `operations/`: deployment, runtime configuration, staging, monitoring, and production-readiness guidance.
- `agent-orchestration/`: Linear-driven Codex work routing and agent operations.
- `decisions/`: engineering decisions and ADRs.

## Boundaries

- Engineering docs describe implementation contracts and verification guidance. User-facing domain requirements belong in `docs/product/domain/`.
- Do not treat client-only permission checks, hidden UI, or mock role labels as complete security.
- Do not claim remote Supabase staging/live validation, production deployment, RLS completeness, external integrations, or compliance/legal readiness unless scoped work verified it.
- Scoped synthetic/demo-data Supabase, migration, RLS, server/API, and production-demo deployment work may proceed when an active Linear issue or work item includes it.
- Explicit approval is still required before meaningful cost, secret/security exposure, private repo/public exposure, real customer/patient/guardian/payment/identity data, destructive or hard-to-rollback remote data changes, real external email/KakaoTalk/payment/provider side effects, or real external-user launch.
- Keep completed reports in `docs/completed/`; if a closeout changes current engineering truth, update the relevant engineering source doc too.

## Adding Engineering Docs

Use `docs/_meta/intake-rules.md`, `docs/_meta/taxonomy.md`, and `docs/_meta/documentation-depth-rules.md` before adding a new engineering doc. For PR-sized implementation work, start from `docs/work/index.md` and the active Linear issue.
