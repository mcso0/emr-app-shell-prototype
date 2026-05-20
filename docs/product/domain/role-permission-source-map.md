---
id: PRODUCT-DOMAIN-ROLE-PERMISSION-SOURCE-MAP
status: approved
area: product
doc_type: domain-map
related_work:
  - DEN-178
supersedes: []
superseded_by: []
last_updated: 2026-05-20
---

# Role And Permission Source Map

This document normalizes where CLAiR EMR role and permission truth lives. Use it before changing role labels, permission checks, workspace membership behavior, or admin UI.

## Canonical Product Source

The canonical product source for roles and workspace permissions is [Workspace Auth and Permission Domain](workspace-auth-permissions.md).

Current MVP canonical roles:

- `hospital_admin`
- `vet`
- `technician`
- `front_desk`

Known legacy or compatibility names:

- `nurse` should map conceptually to `technician` until the implementation is renamed or aliased.
- `billing_admin` is not a canonical MVP role. Billing authority should be assigned through approved MVP roles until a separate billing role is approved.

## Source Responsibilities

| Source | Owns | Does not own |
| --- | --- | --- |
| Product role/permission docs | Role meanings, user-facing matrix, policy decisions, approval gates | Implementation details or hidden client-only checks |
| App DB / membership records | Active workspace membership, assigned roles, membership status | Password identity or user-editable profile authority |
| Permission resolver | Effective permission union, denial reasons, server-side authorization decision | Product policy invention |
| Client UI | Helpful visibility, disabled states, labels, explanation | Final security enforcement |
| Audit events | Evidence of sensitive mutations and denials | Raw secrets, tokens, full clinical note bodies |

## Product Rules

- Workspace membership is the authorization source.
- Personal profile is never the authorization source.
- Effective permissions are additive union of all active roles.
- MVP roles are allow-only. Do not add deny rules without a product decision.
- Every active workspace must retain at least one active `hospital_admin`.
- Role/permission policy changes require explicit 승욱 approval.

## Required Link Targets

Use these docs instead of rediscovering the same policy:

- [Workspace Auth and Permission Domain](workspace-auth-permissions.md)
- [SaaS Operating Map](../service/clair-emr-saas-operating-map.md)
- [Product MVP Scope](../roadmap/product-mvp-scope.md)
- [SaaS Launch Approval Gates](../../engineering/auth-security/auth-login/saas-launch-approval-gates.md)
- [Supabase Auth Mapping](../../engineering/auth-security/auth-login/supabase-auth-mapping.md)
- [DB-backed Permission Adapter](../../engineering/auth-security/auth-login/db-backed-permission-adapter.md)

## Change Gate

Before any role/permission change, answer:

1. Is this a label, UX, resolver, DB, or policy change?
2. Does it alter canonical role names or the permission matrix?
3. Does it affect `hospital_admin` authority or last-admin protection?
4. Does it change who can mutate chart, order, billing, audit, or membership state?
5. Is explicit 승욱 approval required by launch gates?

If the change alters policy, stop and ask before implementation.

