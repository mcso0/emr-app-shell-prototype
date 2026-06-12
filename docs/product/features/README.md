# Feature Specs

Canonical feature specification documents live here.

Use feature specs when a user-facing capability needs requirements and acceptance criteria that are more specific than the PRD but broader than a single PR-sized implementation item.

Current feature specs:

- `docs/product/features/auth/login-invite-onboarding-spec.md`
- `docs/product/features/auth/member-role-management-spec.md`
- `docs/product/features/hospital-admin/hospital-profile-onboarding-spec.md`
- `docs/product/features/home/home-command-entry-planning.md`
- `docs/product/features/home/home-v1-epic-plan.md`
- `docs/product/features/home/home-v1-reference-research.md`
- `docs/product/features/home/home-v1-ui-spec.md`
- `docs/product/features/home/home-work-generation-rules-v0.md`
- `docs/product/features/reception-appointment-spec.md`
- `docs/product/features/legacy-mvp-feature-spec.md`

Future work should split this into feature-level specs before major product planning changes.

## Template

Use `docs/_meta/templates/feature-spec.md`.

## Rules

- Include `Goal`, `Users`, `Scope`, `Requirements`, `Acceptance Criteria`, `Source Docs`, and `Open Questions`.
- Link each feature spec to its source PRD, related epic, user stories, and implementation work items when they exist.
- Keep PR-sized execution details in `docs/work/`; feature specs should describe product behavior and acceptance criteria.
- Prefer updating an existing feature spec over creating a duplicate summary document for the same feature.
- Do not expose security, DB/RLS, operations, or completed-report details in CLAiR Docs unless a separate reader-boundary review approves it.
