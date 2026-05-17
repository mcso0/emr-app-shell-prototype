# AUTH-PR-001 Workspace Auth Scope and Permission Matrix

Status: human_review
Linear: DEN-18
Priority: P0

## Goal

Define the product scope, roles, permission matrix, safety rules, and acceptance criteria for workspace-based auth and permissions before implementation begins.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`
- `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`
- `docs/product/domain/workspace-auth-permissions.md`

## Scope

- Define product terms for workspace, creator, hospital admin, member, invitation, membership, and personal profile.
- Confirm canonical MVP roles: `hospital_admin`, `vet`, `technician`, `front_desk`.
- Document multi-role additive permission behavior.
- Document minimum active hospital admin safety rule.
- Create a role/permission matrix for core EMR areas.
- Record out-of-scope implementation gates.

## Out of Scope

- Product code changes.
- Live Supabase validation.
- Migration SQL or RLS policy SQL.
- Server-side enforcement code.
- Real subscription/payment provider integration.
- Real email invite delivery.

## Done Criteria

- `docs/product/domain/workspace-auth-permissions.md` exists and contains the current role matrix.
- Existing auth baseline is explicitly preserved.
- Open product questions are listed for later implementation issues.
- Linear `DEN-18` can move to Human Review.

## Verification

```bash
npm run docs:check
```

## Notes

- Existing code currently uses `nurse` for technician-like mock auth. Implementation should resolve the alias/rename deliberately.
- Existing `billing_admin` seed is outside the representative's canonical MVP role set and should not be promoted without a product decision.
