# AUTH-PR-002 Workspace Membership Data and Security Plan

Status: human_review
Linear: DEN-20
Priority: P0

## Goal

Plan the workspace membership data model, invitation/subscription supporting tables, RLS boundaries, server security gates, and audit requirements before migration or implementation begins.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/product/domain/workspace-auth-permissions.md`
- `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`
- `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`
- `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`
- `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`

## Scope

- Define recommended MVP table set for workspace auth and membership.
- Decide how additive multi-role membership should be represented.
- Define constraints for duplicate membership, duplicate invite, active membership, canonical role values, and last admin protection.
- Define RLS boundary principles and Data API exposure caveats.
- Define server-side authorization gates needed before UI/admin implementation.
- Define auth/admin audit event requirements.

## Out of Scope

- Product code changes.
- Migration SQL.
- RLS policy SQL.
- Live Supabase project validation.
- Server-side resolver implementation.
- Real payment provider integration.
- Real email invite delivery.
- Custom role builder, deny rules, SCIM, SSO, or domain auto-join.

## Done Criteria

- A dedicated workspace membership data/security plan exists.
- Existing auth and data model docs reflect the new canonical table/role direction.
- Supabase current-doc caveats are recorded.
- Verification plan exists for later implementation.
- Linear `DEN-20` can move to Human Review.

## Verification

```bash
npm run docs:check
npm run lint -- --ignore-pattern '.worktrees/**'
```

Note: plain `npm run lint` currently scans generated `.worktrees/workspace-tabs-mvp/.next/**` output and fails on unrelated generated files. The source-scoped lint command above passed.

## Notes

- MVP uses `roles text[]` on `user_memberships` for additive roles. A normalized join table can be introduced later if custom roles, deny rules, or detailed role history are approved.
- Personal profile settings are explicitly separated from authorization source.
- Last active `hospital_admin` protection is a server transaction/RPC responsibility, not a database check constraint alone.
